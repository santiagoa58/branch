import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vite-plus/test";
import type {
  ApiOutput,
  ComponentsOutput,
  DataModelOutput,
  DecisionsOutput,
  DesignBrief,
  Endpoint,
  RequirementsOutput,
} from "@/schemas/aiDesign";
import { diagramDataSchema } from "@/schemas/diagram";
import type { NamedFlow } from "@/types/simulation";
import { inputsFingerprint } from "./fingerprint";
import { applyComponents, AI_FLOW_ID } from "./applyComponents";
import { applyRequirements } from "./applyRequirements";
import { applyApi, applyDataModel, applyDecision, unknownEndpointRefs } from "./applyResults";

const NOW = "2026-11-01T10:00:00.000Z";

function brief(overrides: Partial<DesignBrief> = {}): DesignBrief {
  return {
    inputs: {
      prompt: "A shared shopping list",
      scope: "fullstack",
      requirements: [{ id: "r1", kind: "functional", text: "Members share lists" }],
      outOfScope: [{ id: "o1", text: "Payments" }],
      answers: [],
    },
    questions: [],
    requirements: [],
    assumptions: [],
    outOfScope: [],
    ranFrom: {},
    ...overrides,
  };
}

describe("applyRequirements", () => {
  const output: RequirementsOutput = {
    questions: [],
    requirements: [
      { kind: "functional", text: "Members share lists " },
      { kind: "nonFunctional", text: "Sync within a second", category: "latency" },
    ],
    assumptions: [{ kind: "constraint", text: "Mobile web only" }],
    outOfScope: ["  payments", "Offline editing"],
  };

  it("drops derived items that duplicate a user line", () => {
    const result = applyRequirements(brief(), output);
    expect(result.requirements).toEqual([
      { kind: "nonFunctional", text: "Sync within a second", category: "latency" },
    ]);
    expect(result.outOfScope).toEqual(["Offline editing"]);
    expect(result.assumptions).toEqual(output.assumptions);
    expect(result.questions).toEqual([]);
  });

  it("sets only ranFrom.requirements", () => {
    const before = brief({ ranFrom: { components: "x", api: "y" } });
    const result = applyRequirements(before, output);
    expect(result.ranFrom).toEqual({
      components: "x",
      api: "y",
      requirements: inputsFingerprint(before.inputs),
    });
    expect(before.requirements).toEqual([]);
  });
});

const baseOutput: ComponentsOutput = {
  summary: "A list service with a cache.",
  groups: [],
  components: [
    { key: "web", type: "client", label: "Web app", responsibility: "Shows lists" },
    { key: "api", type: "gateway", label: "API", responsibility: "Serves lists" },
    { key: "db", type: "database", label: "Database", responsibility: "Stores lists" },
  ],
  connections: [
    { from: "web", to: "api", protocol: "http", purpose: "Fetch lists", async: false },
    { from: "api", to: "db", protocol: "sql", purpose: "Read rows", async: false },
  ],
  mainFlow: { name: "Open a list", description: "User opens a list", entry: "web" },
};

const nestedOutput: ComponentsOutput = {
  ...baseOutput,
  groups: [
    // Child declared before its parent on purpose.
    { key: "lists-svc", type: "cluster", label: "Lists service", parent: "backend" },
    { key: "backend", type: "vpc", label: "Backend" },
  ],
  components: [
    { key: "web", type: "client", label: "Web app", responsibility: "Shows lists" },
    {
      key: "api",
      type: "gateway",
      label: "API",
      responsibility: "Serves lists",
      group: "backend",
    },
    {
      key: "lists",
      type: "service",
      label: "Lists",
      responsibility: "Owns lists",
      group: "lists-svc",
    },
  ],
  connections: [{ from: "web", to: "api", protocol: "http", purpose: "Fetch", async: false }],
};

const comment: Node = {
  id: "note-1",
  type: "comment",
  position: { x: 5, y: 7 },
  data: { text: "Remember to revisit" },
};

const oldFlows: NamedFlow[] = [
  { id: "flow-ai-main", name: "Old", sourceNodeId: "web", createdAt: "2026-10-01T00:00:00.000Z" },
  { id: "flow-keep", name: "Keep", sourceNodeId: "web", createdAt: "2026-10-01T00:00:00.000Z" },
  { id: "flow-gone", name: "Gone", sourceNodeId: "removed", createdAt: "2026-10-01T00:00:00.000Z" },
  {
    id: "flow-badedge",
    name: "Bad edge",
    sourceNodeId: "web",
    edgeIds: ["nope"],
    createdAt: "2026-10-01T00:00:00.000Z",
  },
];

function current(over: { brief?: DesignBrief; flows?: NamedFlow[]; nodes?: Node[] } = {}) {
  return {
    nodes: over.nodes ?? [
      comment,
      {
        id: "old-node",
        type: "architecture",
        position: { x: 0, y: 0 },
        data: { label: "Old", type: "cache", decision: { choice: "Redis" } },
      } satisfies Node,
    ],
    edges: [{ id: "old-edge", source: "old-node", target: "old-node" }] as Edge[],
    flows: over.flows ?? oldFlows,
    brief: over.brief ?? brief({ ranFrom: { requirements: "r", decisions: "d" } }),
  };
}

function ok(result: ReturnType<typeof applyComponents>) {
  if (!result.ok) {
    throw new Error(`expected ok, got warnings: ${result.warnings.join("; ")}`);
  }
  return result;
}

const validates = (r: { nodes: Node[]; edges: Edge[]; flows: NamedFlow[] }) =>
  diagramDataSchema.parse({ nodes: r.nodes, edges: r.edges, flows: r.flows });

describe("applyComponents", () => {
  it("builds groups before children with parentId and extent parent", () => {
    const r = ok(applyComponents(current(), nestedOutput, NOW));
    const ids = r.nodes.map((n) => n.id);
    const parented = r.nodes.filter((n) => n.parentId !== undefined);
    expect(parented.map((n) => n.id).sort()).toEqual(["api", "lists", "lists-svc"]);
    for (const node of parented) {
      expect(ids.indexOf(node.parentId!), `${node.parentId} before ${node.id}`).toBeGreaterThan(-1);
      expect(ids.indexOf(node.parentId!)).toBeLessThan(ids.indexOf(node.id));
      expect(node.extent).toBe("parent");
    }
    expect(r.nodes.find((n) => n.id === "lists")).toMatchObject({
      parentId: "lists-svc",
      extent: "parent",
    });
    expect(r.nodes.find((n) => n.id === "lists-svc")).toMatchObject({
      type: "group",
      parentId: "backend",
      extent: "parent",
    });
    expect(r.nodes.find((n) => n.id === "web")?.parentId).toBeUndefined();
    expect(r.warnings).toEqual([]);
    expect(() => validates(r)).not.toThrow();
  });

  it("turns a comment inside a replaced (nested) group into a top-level comment", () => {
    const outer: Node = {
      id: "outer",
      type: "group",
      position: { x: 100, y: 200 },
      data: { label: "Outer", groupType: "vpc", collapsed: false },
    };
    const inner: Node = {
      id: "inner",
      type: "group",
      position: { x: 10, y: 20 },
      parentId: "outer",
      extent: "parent",
      data: { label: "Inner", groupType: "cluster", collapsed: false, parentId: "outer" },
    };
    const nested: Node = {
      id: "note-nested",
      type: "comment",
      position: { x: 1, y: 2 },
      parentId: "inner",
      extent: "parent",
      data: { text: "Inside", parentId: "inner" },
    };
    const r = ok(
      applyComponents(current({ nodes: [outer, inner, nested, comment] }), nestedOutput, NOW),
    );
    const moved = r.nodes.find((n) => n.id === "note-nested")!;
    expect(moved.position).toEqual({ x: 111, y: 222 });
    expect(moved.parentId).toBeUndefined();
    expect(moved.extent).toBeUndefined();
    expect(moved.data).toEqual({ text: "Inside" });
    expect(r.nodes.find((n) => n.id === "note-1")).toEqual(comment);
    expect(() => validates(r)).not.toThrow();
  });

  it("detaches a comment whose group key is reused, and keeps comment-in-comment", () => {
    const old: Node = {
      id: "backend",
      type: "group",
      position: { x: 50, y: 60 },
      data: { label: "Old backend", groupType: "vpc", collapsed: false },
    };
    const inOld: Node = {
      id: "note-a",
      type: "comment",
      position: { x: 5, y: 5 },
      parentId: "backend",
      extent: "parent",
      data: { text: "A", parentId: "backend" },
    };
    const inComment: Node = {
      id: "note-b",
      type: "comment",
      position: { x: 3, y: 3 },
      parentId: "note-a",
      extent: "parent",
      data: { text: "B", parentId: "note-a" },
    };
    const r = ok(applyComponents(current({ nodes: [old, inOld, inComment] }), nestedOutput, NOW));
    const a = r.nodes.find((n) => n.id === "note-a")!;
    expect(a.parentId).toBeUndefined();
    expect(a.position).toEqual({ x: 55, y: 65 });
    expect(r.nodes.find((n) => n.id === "note-b")).toEqual(inComment);
    expect(r.nodes.indexOf(a)).toBeLessThan(
      r.nodes.indexOf(r.nodes.find((n) => n.id === "note-b")!),
    );
  });

  it("builds components with description, empty attributes and no decision", () => {
    const r = ok(applyComponents(current(), baseOutput, NOW));
    const api = r.nodes.find((n) => n.id === "api");
    expect(api?.type).toBe("architecture");
    expect(api?.data).toMatchObject({
      label: "API",
      type: "gateway",
      description: "Serves lists",
      attributes: [],
    });
    expect(api?.data["decision"]).toBeUndefined();
    expect(r.nodes.find((n) => n.id === "old-node")).toBeUndefined();
  });

  it("builds edges with ids, protocol, label and async", () => {
    const r = ok(applyComponents(current(), baseOutput, NOW));
    expect(r.edges.map((e) => e.id)).toEqual(["ai-web-api-0", "ai-api-db-1"]);
    expect(r.edges[0]).toMatchObject({
      source: "web",
      target: "api",
      data: { protocol: "http", label: "Fetch lists", async: false },
    });
  });

  it("lays out generated nodes and appends comments untouched", () => {
    const r = ok(applyComponents(current(), nestedOutput, NOW));
    expect(r.nodes.at(-1)).toEqual(comment);
    const positions = r.nodes.filter((n) => n.type !== "comment").map((n) => n.position);
    expect(new Set(positions.map((p) => `${p.x},${p.y}`)).size).toBeGreaterThan(1);
  });

  it("keeps comment nodes and valid saved flows, replaces the AI flow", () => {
    const r = ok(applyComponents(current(), baseOutput, NOW));
    expect(r.nodes.filter((n) => n.type === "comment")).toEqual([comment]);
    expect(r.flows.map((f) => f.id)).toEqual(["flow-ai-main", "flow-keep"]);
    expect(r.flows[0]).toEqual({
      id: AI_FLOW_ID,
      name: "Open a list",
      description: "User opens a list",
      sourceNodeId: "web",
      color: "#3b82f6",
      speed: 1,
      createdAt: NOW,
    });
    expect(r.flows[1]).toBe(oldFlows[1]);
    expect(() => validates(r)).not.toThrow();
  });

  it("drops the old AI flow when the new entry is dropped", () => {
    const r = ok(
      applyComponents(
        current(),
        { ...baseOutput, mainFlow: { ...baseOutput.mainFlow, entry: "ghost" } },
        NOW,
      ),
    );
    expect(r.flows.map((f) => f.id)).toEqual(["flow-keep"]);
    expect(r.warnings).toEqual([`Dropped main flow "Open a list": "ghost" is not a component.`]);
  });

  it("stores the summary and ranFrom.components without touching other keys", () => {
    const before = current();
    const r = ok(applyComponents(before, baseOutput, NOW));
    expect(r.brief.summary).toBe(baseOutput.summary);
    expect(r.brief.ranFrom).toEqual({
      requirements: "r",
      decisions: "d",
      components: inputsFingerprint(before.brief.inputs),
    });
    expect(before.brief.summary).toBeUndefined();
  });

  const dupKeys: ComponentsOutput = {
    ...baseOutput,
    components: [
      ...baseOutput.components,
      { key: "api", type: "cache", label: "Dup", responsibility: "x" },
    ],
  };
  const commentCollision: ComponentsOutput = {
    ...baseOutput,
    components: [
      ...baseOutput.components,
      { key: "note-1", type: "cache", label: "Clash", responsibility: "x" },
    ],
  };
  const edgeToGroup: ComponentsOutput = {
    ...nestedOutput,
    connections: [{ from: "web", to: "backend", protocol: "http", purpose: "x", async: false }],
  };
  const selfLoop: ComponentsOutput = {
    ...baseOutput,
    connections: [{ from: "api", to: "api", protocol: "http", purpose: "x", async: false }],
  };
  const groupCycle: ComponentsOutput = {
    ...baseOutput,
    groups: [
      { key: "a", type: "vpc", label: "A", parent: "b" },
      { key: "b", type: "vpc", label: "B", parent: "a" },
    ],
    components: [{ ...baseOutput.components[0]!, group: "a" }, ...baseOutput.components.slice(1)],
  };
  const badFlow: ComponentsOutput = {
    ...baseOutput,
    mainFlow: { ...baseOutput.mainFlow, entry: "ghost" },
  };
  const unknownParent: ComponentsOutput = {
    ...baseOutput,
    groups: [{ key: "backend", type: "vpc", label: "Backend", parent: "nowhere" }],
  };
  const unknownGroup: ComponentsOutput = {
    ...baseOutput,
    components: [
      { ...baseOutput.components[0]!, group: "nowhere" },
      ...baseOutput.components.slice(1),
    ],
  };
  const unknownEndpoint: ComponentsOutput = {
    ...baseOutput,
    connections: [{ from: "a", to: "b", protocol: "http", purpose: "x", async: false }],
  };

  it.each([
    ["duplicate keys", dupKeys],
    ["comment id collision", commentCollision],
    ["group endpoint", edgeToGroup],
    ["self-loop", selfLoop],
    ["group cycle", groupCycle],
    ["unknown flow entry", badFlow],
    ["unknown group parent", unknownParent],
    ["unknown component group", unknownGroup],
    ["unknown connection endpoint", unknownEndpoint],
  ])("cleans %s with a warning", (_name, output) => {
    const r = ok(applyComponents(current(), output, NOW));
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(() => validates(r)).not.toThrow();
  });

  it("keeps the first of duplicate keys and drops colliding comment ids", () => {
    const dup = ok(applyComponents(current(), dupKeys, NOW));
    expect(dup.nodes.filter((n) => n.id === "api")).toHaveLength(1);
    expect(dup.nodes.find((n) => n.id === "api")?.data["label"]).toBe("API");
    const clash = ok(applyComponents(current(), commentCollision, NOW));
    expect(clash.nodes.filter((n) => n.id === "note-1")).toEqual([comment]);
  });

  it("detaches a cyclic group parent and an unknown one, keeping both groups", () => {
    const cyc = ok(applyComponents(current(), groupCycle, NOW));
    const parents = ["a", "b"].map((id) => cyc.nodes.find((n) => n.id === id)?.parentId);
    expect(parents.filter(Boolean)).toHaveLength(1);
    const unk = ok(applyComponents(current(), unknownParent, NOW));
    expect(unk.nodes.find((n) => n.id === "backend")?.parentId).toBeUndefined();
    expect(unk.warnings).toEqual([
      `Detached group "backend" from parent "nowhere": "nowhere" is not a group.`,
    ]);
  });

  it("names the dropped item in plain English", () => {
    expect(ok(applyComponents(current(), unknownEndpoint, NOW)).warnings).toEqual([
      `Dropped connection "a" → "b": "a" is not a component.`,
    ]);
    expect(ok(applyComponents(current(), edgeToGroup, NOW)).warnings).toEqual([
      `Dropped connection "web" → "backend": "backend" is not a component.`,
    ]);
    expect(ok(applyComponents(current(), selfLoop, NOW)).warnings).toEqual([
      `Dropped connection "api" → "api": a component cannot connect to itself.`,
    ]);
    expect(ok(applyComponents(current(), unknownGroup, NOW)).warnings).toEqual([
      `Moved component "web" to the top level: "nowhere" is not a group.`,
    ]);
  });

  it("returns ok:false when no components remain", () => {
    const result = applyComponents(
      current(),
      { ...baseOutput, components: [], connections: [] },
      NOW,
    );
    expect(result.ok).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe("stage 3 to 5 results", () => {
  const nodes: Node[] = [
    {
      id: "sync",
      type: "architecture",
      position: { x: 0, y: 0 },
      data: { label: "Sync", type: "queue" },
    },
    {
      id: "other",
      type: "architecture",
      position: { x: 0, y: 0 },
      data: { label: "Other", type: "gateway" },
    },
    comment,
  ];
  const decision: DecisionsOutput = {
    choice: "Queue",
    reason: "Decouple writes",
    gains: ["Resilience"],
    costs: ["Latency"],
    considered: [{ option: "Direct call", whyNot: "Couples services" }],
    revisitWhen: ["Traffic doubles"],
  };

  it("maps a decision onto DesignDecision fields", () => {
    const result = applyDecision(nodes, "sync", decision);
    expect(result.find((n) => n.id === "sync")?.data["decision"]).toEqual({
      choice: decision.choice,
      reason: decision.reason,
      benefits: decision.gains,
      drawbacks: decision.costs,
      considered: decision.considered,
      revisitWhen: decision.revisitWhen,
    });
    expect(result.find((n) => n.id === "sync")?.data).toMatchObject({
      label: "Sync",
      type: "queue",
    });
    expect(result.find((n) => n.id === "other")).toBe(nodes[1]);
    expect(nodes[0]!.data["decision"]).toBeUndefined();
  });

  it("leaves nodes unchanged for an unknown key", () => {
    expect(applyDecision(nodes, "ghost", decision)).toEqual(nodes);
  });

  it("writes to group nodes but never to a comment", () => {
    const group: Node = {
      id: "grp",
      type: "group",
      position: { x: 0, y: 0 },
      data: { label: "G", groupType: "vpc", collapsed: false },
    };
    const all = [...nodes, group];
    expect(
      applyDecision(all, "grp", decision).find((n) => n.id === "grp")?.data["decision"],
    ).toMatchObject({
      choice: "Queue",
    });
    const unchanged = applyDecision(all, "note-1", decision);
    expect(unchanged).toEqual(all);
    expect(unchanged.find((n) => n.id === "note-1")?.data).toEqual(comment.data);
  });

  const endpoint = (key: string, service: string, calledBy: string[]): Endpoint => ({
    key,
    service,
    calledBy,
    method: "GET",
    path: `/${key}`,
    summary: "s",
    auth: "none",
    style: "request",
    errors: [],
  });

  const apiOutput: ApiOutput = {
    endpoints: [
      endpoint("e1", "ghost", ["sync"]),
      endpoint("e2", "sync", ["ghost2"]),
      endpoint("e3", "sync", ["other"]),
    ],
    events: [
      { name: "ListChanged", producer: "sync", consumers: ["other"], payload: { id: "string" } },
    ],
  };

  it("stores api output and ranFrom.api", () => {
    const result = applyApi(brief({ ranFrom: { components: "c" } }), apiOutput, "fp");
    expect(result.api).toEqual({ endpoints: apiOutput.endpoints, events: apiOutput.events });
    expect(result.ranFrom).toEqual({ components: "c", api: "fp" });
  });

  it("stores data model output and ranFrom.dataModel", () => {
    const model: DataModelOutput = {
      entities: [
        {
          name: "List",
          store: "sync",
          fields: [{ name: "id", type: "uuid", key: "primary" }],
          relations: [],
        },
      ],
    };
    const result = applyDataModel(brief(), model, "fp2");
    expect(result.dataModel).toEqual({ entities: model.entities });
    expect(result.ranFrom).toEqual({ dataModel: "fp2" });
  });

  it("flags endpoints whose service or caller is unknown", () => {
    const withApi = applyApi(brief(), apiOutput, "fp");
    expect(unknownEndpointRefs(withApi, nodes)).toEqual(new Set(["e1", "e2"]));
    expect(unknownEndpointRefs(brief(), nodes)).toEqual(new Set());
  });
});
