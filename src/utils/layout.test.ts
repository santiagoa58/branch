import { describe, expect, it } from "vite-plus/test";
import { Position, type Edge, type Node } from "@xyflow/react";
import { autoLayoutDiagram } from "./layout";
import { COLLAPSED_GROUP_HEIGHT, COLLAPSED_GROUP_WIDTH } from "./groupRollup";
import { RANK_GAP } from "./layout/rank";

function node(id: string, overrides: Partial<Node> = {}): Node {
  return {
    id,
    type: "architecture",
    data: { label: id, type: "service" },
    position: { x: 123, y: -456 },
    ...overrides,
  };
}

function group(id: string, overrides: Partial<Node> = {}): Node {
  return node(id, {
    type: "group",
    data: { label: id, groupType: "vpc", collapsed: false },
    style: { width: 400, height: 300 },
    ...overrides,
  });
}

function edge(source: string, target: string, id = `${source}->${target}`): Edge {
  return { id, source, target, data: { protocol: "http" } };
}

function get(nodes: Node[], id: string): Node {
  const result = nodes.find((candidate) => candidate.id === id);
  if (!result) {
    throw new Error(`Missing node ${id}`);
  }
  return result;
}

function numeric(value: number | string | undefined): number | undefined {
  return typeof value === "string" ? Number.parseFloat(value) : value;
}

function size(node: Node): { width: number; height: number } {
  if (node.type === "group") {
    return node.data["collapsed"] === true
      ? { width: COLLAPSED_GROUP_WIDTH, height: COLLAPSED_GROUP_HEIGHT }
      : { width: Number(node.style?.width), height: Number(node.style?.height) };
  }
  return {
    width:
      node.measured?.width ?? node.width ?? numeric(node.style?.width) ?? node.initialWidth ?? 180,
    height:
      node.measured?.height ??
      node.height ??
      numeric(node.style?.height) ??
      node.initialHeight ??
      140,
  };
}

function bounds(node: Node) {
  const { width, height } = size(node);
  const left = node.position.x - width * (node.origin?.[0] ?? 0);
  const top = node.position.y - height * (node.origin?.[1] ?? 0);
  return { left, top, right: left + width, bottom: top + height };
}

function expectNonoverlap(nodes: Node[]) {
  const overlaps: string[] = [];
  for (let i = 0; i < nodes.length; i += 1) {
    const a = nodes[i]!;
    expect(Number.isFinite(a.position.x) && Number.isFinite(a.position.y)).toBe(true);
    for (let j = i + 1; j < nodes.length; j += 1) {
      const b = nodes[j]!;
      if (a.parentId !== b.parentId) {
        continue;
      }
      const first = bounds(a);
      const second = bounds(b);
      if (
        first.left < second.right &&
        first.right > second.left &&
        first.top < second.bottom &&
        first.bottom > second.top
      ) {
        overlaps.push(`${a.id}/${b.id}`);
      }
    }
  }
  expect(overlaps).toEqual([]);
}

function expectContained(nodes: Node[]) {
  for (const child of nodes) {
    if (child.parentId === undefined) {
      continue;
    }
    const parent = get(nodes, child.parentId);
    if (parent.data["collapsed"] === true) {
      continue;
    }
    const childBounds = bounds(child);
    expect(childBounds.left).toBeGreaterThanOrEqual(32);
    expect(childBounds.top).toBeGreaterThanOrEqual(48);
    expect(childBounds.right + 32).toBeLessThanOrEqual(Number(parent.style?.width));
    expect(childBounds.bottom + 32).toBeLessThanOrEqual(Number(parent.style?.height));
    expect(child.extent).toBe("parent");
    expect(nodes.indexOf(parent)).toBeLessThan(nodes.indexOf(child));
  }
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) {
      freeze(child);
    }
    Object.freeze(value);
  }
  return value;
}

describe("autoLayoutDiagram", () => {
  it("handles empty diagrams and dangling edges", () => {
    expect(autoLayoutDiagram([], [])).toEqual([]);
    expect(autoLayoutDiagram([], [edge("missing", "also-missing")])).toEqual([]);
  });

  it("uses actual measured rectangles, including independent per-axis fallbacks", () => {
    const nodes = [
      node("source", { measured: { width: 670, height: 57 }, width: 180, height: 100 }),
      node("tall", { measured: { width: 92, height: 570 } }),
      node("wide", { measured: { width: 830, height: 115 } }),
      node("mixed", {
        measured: { width: 480 },
        width: 50,
        height: 310,
        style: { width: 100, height: 90 },
      }),
      node("sink", { measured: { width: 280, height: 390 } }),
    ];
    const edges = [
      edge("source", "tall"),
      edge("source", "wide"),
      edge("source", "mixed"),
      edge("tall", "sink"),
      edge("wide", "sink"),
      edge("mixed", "sink"),
    ];
    const result = autoLayoutDiagram(nodes, edges);
    expectNonoverlap(result);
    for (const connection of edges) {
      expect(bounds(get(result, connection.source)).right).toBeLessThan(
        bounds(get(result, connection.target)).left,
      );
    }
    expect(get(result, "source").measured).toEqual({ width: 670, height: 57 });
  });

  it("uses explicit, numeric/px style, and initial dimensions before type fallbacks", () => {
    const nodes = [
      node("explicit", { width: 720, height: 270 }),
      node("styled", { style: { width: "630px", height: "250" } }),
      node("initial", { initialWidth: 450, initialHeight: 290 }),
      node("fallback"),
    ];
    const result = autoLayoutDiagram(nodes, [
      edge("explicit", "styled"),
      edge("styled", "initial"),
      edge("initial", "fallback"),
    ]);
    expectNonoverlap(result);
    expect(bounds(get(result, "styled")).left).toBeGreaterThanOrEqual(720);
    expect(bounds(get(result, "initial")).left).toBeGreaterThan(
      bounds(get(result, "styled")).right,
    );
  });

  it("ignores unusable dimensions without producing NaN or infinite geometry", () => {
    const result = autoLayoutDiagram(
      [
        node("bad", {
          measured: { width: NaN, height: 0 },
          width: -10,
          height: Infinity,
          style: { width: "100%", height: "calc(100% - 4px)" },
        }),
        node("good"),
      ],
      [edge("bad", "good")],
    );
    expect(get(result, "bad").position).toEqual({ x: 0, y: 0 });
    expect(get(result, "good").position.x).toBeGreaterThanOrEqual(RANK_GAP);
    expect(Number.isFinite(get(result, "good").position.y)).toBe(true);
  });

  it("lays out large variable-size fan-out and fan-in without overlap", () => {
    const leaves = Array.from({ length: 80 }, (_, index) =>
      node(`leaf-${String(index).padStart(3, "0")}`, {
        measured: { width: 120 + (index % 9) * 47, height: 75 + (index % 7) * 39 },
      }),
    );
    const nodes = [node("source"), ...leaves, node("sink", { width: 780, height: 360 })];
    const edges = leaves.flatMap((leaf) => [edge("source", leaf.id), edge(leaf.id, "sink")]);
    const result = autoLayoutDiagram(nodes, edges);
    expectNonoverlap(result);
    for (const leaf of leaves) {
      expect(bounds(get(result, "source")).right).toBeLessThan(bounds(get(result, leaf.id)).left);
      expect(bounds(get(result, leaf.id)).right).toBeLessThan(bounds(get(result, "sink")).left);
    }
    expect(autoLayoutDiagram(result, edges)).toEqual(result);
  });

  it("handles a long connected chain with stable left-to-right ranks", () => {
    const nodes = Array.from({ length: 100 }, (_, index) => node(`node-${index}`));
    const edges = nodes.slice(1).map((next, index) => edge(nodes[index]!.id, next.id));
    const result = autoLayoutDiagram(nodes, edges);
    expectNonoverlap(result);
    for (const connection of edges) {
      expect(get(result, connection.source).position.x).toBeLessThan(
        get(result, connection.target).position.x,
      );
    }
  });

  it("sizes nested groups bottom-up, retains every child, and emits parents first", () => {
    const nodes = [
      node("deep", { parentId: "inner", measured: { width: 950, height: 420 } }),
      group("inner", { parentId: "middle" }),
      node("middle-leaf", { parentId: "middle", width: 430, height: 520 }),
      group("outer", { style: { width: 110, height: 100, opacity: 0.65, borderWidth: 3 } }),
      group("middle", { parentId: "outer" }),
      node("outer-leaf", { parentId: "outer", measured: { width: 510, height: 330 } }),
      node("outside", { width: 600, height: 460 }),
      group("empty"),
    ];
    const edges = [edge("deep", "middle-leaf"), edge("middle-leaf", "outer-leaf")];
    const result = autoLayoutDiagram(nodes, edges);
    expect(result).toHaveLength(nodes.length);
    expect(new Set(result.map((entry) => entry.id)).size).toBe(nodes.length);
    expectContained(result);
    expectNonoverlap(result);
    expect(Number(get(result, "inner").style?.width)).toBeGreaterThanOrEqual(950 + 64);
    expect(Number(get(result, "outer").style?.height)).toBeGreaterThan(100);
    expect(get(result, "outer").style).toMatchObject({ opacity: 0.65, borderWidth: 3 });
    for (const original of nodes) {
      expect(get(result, original.id).parentId).toBe(original.parentId);
      expect(get(result, original.id).data).toBe(original.data);
    }
    expect(autoLayoutDiagram(result, edges)).toEqual(result);
  });

  it("compacts oversized expanded nested groups and synchronizes measured dimensions idempotently", () => {
    const nodes = freeze([
      group("outer", {
        style: { width: 12000, height: "9000px", opacity: 0.65 },
        width: 14000,
        height: 11000,
        initialWidth: 16000,
        initialHeight: 13000,
        measured: { width: 15000, height: 12000 },
      }),
      group("inner", {
        parentId: "outer",
        style: { width: "6000px", height: 5000, borderRadius: 12 },
        width: 6500,
        height: 5500,
        initialWidth: 7500,
        initialHeight: 6500,
        measured: { width: 7000, height: 6000 },
      }),
      node("leaf", { parentId: "inner", measured: { width: 120, height: 60 } }),
    ]);
    const result = autoLayoutDiagram(nodes, []);
    const outer = get(result, "outer");
    const inner = get(result, "inner");
    expect(inner.style).toEqual({ width: 200, height: 150, borderRadius: 12 });
    expect(inner).toMatchObject({ width: 200, height: 150, measured: { width: 200, height: 150 } });
    expect(outer.style).toEqual({ width: 264, height: 238, opacity: 0.65 });
    expect(outer).toMatchObject({ width: 264, height: 238, measured: { width: 264, height: 238 } });
    expect(inner.measured).not.toBe(nodes[1]!.measured);
    expect(outer.measured).not.toBe(nodes[0]!.measured);
    expect(get(result, "leaf").measured).toBe(nodes[2]!.measured);
    expectContained(result);
    expectNonoverlap(result);
    const repeated = autoLayoutDiagram(freeze(result), []);
    expect(repeated).toEqual(result);
    expect(autoLayoutDiagram(freeze(repeated), [])).toEqual(result);
  });

  it.each([
    { style: {}, width: 200, height: 150 },
    { style: { minWidth: 640, minHeight: "420px" }, width: 640, height: 420 },
    { style: { minWidth: "550px", minHeight: 390 }, width: 550, height: 390 },
    { style: { minWidth: "360", minHeight: "240" }, width: 360, height: 240 },
    { style: { minWidth: 100, minHeight: "80px" }, width: 200, height: 150 },
    { style: { minWidth: "100%", minHeight: "calc(200px + 1rem)" }, width: 200, height: 150 },
    { style: { minWidth: NaN, minHeight: Infinity }, width: 200, height: 150 },
    { style: { minWidth: -10, minHeight: 0 }, width: 200, height: 150 },
  ])("applies expanded container minimum dimensions: $style", ({ style, width, height }) => {
    const result = autoLayoutDiagram(
      [group("empty", { style: { width: 9000, height: 8000, opacity: 0.5, ...style } })],
      [],
    );
    expect(get(result, "empty").style).toEqual({ ...style, width, height, opacity: 0.5 });
    expect(get(result, "empty")).toMatchObject({ width, height });
    expect(autoLayoutDiagram(result, [])).toEqual(result);
  });

  it("grows expanded groups beyond explicit minimum styles when content requires it", () => {
    const nodes = [
      group("g", {
        style: { width: 9000, height: 8000, minWidth: "300px", minHeight: 200 },
        measured: { width: 9000, height: 8000 },
      }),
      node("child", { parentId: "g", measured: { width: 760, height: 510 } }),
    ];
    const result = autoLayoutDiagram(nodes, []);
    expect(get(result, "g").style).toEqual({
      width: 824,
      height: 598,
      minWidth: "300px",
      minHeight: 200,
    });
    expect(get(result, "g").measured).toEqual({ width: 824, height: 598 });
    expectContained(result);
    expect(autoLayoutDiagram(result, [])).toEqual(result);
  });

  it("projects descendant edges onto sibling group representatives at every depth", () => {
    const nodes = [
      group("z-source"),
      group("z-nested", { parentId: "z-source" }),
      node("source", { parentId: "z-nested" }),
      group("a-target"),
      group("a-nested", { parentId: "a-target" }),
      node("target", { parentId: "a-nested" }),
      group("container"),
      group("z-inner-source", { parentId: "container" }),
      node("inner-source", { parentId: "z-inner-source" }),
      group("a-inner-target", { parentId: "container" }),
      node("inner-target", { parentId: "a-inner-target" }),
    ];
    const result = autoLayoutDiagram(nodes, [
      edge("source", "target"),
      edge("inner-source", "inner-target"),
    ]);
    expect(bounds(get(result, "z-source")).right).toBeLessThan(
      bounds(get(result, "a-target")).left,
    );
    expect(bounds(get(result, "z-inner-source")).right).toBeLessThan(
      bounds(get(result, "a-inner-target")).left,
    );
    expectContained(result);
    expectNonoverlap(result);
  });

  it("projects group-to-child and child-to-root edges without inventing ancestor ranks", () => {
    const nodes = [
      group("z-group"),
      node("child", { parentId: "z-group" }),
      node("a-root"),
      group("a-group"),
      node("other-child", { parentId: "a-group" }),
    ];
    const edges = [edge("z-group", "other-child"), edge("child", "a-root")];
    const result = autoLayoutDiagram(nodes, edges);
    expect(bounds(get(result, "z-group")).right).toBeLessThan(bounds(get(result, "a-group")).left);
    expect(bounds(get(result, "z-group")).right).toBeLessThan(bounds(get(result, "a-root")).left);
    expect(autoLayoutDiagram(nodes, [...edges, edge("z-group", "child")])).toEqual(result);
  });

  it("packs many disconnected nodes into multiple rows and columns", () => {
    const nodes = Array.from({ length: 49 }, (_, index) =>
      node(`isolated-${index}`, { measured: { width: 180, height: 100 } }),
    );
    const result = autoLayoutDiagram(nodes, []);
    expectNonoverlap(result);
    expect(new Set(result.map((entry) => entry.position.x)).size).toBeGreaterThan(2);
    expect(new Set(result.map((entry) => entry.position.y)).size).toBeGreaterThan(2);
    const width = Math.max(...result.map((entry) => bounds(entry).right));
    const height = Math.max(...result.map((entry) => bounds(entry).bottom));
    expect(width / height).toBeGreaterThan(0.4);
    expect(width / height).toBeLessThan(2.5);
  });

  it("packs disconnected multi-node components without breaking their internal ranks", () => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    for (let index = 0; index < 12; index += 1) {
      nodes.push(node(`s-${index}`, { width: 120 + index * 15, height: 80 }));
      nodes.push(node(`t-${index}`, { width: 310, height: 170 + index * 12 }));
      edges.push(edge(`s-${index}`, `t-${index}`));
    }
    const result = autoLayoutDiagram(nodes, edges);
    expectNonoverlap(result);
    for (const connection of edges) {
      expect(bounds(get(result, connection.source)).right).toBeLessThan(
        bounds(get(result, connection.target)).left,
      );
    }
  });

  it("handles directed cycles and ignores self, dangling, and parallel edges", () => {
    const nodes = [node("a"), node("b"), node("c"), node("isolated")];
    const edges = [edge("a", "b"), edge("b", "c"), edge("c", "a")];
    const result = autoLayoutDiagram(nodes, edges);
    const missingId = edge("a", "b");
    Reflect.deleteProperty(missingId, "id");
    const noisyEdges = [
      ...edges,
      edge("a", "a"),
      edge("missing", "a"),
      edge("a", "missing"),
      edge("a", "b", "parallel"),
      edge("b", "c", "parallel"),
      missingId,
    ];
    expect(autoLayoutDiagram(nodes, noisyEdges)).toEqual(result);
    expectNonoverlap(result);
    expect(autoLayoutDiagram(result, noisyEdges)).toEqual(result);
  });

  it("retains comments, their data, and their measured footprint inside and outside groups", () => {
    const nodes = [
      group("g"),
      node("service", { parentId: "g" }),
      node("note", {
        type: "comment",
        parentId: "g",
        data: { text: "Keep this annotation", color: "yellow", minimized: false },
        measured: { width: 720, height: 480 },
      }),
      node("root-note", { type: "comment", data: { text: "Unattached" } }),
      node("small-note", { type: "comment", data: { text: "Minimized", minimized: true } }),
    ];
    const result = autoLayoutDiagram(nodes, []);
    // Give unmeasured comments their documented fallback rectangles for this assertion.
    const rectangles = result.map((entry) =>
      entry.type === "comment" && !entry.measured
        ? { ...entry, width: 280, height: entry.data["minimized"] === true ? 80 : 180 }
        : entry,
    );
    expectContained(rectangles);
    expectNonoverlap(rectangles);
    expect(get(result, "note").data).toBe(nodes[2]!.data);
    expect(result.filter((entry) => entry.type === "comment")).toHaveLength(3);
  });

  it("uses compact collapsed footprints while preserving expanded size and child layout", () => {
    const nodes = [
      group("z-collapsed", {
        data: { label: "Collapsed", groupType: "cluster", collapsed: true },
        style: { width: 1600, height: 1100, opacity: 0.75 },
        width: 240,
        height: 190,
        measured: { width: 240, height: 190 },
      }),
      node("child", { parentId: "z-collapsed", width: 700, height: 510 }),
      node("a-after", { width: 310, height: 280 }),
    ];
    const edges = [edge("child", "a-after")];
    const result = autoLayoutDiagram(nodes, edges);
    const collapsed = get(result, "z-collapsed");
    const after = get(result, "a-after");
    expect(collapsed.style).toEqual({ width: 1600, height: 1100, opacity: 0.75 });
    expect(collapsed.measured).toEqual({ width: 240, height: 190 });
    expect(collapsed.width).toBe(1600);
    expect(collapsed.height).toBe(1100);
    expect(after.position.x - collapsed.position.x).toBe(COLLAPSED_GROUP_WIDTH + RANK_GAP);
    expect(get(result, "child").position).toEqual({ x: 32, y: 56 });
    expect(get(result, "child").extent).toBe("parent");
    expect(autoLayoutDiagram(result, edges)).toEqual(result);
    const expanded = result.map((entry) =>
      entry.id === collapsed.id ? { ...entry, data: { ...entry.data, collapsed: false } } : entry,
    );
    expectContained(expanded);
    expectContained(autoLayoutDiagram(expanded, edges));
  });

  it("resizes the stored expanded geometry even when its group is collapsed", () => {
    const nodes = [
      group("outer"),
      group("inner", {
        parentId: "outer",
        data: { label: "Inner", groupType: "subnet", collapsed: true },
        style: { width: "500px", height: "400px", borderWidth: 2 },
        measured: { width: 240, height: 190 },
      }),
      node("large-hidden-child", { parentId: "inner", width: 1300, height: 950 }),
      node("visible-sibling", { parentId: "outer" }),
    ];
    const result = autoLayoutDiagram(nodes, []);
    expect(get(result, "inner").style).toMatchObject({ width: 1364, height: 1038, borderWidth: 2 });
    expect(Number(get(result, "outer").style?.width)).toBeLessThan(1364);
    expectContained(result);
    expectNonoverlap(result);
    expect(autoLayoutDiagram(result, [])).toEqual(result);
  });

  it("does not treat collapsed measurements as expanded dimensions without stored styles", () => {
    const result = autoLayoutDiagram(
      [
        node("collapsed", {
          type: "group",
          data: { collapsed: true },
          measured: { width: COLLAPSED_GROUP_WIDTH, height: COLLAPSED_GROUP_HEIGHT },
        }),
      ],
      [],
    );
    expect(get(result, "collapsed").style).toEqual({ width: 400, height: 300 });
  });

  it("is pure, preserves data/styles/handles, and is deterministic and idempotent", () => {
    const nodes = freeze([
      group("g", {
        measured: { width: 400, height: 300 },
        style: { width: 400, height: 300, backgroundColor: "var(--group)", opacity: 0.5 },
      }),
      node("z", {
        parentId: "g",
        measured: { width: 800, height: 430 },
        style: { borderRadius: 14, opacity: 0.9 },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        data: { label: "Custom", metadata: { keep: "yes" } },
      }),
      node("a", { parentId: "g" }),
      node("root"),
    ]);
    const edges = freeze([
      { ...edge("z", "a"), sourceHandle: "right", targetHandle: "left", label: "Unchanged" },
      edge("a", "root"),
    ]);
    const originalNodes = structuredClone(nodes);
    const originalEdges = structuredClone(edges);
    const result = autoLayoutDiagram(nodes, edges);
    expect(nodes).toEqual(originalNodes);
    expect(edges).toEqual(originalEdges);
    expect(result).not.toBe(nodes);
    expect(get(result, "g").style).not.toBe(nodes[0]!.style);
    expect(get(result, "g").measured).not.toBe(nodes[0]!.measured);
    expect(get(result, "g").style).toMatchObject({ backgroundColor: "var(--group)", opacity: 0.5 });
    expect(get(result, "z").style).toBe(nodes[1]!.style);
    expect(get(result, "z").data).toBe(nodes[1]!.data);
    expect(get(result, "z").sourcePosition).toBe(Position.Bottom);
    expect(get(result, "z").targetPosition).toBe(Position.Top);
    expect(autoLayoutDiagram([...nodes].reverse(), [...edges].reverse())).toEqual(result);
    expect(autoLayoutDiagram(freeze(result), edges)).toEqual(result);
  });

  it("accounts for non-default node origins without overlap or containment drift", () => {
    const nodes = [
      group("g", { origin: [0.5, 0.5] }),
      node("a", { parentId: "g", origin: [0.5, 0.5], width: 570, height: 350 }),
      node("b", { parentId: "g", origin: [1, 1], width: 430, height: 280 }),
      node("outside", { origin: [0.5, 0.5] }),
    ];
    const edges = [edge("a", "b"), edge("b", "outside")];
    const result = autoLayoutDiagram(nodes, edges);
    expectContained(result);
    expectNonoverlap(result);
    expect(autoLayoutDiagram(result, edges)).toEqual(result);
  });

  it("does not loop or lose nodes on orphan, self-parent, or cyclic parent links", () => {
    const nodes = [
      group("a", { parentId: "b" }),
      group("b", { parentId: "a" }),
      node("child", { parentId: "b" }),
      node("orphan", { parentId: "missing" }),
      node("self", { parentId: "self" }),
    ];
    const result = autoLayoutDiagram(nodes, [edge("child", "orphan")]);
    expect(result.map((entry) => entry.id).sort()).toEqual(nodes.map((entry) => entry.id).sort());
    for (const original of nodes) {
      const laidOut = get(result, original.id);
      expect(laidOut.parentId).toBe(original.parentId);
      expect(laidOut.extent).toBe("parent");
      expect(Number.isFinite(laidOut.position.x) && Number.isFinite(laidOut.position.y)).toBe(true);
    }
    expect(autoLayoutDiagram(result, [edge("child", "orphan")])).toEqual(result);
  });
});
