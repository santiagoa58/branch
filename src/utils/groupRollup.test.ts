import { describe, it, expect } from "vite-plus/test";
import { z } from "zod";
import type { Node, Edge } from "@xyflow/react";
import {
  applyGroupCollapse,
  getVisibleRepresentative,
  isRollupEdgeId,
  ROLLUP_EDGE_PREFIX,
  COLLAPSED_GROUP_WIDTH,
  COLLAPSED_GROUP_HEIGHT,
} from "./groupRollup";

const rollupEdgeDataSchema = z.object({
  count: z.number(),
  edgeIds: z.array(z.string()),
  protocols: z.array(z.string()),
  bidirectional: z.boolean(),
  collapsedGroupIds: z.array(z.string()),
});

const group = (id: string, collapsed: boolean, parentId?: string): Node => ({
  id,
  type: "group",
  position: { x: 0, y: 0 },
  data: { label: id, groupType: "vpc", collapsed },
  ...(parentId ? { parentId, extent: "parent" as const } : {}),
});

const archNode = (id: string, parentId?: string, position = { x: 50, y: 50 }): Node => ({
  id,
  type: "architecture",
  position,
  data: { label: id, type: "service" },
  ...(parentId ? { parentId, extent: "parent" as const } : {}),
});

const edge = (
  id: string,
  source: string,
  target: string,
  data: Record<string, unknown> = {},
): Edge => ({
  id,
  source,
  target,
  type: "architecture",
  data,
});

const rollupsOf = (edges: Edge[]) => edges.filter((e) => isRollupEdgeId(e.id));

const onlyRollup = (edges: Edge[]) => {
  const rollups = rollupsOf(edges);
  expect(rollups).toHaveLength(1);
  const rollup = rollups[0];
  if (!rollup) {
    throw new Error("Expected exactly one rollup edge");
  }
  return { rollup, data: rollupEdgeDataSchema.parse(rollup.data) };
};

describe("getVisibleRepresentative", () => {
  it("returns the node itself when no ancestor is collapsed", () => {
    const nodes = [group("g1", false), archNode("a", "g1")];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    expect(getVisibleRepresentative("a", byId)).toBe("a");
  });

  it("returns the collapsed parent group", () => {
    const nodes = [group("g1", true), archNode("a", "g1")];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    expect(getVisibleRepresentative("a", byId)).toBe("g1");
  });

  it("returns the OUTERMOST collapsed ancestor for nested collapsed groups", () => {
    const nodes = [group("outer", true), group("inner", true, "outer"), archNode("a", "inner")];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    expect(getVisibleRepresentative("a", byId)).toBe("outer");
  });

  it("skips expanded ancestors but honors a collapsed one above them", () => {
    const nodes = [group("outer", true), group("inner", false, "outer"), archNode("a", "inner")];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    expect(getVisibleRepresentative("a", byId)).toBe("outer");
  });
});

describe("applyGroupCollapse", () => {
  it("passes everything through (and clears stale hidden flags) when nothing is collapsed", () => {
    const nodes = [group("g1", false), { ...archNode("a", "g1"), hidden: true }, archNode("b")];
    const edges = [{ ...edge("e1", "a", "b"), hidden: true }];

    const { displayNodes, displayEdges } = applyGroupCollapse(nodes, edges);

    expect(displayNodes.find((n) => n.id === "a")?.hidden).toBe(false);
    expect(displayEdges.find((e) => e.id === "e1")?.hidden).toBe(false);
    expect(rollupsOf(displayEdges)).toHaveLength(0);
  });

  it("hides children and internal edges of a collapsed group", () => {
    const nodes = [group("g1", true), archNode("a", "g1"), archNode("b", "g1")];
    const edges = [edge("e1", "a", "b")];

    const { displayNodes, displayEdges } = applyGroupCollapse(nodes, edges);

    expect(displayNodes.find((n) => n.id === "g1")?.hidden).toBeFalsy();
    expect(displayNodes.find((n) => n.id === "a")?.hidden).toBe(true);
    expect(displayNodes.find((n) => n.id === "b")?.hidden).toBe(true);
    expect(displayEdges.find((e) => e.id === "e1")?.hidden).toBe(true);
    expect(rollupsOf(displayEdges)).toHaveLength(0);
  });

  it("rolls a boundary edge up onto the collapsed group", () => {
    const nodes = [group("g1", true), archNode("a", "g1"), archNode("x")];
    const edges = [edge("e1", "a", "x", { protocol: "http" })];

    const { displayEdges } = applyGroupCollapse(nodes, edges);

    expect(displayEdges.find((e) => e.id === "e1")?.hidden).toBe(true);
    const { rollup, data } = onlyRollup(displayEdges);
    expect(rollup.source).toBe("g1");
    expect(rollup.target).toBe("x");
    expect(rollup.type).toBe("rollup");
    expect(rollup.selectable).toBe(false);
    expect(rollup.deletable).toBe(false);
    expect(data.count).toBe(1);
    expect(data.edgeIds).toEqual(["e1"]);
    expect(data.protocols).toEqual(["http"]);
    expect(data.bidirectional).toBe(false);
    expect(data.collapsedGroupIds).toEqual(["g1"]);
  });

  it.each([
    ["side by side", { x: 600, y: 60 }, {}],
    ["stacked", { x: 0, y: 600 }, { sourceHandle: "bottom", targetHandle: "top" }],
  ])("attaches a rollup to the ports that face each other (%s)", (_case, position, handles) => {
    const nodes = [group("g1", true), archNode("a", "g1"), archNode("x", undefined, position)];
    const { rollup } = onlyRollup(
      applyGroupCollapse(nodes, [edge("e1", "a", "x", { protocol: "http" })]).displayEdges,
    );
    expect({ sourceHandle: rollup.sourceHandle, targetHandle: rollup.targetHandle }).toEqual({
      sourceHandle: undefined,
      targetHandle: undefined,
      ...handles,
    });
  });

  it("aggregates multiple boundary edges between the same pair into one rollup", () => {
    const nodes = [group("g1", true), archNode("a", "g1"), archNode("b", "g1"), archNode("x")];
    const edges = [
      edge("e1", "a", "x", { protocol: "http" }),
      edge("e2", "b", "x", { protocol: "grpc" }),
      edge("e3", "a", "x", { protocol: "http" }),
    ];

    const { displayEdges } = applyGroupCollapse(nodes, edges);

    const { data } = onlyRollup(displayEdges);
    expect(data.count).toBe(3);
    expect(data.edgeIds).toEqual(["e1", "e2", "e3"]);
    expect(new Set(data.protocols)).toEqual(new Set(["http", "grpc"]));
  });

  it("marks the rollup bidirectional when edges flow both ways", () => {
    const nodes = [group("g1", true), archNode("a", "g1"), archNode("x")];
    const edges = [edge("e1", "a", "x"), edge("e2", "x", "a")];

    const { displayEdges } = applyGroupCollapse(nodes, edges);

    const { data } = onlyRollup(displayEdges);
    expect(data.bidirectional).toBe(true);
  });

  it("marks the rollup bidirectional when an aggregated edge is itself bidirectional", () => {
    const nodes = [group("g1", true), archNode("a", "g1"), archNode("x")];
    const edges = [edge("e1", "a", "x", { bidirectional: true })];

    const { displayEdges } = applyGroupCollapse(nodes, edges);

    const { data } = onlyRollup(displayEdges);
    expect(data.bidirectional).toBe(true);
  });

  it("rolls up edges between two collapsed groups", () => {
    const nodes = [group("g1", true), group("g2", true), archNode("a", "g1"), archNode("b", "g2")];
    const edges = [edge("e1", "a", "b")];

    const { displayEdges } = applyGroupCollapse(nodes, edges);

    const { rollup, data } = onlyRollup(displayEdges);
    expect(rollup.source).toBe("g1");
    expect(rollup.target).toBe("g2");
    expect(new Set(data.collapsedGroupIds)).toEqual(new Set(["g1", "g2"]));
  });

  it("keeps edges that directly target the collapsed group node itself", () => {
    const nodes = [group("g1", true), archNode("x")];
    const edges = [edge("e1", "x", "g1")];

    const { displayEdges } = applyGroupCollapse(nodes, edges);

    expect(displayEdges.find((e) => e.id === "e1")?.hidden).toBeFalsy();
    expect(rollupsOf(displayEdges)).toHaveLength(0);
  });

  it("hides edges deep inside nested collapsed groups instead of rolling them up", () => {
    const nodes = [
      group("outer", true),
      group("inner", true, "outer"),
      archNode("a", "inner"),
      archNode("b", "outer"),
    ];
    // a (inside inner) -> b (inside outer): both roll up to `outer` → internal.
    const edges = [edge("e1", "a", "b")];

    const { displayEdges } = applyGroupCollapse(nodes, edges);

    expect(displayEdges.find((e) => e.id === "e1")?.hidden).toBe(true);
    expect(rollupsOf(displayEdges)).toHaveLength(0);
  });

  it("uses a stable id for the same representative pair regardless of direction", () => {
    const nodes = [group("g1", true), archNode("a", "g1"), archNode("x")];
    const forward = applyGroupCollapse(nodes, [edge("e1", "a", "x")]);
    const reverse = applyGroupCollapse(nodes, [edge("e1", "x", "a")]);

    const forwardRollup = onlyRollup(forward.displayEdges).rollup;
    const reverseRollup = onlyRollup(reverse.displayEdges).rollup;
    expect(forwardRollup.id).toBe(reverseRollup.id);
    expect(forwardRollup.id.startsWith(ROLLUP_EDGE_PREFIX)).toBe(true);
  });

  it("shrinks a visible collapsed group to the compact card size without mutating the stored node", () => {
    const stored = {
      ...group("g1", true),
      style: { width: 800, height: 600 },
    };
    const nodes = [stored, archNode("a", "g1")];

    const { displayNodes } = applyGroupCollapse(nodes, []);

    const display = displayNodes.find((n) => n.id === "g1");
    if (!display) {
      throw new Error("Expected the collapsed group in the display graph");
    }
    expect(display.style?.width).toBe(COLLAPSED_GROUP_WIDTH);
    expect(display.style?.height).toBe(COLLAPSED_GROUP_HEIGHT);
    expect(display.width).toBeUndefined();
    expect(display.height).toBeUndefined();
    // Stored node keeps the expanded footprint for when it's re-expanded.
    expect(stored.style).toEqual({ width: 800, height: 600 });
  });

  it("does not shrink an expanded group or a collapsed group hidden inside a collapsed ancestor", () => {
    const expanded = { ...group("g1", false), style: { width: 800, height: 600 } };
    const outer = group("outer", true);
    const hiddenInner = { ...group("inner", true, "outer"), style: { width: 400, height: 300 } };
    const { displayNodes } = applyGroupCollapse([expanded, outer, hiddenInner], []);

    expect(displayNodes.find((n) => n.id === "g1")?.style).toEqual({ width: 800, height: 600 });
    const inner = displayNodes.find((n) => n.id === "inner");
    if (!inner) {
      throw new Error("Expected the nested group in the display graph");
    }
    expect(inner.hidden).toBe(true);
    expect(inner.style).toEqual({ width: 400, height: 300 });
  });

  it("preserves object identity for untouched nodes and edges", () => {
    const untouched = archNode("y");
    const nodes = [group("g1", true), archNode("a", "g1"), untouched];
    const plainEdge = edge("e1", "y", "y");
    const { displayNodes, displayEdges } = applyGroupCollapse(nodes, [plainEdge]);

    expect(displayNodes.find((n) => n.id === "y")).toBe(untouched);
    expect(displayEdges.find((e) => e.id === "e1")).toBe(plainEdge);
  });
});
