import { describe, expect, it } from "vite-plus/test";
import type { Edge, Node } from "@xyflow/react";
import { tierIndex } from "@/constants/layoutTiers";
import { archEdge, archNode, groupNode } from "@/templates/builders";
import { DIAGRAM_TEMPLATES } from "@/templates";
import type { ArchitectureNodeType } from "@/types";
import { autoLayoutDiagram } from "./layout";
import { absoluteRects, type Rect } from "./layout/geometry";
import { collaborativeDocsDesign } from "./layout/layoutFixtures";
import { assignPorts } from "./layout/ports";
import { architectureTier } from "./layout/tiers";

function zone(node: Node): number | undefined {
  const tier = architectureTier(node);
  return tier === undefined ? undefined : tierIndex(tier);
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Zone index of a sibling: its own, or the earliest of the components inside it. */
function siblingZones(nodes: Node[]): Map<string, number> {
  const zones = new Map<string, number>();
  for (const node of [...nodes].reverse()) {
    const own = zone(node);
    const inner = nodes
      .filter((child) => child.parentId === node.id)
      .map((child) => zones.get(child.id))
      .filter((value) => value !== undefined);
    const candidates = own === undefined ? inner : [own, ...inner];
    if (candidates.length > 0) {
      zones.set(node.id, Math.min(...candidates));
    } else if (node.type === "group") {
      zones.set(node.id, tierIndex("services"));
    }
  }
  return zones;
}

function expectZonesInOrder(nodes: Node[]) {
  const rects = absoluteRects(nodes);
  const zones = siblingZones(nodes);
  const misplaced: string[] = [];
  for (const a of nodes) {
    for (const b of nodes) {
      const [za, zb] = [zones.get(a.id), zones.get(b.id)];
      if (
        a.parentId !== b.parentId ||
        a.parentId !== undefined ||
        za === undefined ||
        zb === undefined ||
        za >= zb
      ) {
        continue;
      }
      const left = rects.get(a.id)!;
      if (left.x + left.width > rects.get(b.id)!.x) {
        misplaced.push(`${a.id} (zone ${za}) is not left of ${b.id} (zone ${zb})`);
      }
    }
  }
  expect(misplaced).toEqual([]);
}

function expectWellFormed(nodes: Node[]) {
  const rects = absoluteRects(nodes);
  const index = new Map(nodes.map((node, position) => [node.id, position]));
  for (const node of nodes) {
    expect(node.position).toEqual({
      x: Math.round(node.position.x),
      y: Math.round(node.position.y),
    });
    if (node.parentId === undefined) {
      continue;
    }
    expect(index.get(node.parentId)!).toBeLessThan(index.get(node.id)!);
    expect(node.extent).toBe("parent");
    const parent = rects.get(node.parentId)!;
    const child = rects.get(node.id)!;
    expect(child.x).toBeGreaterThanOrEqual(parent.x);
    expect(child.y).toBeGreaterThanOrEqual(parent.y);
    expect(child.x + child.width).toBeLessThanOrEqual(parent.x + parent.width);
    expect(child.y + child.height).toBeLessThanOrEqual(parent.y + parent.height);
  }
  const overlapping: string[] = [];
  for (const a of nodes) {
    for (const b of nodes) {
      if (
        a.id < b.id &&
        a.parentId === b.parentId &&
        overlaps(rects.get(a.id)!, rects.get(b.id)!)
      ) {
        overlapping.push(`${a.id}/${b.id}`);
      }
    }
  }
  expect(overlapping).toEqual([]);
}

/** A deterministic pseudo-random diagram of the given size, spread over every zone. */
function generatedDiagram(nodeCount: number, edgeCount: number): { nodes: Node[]; edges: Edge[] } {
  const types: ArchitectureNodeType[] = [
    "webapp",
    "mobileapp",
    "cdn",
    "gateway",
    "loadbalancer",
    "service",
    "service",
    "auth",
    "service",
    "queue",
    "worker",
    "database",
    "cache",
    "storage",
    "search",
  ];
  let seed = 7;
  const random = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    return seed / 2_147_483_648;
  };
  const nodes = Array.from({ length: nodeCount }, (_, index) =>
    archNode(
      `n${String(index).padStart(2, "0")}`,
      types[index % types.length]!,
      `Node ${index}`,
      0,
      0,
    ),
  );
  const edges: Edge[] = [];
  const seen = new Set<string>();
  while (edges.length < edgeCount) {
    const source = Math.floor(random() * nodeCount);
    const target = Math.floor(random() * nodeCount);
    const key = `${source}-${target}`;
    if (source !== target && !seen.has(key)) {
      seen.add(key);
      edges.push(
        archEdge(`e${edges.length}`, nodes[source]!.id, nodes[target]!.id, {
          protocol: "http",
          label: `call ${edges.length}`,
        }),
      );
    }
  }
  return { nodes, edges };
}

describe("zoned auto layout", () => {
  it("places clients, edge, services, async and data from left to right", async () => {
    const { nodes, edges } = collaborativeDocsDesign();
    const result = await autoLayoutDiagram(nodes, edges);
    expectZonesInOrder(result.nodes);
    expectWellFormed(result.nodes);
    const rects = absoluteRects(result.nodes);
    const right = (id: string) => rects.get(id)!.x + rects.get(id)!.width;
    const left = (id: string) => rects.get(id)!.x;
    expect(right("editor")).toBeLessThan(left("lb"));
    expect(right("gateway")).toBeLessThan(left("docs"));
    expect(right("docs")).toBeLessThan(left("events"));
    expect(right("indexer")).toBeLessThan(left("search"));
  });

  it.each(DIAGRAM_TEMPLATES.map((template) => [template.id, template] as const))(
    "lays out the %s template in zones with every group around its children",
    async (_id, template) => {
      const result = await autoLayoutDiagram(template.data.nodes, template.data.edges);
      expect(result.nodes.map((node) => node.id).sort()).toEqual(
        template.data.nodes.map((node) => node.id).sort(),
      );
      expectZonesInOrder(result.nodes);
      expectWellFormed(result.nodes);
    },
  );

  it("keeps outer zones ordered while packing connected group contents by dependencies", async () => {
    const nodes = [
      groupNode("platform", "vpc", "Platform", 0, 0, 400, 300),
      archNode("db", "database", "Orders", 0, 0, { parentId: "platform" }),
      archNode("api", "service", "Orders API", 0, 0, { parentId: "platform" }),
      archNode("lb", "loadbalancer", "Ingress", 0, 0, { parentId: "platform" }),
      archNode("app", "webapp", "Shop", 0, 0),
      archNode("bucket", "storage", "Images", 0, 0),
    ];
    const edges = [
      archEdge("a", "app", "lb", { protocol: "http" }),
      archEdge("b", "lb", "api", { protocol: "http" }),
      archEdge("c", "api", "db", { protocol: "sql" }),
      archEdge("d", "api", "bucket", { protocol: "s3" }),
    ];
    const result = await autoLayoutDiagram(nodes, edges);
    expectZonesInOrder(result.nodes);
    expectWellFormed(result.nodes);
    expect(result.nodes.map((node) => node.id)).toEqual([
      "app",
      "bucket",
      "platform",
      "api",
      "db",
      "lb",
    ]);
  });

  it("is deterministic whatever the input order, and stable when run again", async () => {
    const { nodes, edges } = collaborativeDocsDesign();
    const first = await autoLayoutDiagram(nodes, edges);
    const shuffled = await autoLayoutDiagram([...nodes].reverse(), [...edges].reverse());
    expect(shuffled.nodes).toEqual(first.nodes);
    const again = await autoLayoutDiagram(first.nodes, first.edges);
    expect(again.nodes).toEqual(first.nodes);
    expect(again.edges).toBe(first.edges);
  });

  it("uses matching attachment handles after automatic layout", async () => {
    const { nodes, edges } = collaborativeDocsDesign();
    const result = await autoLayoutDiagram(
      nodes,
      edges.map((edge) => ({ ...edge, sourceHandle: "bottom", targetHandle: "top" })),
    );
    const validSources = new Set<string | null | undefined>([undefined, "left", "top", "bottom"]);
    const validTargets = new Set<string | null | undefined>([undefined, "right", "top", "bottom"]);
    for (const edge of result.edges) {
      expect(validSources.has(edge.sourceHandle)).toBe(true);
      expect(validTargets.has(edge.targetHandle)).toBe(true);
    }
    expect(assignPorts(result.nodes, result.edges)).toBe(result.edges);
  });

  it("chooses the nearest sides in either direction and preserves pinned sides", () => {
    const at = (id: string, x: number, y: number): Node => ({
      id,
      position: { x, y },
      data: {},
      measured: { width: 100, height: 100 },
    });
    const nodes = [
      at("a", 0, 0),
      at("right", 300, 0),
      at("left", -300, 0),
      at("below", 0, 300),
      at("above", 0, -300),
    ];
    const edges: Edge[] = [
      { id: "right", source: "a", target: "right" },
      { id: "left", source: "a", target: "left" },
      { id: "below", source: "a", target: "below" },
      { id: "above", source: "a", target: "above" },
      {
        id: "pinned",
        source: "a",
        target: "right",
        data: { sourceSide: "top", targetSide: "bottom" },
      },
    ];
    const result = assignPorts(nodes, edges);
    expect(result.map((edge) => [edge.sourceHandle, edge.targetHandle])).toEqual([
      [undefined, undefined],
      ["left", "right"],
      ["bottom", "top"],
      ["top", "bottom"],
      ["top", "bottom"],
    ]);
    expect(assignPorts(nodes, result)).toBe(result);
  });

  it("shelves comments under the zoned components of their container", async () => {
    const nodes = [
      groupNode("g", "vpc", "Private", 0, 0, 400, 300),
      archNode("api", "service", "API", 0, 0, { parentId: "g" }),
      archNode("db", "database", "DB", 0, 0, { parentId: "g" }),
      {
        id: "inner-note",
        type: "comment",
        parentId: "g",
        position: { x: 0, y: 0 },
        data: { text: "Inside" },
      },
      archNode("app", "webapp", "App", 0, 0),
      { id: "note", type: "comment", position: { x: 0, y: 0 }, data: { text: "Outside" } },
    ];
    const edges = [
      archEdge("a", "app", "api", { protocol: "http" }),
      archEdge("b", "api", "db", { protocol: "sql" }),
    ];
    const result = await autoLayoutDiagram(nodes, edges);
    const rects = absoluteRects(result.nodes);
    expectWellFormed(result.nodes);
    const bottom = (ids: string[]) =>
      Math.max(...ids.map((id) => rects.get(id)!.y + rects.get(id)!.height));
    expect(rects.get("note")!.y).toBeGreaterThan(bottom(["app", "g"]));
    expect(rects.get("inner-note")!.y).toBeGreaterThan(bottom(["api", "db"]));
    expect(result.nodes.find((node) => node.id === "note")!.data).toBe(nodes[5]!.data);
  });

  it("lays out a 60-node, 90-connection diagram well under a second", async () => {
    // Load the layout engine first; a cold start is a one-time cost per page.
    await autoLayoutDiagram([archNode("warm", "service", "Warm", 0, 0)], []);
    const { nodes, edges } = generatedDiagram(60, 90);
    const started = performance.now();
    const result = await autoLayoutDiagram(nodes, edges);
    const elapsed = performance.now() - started;
    // Shared CI runners with coverage instrumentation are not reliable benchmarks.
    expect(Boolean(process.env["CI"]) || elapsed < 1000).toBe(true);
    expect(result.nodes).toHaveLength(60);
    expectZonesInOrder(result.nodes);
    expectWellFormed(result.nodes);
  });
});
