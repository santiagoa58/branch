import { describe, expect, it } from "vite-plus/test";
import { DIAGRAM_TEMPLATES, instantiateTemplate, type DiagramTemplate } from "@/templates";
import type { DiagramData, DiagramNode } from "@/types";
import { diagramDataSchema } from "./diagram";

function service(id: string, extra: Partial<DiagramNode> = {}): DiagramNode {
  return {
    id,
    type: "architecture",
    position: { x: 10, y: 20 },
    data: {
      label: id,
      type: "service",
      ...(extra.parentId === undefined ? {} : { parentId: extra.parentId }),
    },
    ...(extra.parentId === undefined ? {} : { extent: "parent" as const }),
    ...extra,
  };
}

function group(id: string, parentId?: string): DiagramNode {
  return {
    id,
    type: "group",
    position: { x: 30, y: 40 },
    style: { width: 400, height: 300 },
    zIndex: -1,
    data: { label: id, groupType: "vpc", ...(parentId === undefined ? {} : { parentId }) },
    ...(parentId === undefined ? {} : { parentId, extent: "parent" as const }),
  };
}

function load(nodes: DiagramNode[]): DiagramData {
  return diagramDataSchema.parse({ nodes, edges: [] });
}

function ids(data: DiagramData): string[] {
  return data.nodes.map((node) => node.id);
}

function nodeById(data: DiagramData, id: string): DiagramNode {
  const node = data.nodes.find((candidate) => candidate.id === id);
  if (!node) {
    throw new Error(`Expected node ${id}`);
  }
  return node;
}

/** Children whose parent is missing or listed after them; empty for a well-formed document. */
function misplacedChildren(data: DiagramData): string[] {
  const index = new Map(data.nodes.map((node, position) => [node.id, position]));
  return data.nodes
    .filter(
      (node, position) =>
        node.parentId !== undefined && !((index.get(node.parentId) ?? Infinity) < position),
    )
    .map((node) => `${node.id} -> ${node.parentId}`);
}

const catalogModules = import.meta.glob<Record<string, unknown>>("../templates/catalog/**/*.ts", {
  eager: true,
});

function isTemplate(value: unknown): value is DiagramTemplate {
  return typeof value === "object" && value !== null && "id" in value && "data" in value;
}

const catalogTemplates = [
  ...new Set(
    Object.values(catalogModules)
      .flatMap((module) => Object.values(module).flat())
      .filter(isTemplate),
  ),
];

// Every document that is already well formed: shipped templates (the catalog and the built-ins),
// the fresh instances the gallery loads, and a nested-group fixture.
const validDocuments: [string, DiagramData][] = [
  ...[...new Set([...catalogTemplates, ...DIAGRAM_TEMPLATES])].map(
    (template): [string, DiagramData] => [`template ${template.id}`, template.data],
  ),
  ...DIAGRAM_TEMPLATES.map((template): [string, DiagramData] => [
    `instance of ${template.id}`,
    instantiateTemplate(template),
  ]),
  [
    "nested groups listed parent-first",
    {
      nodes: [
        group("outer"),
        service("loose"),
        group("inner", "outer"),
        service("leaf", { parentId: "inner" }),
        {
          ...service("pinned", { parentId: "outer" }),
          extent: [
            [0, 0],
            [100, 100],
          ],
        },
      ],
      edges: [{ id: "e", source: "leaf", target: "loose" }],
      flows: [{ id: "f", name: "F", sourceNodeId: "leaf", createdAt: "2026-01-01T00:00:00.000Z" }],
    },
  ],
];

const damagedDocuments: [string, DiagramNode[]][] = [
  ["a dangling parent", [group("g"), service("child", { parentId: "gone" })]],
  ["a parent after its child", [service("child", { parentId: "g" }), service("x"), group("g")]],
  ["a two-node cycle", [group("a", "b"), group("b", "a"), service("c", { parentId: "a" })]],
  ["a self parent", [group("self", "self")]],
  [
    "nested groups listed children-first",
    [service("leaf", { parentId: "inner" }), group("inner", "outer"), group("outer")],
  ],
];

describe("diagram load repairs the group hierarchy", () => {
  it("detaches a dangling parent and keeps the stored position", () => {
    const loaded = load([
      group("g"),
      service("child", { parentId: "gone" }),
      {
        ...service("pinned", { parentId: "gone" }),
        extent: [
          [0, 0],
          [50, 50],
        ],
      },
    ]);
    const child = nodeById(loaded, "child");
    expect(child).not.toHaveProperty("parentId");
    expect(child).not.toHaveProperty("extent");
    expect(child.data).not.toHaveProperty("parentId");
    expect(child.position).toEqual({ x: 10, y: 20 });
    // Only the `parent` extent depends on a parent; a coordinate extent stays.
    expect(nodeById(loaded, "pinned").extent).toEqual([
      [0, 0],
      [50, 50],
    ]);
    expect(nodeById(loaded, "pinned")).not.toHaveProperty("parentId");
    expect(ids(loaded)).toEqual(["g", "child", "pinned"]);
  });

  it("opens a document damaged by the old merge bug", () => {
    // Merge used to rename the group to imported-…-g but leave the child pointing at "g".
    const loaded = load([group("imported-1-g"), service("imported-1-child", { parentId: "g" })]);
    expect(misplacedChildren(loaded)).toEqual([]);
    expect(nodeById(loaded, "imported-1-child")).not.toHaveProperty("parentId");
  });

  it("moves a parent listed after its child ahead of it", () => {
    const loaded = load([service("child", { parentId: "g" }), service("x"), group("g")]);
    expect(ids(loaded)).toEqual(["g", "child", "x"]);
    expect(nodeById(loaded, "child").parentId).toBe("g");
    expect(nodeById(loaded, "child").extent).toBe("parent");
  });

  it("reorders nested groups parent-first and keeps unrelated nodes in order", () => {
    const loaded = load([
      service("n1"),
      service("leaf", { parentId: "inner" }),
      service("n2"),
      group("inner", "outer"),
      group("outer"),
      service("n3"),
    ]);
    expect(ids(loaded)).toEqual(["n1", "outer", "inner", "leaf", "n2", "n3"]);
    expect(misplacedChildren(loaded)).toEqual([]);
    expect(nodeById(loaded, "inner").parentId).toBe("outer");
    expect(nodeById(loaded, "leaf").parentId).toBe("inner");
  });

  it("breaks a parent cycle at the member listed first", () => {
    const loaded = load([group("a", "b"), group("b", "a"), service("c", { parentId: "a" })]);
    expect(nodeById(loaded, "a")).not.toHaveProperty("parentId");
    expect(nodeById(loaded, "a")).not.toHaveProperty("extent");
    expect(nodeById(loaded, "a").data).not.toHaveProperty("parentId");
    expect(nodeById(loaded, "b").parentId).toBe("a");
    expect(nodeById(loaded, "c").parentId).toBe("a");
    expect(ids(loaded)).toEqual(["a", "b", "c"]);
  });

  it("breaks a longer cycle deterministically, wherever the walk starts", () => {
    const loaded = load([group("z", "x"), group("x", "y"), group("y", "z")]);
    expect(nodeById(loaded, "z")).not.toHaveProperty("parentId");
    expect(nodeById(loaded, "y").parentId).toBe("z");
    expect(nodeById(loaded, "x").parentId).toBe("y");
    expect(ids(loaded)).toEqual(["z", "y", "x"]);
  });

  it("detaches a node that is its own parent", () => {
    const loaded = load([group("self", "self")]);
    expect(nodeById(loaded, "self")).not.toHaveProperty("parentId");
    expect(nodeById(loaded, "self")).not.toHaveProperty("extent");
  });

  it("keeps a parent that is not a group, which the schema already accepts", () => {
    const nodes = [service("host"), service("child", { parentId: "host" })];
    expect(load(nodes).nodes).toEqual(nodes);
  });

  it.each(damagedDocuments)("is idempotent for %s", (_name, nodes) => {
    const once = load(nodes);
    expect(misplacedChildren(once)).toEqual([]);
    expect(diagramDataSchema.parse(once)).toEqual(once);
  });

  it.each(damagedDocuments)("does not mutate the input with %s", (_name, nodes) => {
    const input = { nodes, edges: [] };
    const before = structuredClone(input);
    diagramDataSchema.parse(input);
    expect(input).toEqual(before);
  });

  it("covers every catalog template", () => {
    expect(catalogTemplates.length).toBeGreaterThan(0);
    const catalogIds = new Set(catalogTemplates.map((template) => template.id));
    expect(DIAGRAM_TEMPLATES.filter((template) => catalogIds.has(template.id))).toHaveLength(
      catalogIds.size,
    );
  });

  it.each(validDocuments)("leaves the already valid %s unchanged", (_name, document) => {
    expect(misplacedChildren(document)).toEqual([]);
    const before = structuredClone(document);
    expect(diagramDataSchema.parse(document)).toStrictEqual(document);
    expect(document).toStrictEqual(before);
  });
});
