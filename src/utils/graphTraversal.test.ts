import type { Edge, Node } from "@xyflow/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  computeBlastRadius,
  computePartition,
  getConnectedEdges,
  getIncomingEdges,
  getOutgoingEdges,
  selectRandomTargets,
  traceFlowPath,
} from "./graphTraversal";

const architectureNode = (id: string): Node => ({
  id,
  type: "architecture",
  position: { x: 0, y: 0 },
  data: { label: id, type: "service" },
});

const otherNode = (id: string): Node => ({
  id,
  type: "group",
  position: { x: 0, y: 0 },
  data: { label: id, groupType: "vpc" },
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("edge selectors", () => {
  const edges = [edge("incoming", "a", "b"), edge("outgoing", "b", "c"), edge("other", "x", "y")];

  it("distinguishes connected, incoming, and outgoing edges", () => {
    expect(getConnectedEdges("b", edges).map((item) => item.id)).toEqual(["incoming", "outgoing"]);
    expect(getIncomingEdges("b", edges).map((item) => item.id)).toEqual(["incoming"]);
    expect(getOutgoingEdges("b", edges).map((item) => item.id)).toEqual(["outgoing"]);
    expect(getConnectedEdges("missing", edges)).toEqual([]);
  });
});

describe("traceFlowPath", () => {
  it("traces branching and merging paths by BFS without repeating nodes or edges", () => {
    const edges = [
      edge("a-b", "a", "b", { protocol: "http", latencyMs: 10 }),
      edge("a-c", "a", "c", { protocol: 123, latencyMs: "slow" }),
      edge("b-d", "b", "d", { protocol: "grpc", latencyMs: 80 }),
      edge("c-d", "c", "d", { protocol: "websocket", latencyMs: 30 }),
      edge("d-a", "d", "a"),
      edge("x-c", "x", "c", { bidirectional: true, protocol: "sql", latencyMs: 50 }),
      edge("y-b", "y", "b", { bidirectional: false }),
    ];

    const path = traceFlowPath([], edges, "a");

    expect(path.nodeIds).toEqual(["a", "b", "c", "d", "x"]);
    expect(path.edgeIds).toEqual(["a-b", "a-c", "b-d", "c-d", "x-c", "d-a"]);
    expect(path.steps).toEqual([
      { edgeId: "a-b", fromNodeId: "a", toNodeId: "b", protocol: "http", latencyMs: 10 },
      { edgeId: "a-c", fromNodeId: "a", toNodeId: "c" },
      { edgeId: "b-d", fromNodeId: "b", toNodeId: "d", protocol: "grpc", latencyMs: 80 },
      { edgeId: "c-d", fromNodeId: "c", toNodeId: "d", protocol: "websocket", latencyMs: 30 },
      { edgeId: "x-c", fromNodeId: "c", toNodeId: "x", protocol: "sql", latencyMs: 50 },
      { edgeId: "d-a", fromNodeId: "d", toNodeId: "a" },
    ]);
    expect(
      path.levels?.map((level) => ({
        depth: level.depth,
        edgeIds: level.steps.map((step) => step.edgeId),
      })),
    ).toEqual([
      { depth: 0, edgeIds: ["a-b", "a-c"] },
      { depth: 1, edgeIds: ["b-d", "c-d", "x-c"] },
      { depth: 2, edgeIds: ["d-a"] },
    ]);
  });

  it("returns an isolated source with no traversal levels", () => {
    expect(traceFlowPath([], [], "isolated")).toEqual({
      nodeIds: ["isolated"],
      edgeIds: [],
      steps: [],
      levels: [],
    });
  });

  it("provides validated metadata for latency, bottleneck, protocol, and branch statistics", () => {
    const path = traceFlowPath(
      [],
      [
        edge("fast", "source", "left", { protocol: "http", latencyMs: 12 }),
        edge("slow", "source", "right", { protocol: "grpc", latencyMs: 90 }),
        edge("invalid", "right", "sink", { protocol: false, latencyMs: null }),
      ],
      "source",
    );

    const measuredSteps = path.steps.filter(
      (step): step is typeof step & { latencyMs: number } => typeof step.latencyMs === "number",
    );
    const totalLatencyMs = measuredSteps.reduce((total, step) => total + step.latencyMs, 0);
    const bottleneck = measuredSteps.reduce<(typeof measuredSteps)[number] | undefined>(
      (current, step) =>
        current === undefined || step.latencyMs > current.latencyMs ? step : current,
      undefined,
    );
    const protocols = path.steps.flatMap((step) =>
      step.protocol === undefined ? [] : [step.protocol],
    );
    const branchIds = new Set(
      path.levels?.flatMap((level) => level.steps.map((step) => step.branchId)) ?? [],
    );

    expect(path.steps).toHaveLength(3);
    expect(totalLatencyMs).toBe(102);
    expect(bottleneck?.edgeId).toBe("slow");
    expect(protocols).toEqual(["http", "grpc"]);
    expect(branchIds.size).toBe(3);
  });
});

describe("computeBlastRadius", () => {
  it("builds cascade levels across branches and merges while including every impacted edge", () => {
    const edges = [
      edge("f-a", "failed", "a"),
      edge("f-b", "failed", "b"),
      edge("a-c", "a", "c"),
      edge("b-c", "b", "c"),
      edge("c-d", "c", "d"),
      edge("d-f", "d", "failed"),
      edge("upstream-f", "upstream", "failed"),
      edge("upstream-a", "upstream", "a"),
      edge("unrelated", "x", "y"),
    ];

    const blast = computeBlastRadius([], edges, ["failed"]);

    expect(blast.affectedNodeIds).toEqual(["a", "b", "c", "d"]);
    expect(blast.brokenEdgeIds).toEqual([
      "f-a",
      "f-b",
      "a-c",
      "b-c",
      "c-d",
      "d-f",
      "upstream-f",
      "upstream-a",
    ]);
    expect(blast.levels).toEqual([
      { depth: 0, nodeIds: ["a", "b"], edgeIds: ["f-a", "f-b"] },
      { depth: 1, nodeIds: ["c"], edgeIds: ["a-c", "b-c"] },
      { depth: 2, nodeIds: ["d"], edgeIds: ["c-d"] },
      { depth: 3, nodeIds: [], edgeIds: ["d-f"] },
    ]);
  });

  it("deduplicates cascade edges for duplicate failure inputs", () => {
    const blast = computeBlastRadius([], [edge("f-a", "failed", "a")], ["failed", "failed"]);

    expect(blast.affectedNodeIds).toEqual(["a"]);
    expect(blast.levels).toEqual([{ depth: 0, nodeIds: ["a"], edgeIds: ["f-a"] }]);
  });

  it("handles no failures and isolated failures", () => {
    expect(computeBlastRadius([], [edge("a-b", "a", "b")], [])).toEqual({
      affectedNodeIds: [],
      brokenEdgeIds: [],
      levels: [],
    });
    expect(computeBlastRadius([], [], ["isolated"])).toEqual({
      affectedNodeIds: [],
      brokenEdgeIds: [],
      levels: [],
    });
  });
});

describe("selectRandomTargets", () => {
  it("selects only eligible architecture nodes and respects the maximum", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const nodes = [
      architectureNode("eligible-a"),
      architectureNode("eligible-b"),
      architectureNode("protected"),
      architectureNode("failed"),
      otherNode("group"),
    ];

    const selected = selectRandomTargets(nodes, 1, 2, ["protected"], ["failed"]);

    expect(selected).toHaveLength(2);
    expect(new Set(selected)).toEqual(new Set(["eligible-a", "eligible-b"]));
  });

  it("falls back to one eligible node when probability selects none", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);

    expect(selectRandomTargets([architectureNode("only")], 0.1, 3, [], [])).toEqual(["only"]);
  });

  it("returns nothing when no target is eligible or the maximum is zero", () => {
    expect(selectRandomTargets([otherNode("group")], 1, 2, [], [])).toEqual([]);
    expect(selectRandomTargets([architectureNode("only")], 1, 0, [], [])).toEqual([]);
  });
});

describe("computePartition", () => {
  it("returns a trivial result for fewer than two architecture nodes", () => {
    expect(computePartition([architectureNode("only"), otherNode("group")], [], [])).toEqual({
      groupA: ["only"],
      groupB: [],
      severedEdgeIds: [],
    });
  });

  it("does not sever an edge whose endpoints are both protected", () => {
    const nodes = [architectureNode("a"), architectureNode("b")];

    expect(computePartition(nodes, [edge("a-b", "a", "b")], ["a", "b"])).toEqual({
      groupA: ["a", "b"],
      groupB: [],
      severedEdgeIds: [],
    });
  });

  it("severs a bridge and reports the resulting Union-Find components", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const nodes = [architectureNode("a"), architectureNode("b")];

    const partition = computePartition(nodes, [edge("bridge", "a", "b")], []);

    expect(partition.severedEdgeIds).toEqual(["bridge"]);
    expect(new Set(partition.groupA)).toEqual(new Set(["a"]));
    expect(new Set(partition.groupB)).toEqual(new Set(["b"]));
  });

  it("forces two groups when a severed cycle edge leaves the graph connected", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const nodes = [architectureNode("a"), architectureNode("b"), architectureNode("c")];
    const edges = [edge("a-b", "a", "b"), edge("b-c", "b", "c"), edge("c-a", "c", "a")];

    const partition = computePartition(nodes, edges, []);

    expect(partition.severedEdgeIds).toHaveLength(1);
    expect(partition.groupA).toEqual(["a", "b"]);
    expect(partition.groupB).toEqual(["c"]);
  });

  it("merges non-severed components using Union-Find rank and path compression", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const protectedIds = ["p1", "p2", "p3", "p4", "p5", "p6", "p7"];
    const nodes = [
      ...protectedIds.map(architectureNode),
      architectureNode("u"),
      architectureNode("v"),
    ];
    const edges = [
      edge("p1-p2", "p1", "p2"),
      edge("p3-p4", "p3", "p4"),
      edge("p1-p3", "p1", "p3"),
      edge("p5-p6", "p5", "p6"),
      edge("p5-p1", "p5", "p1"),
      edge("p1-p7", "p1", "p7"),
      edge("p2-p4", "p2", "p4"),
      edge("u-v", "u", "v"),
    ];

    const partition = computePartition(nodes, edges, protectedIds);

    expect(partition.severedEdgeIds).toEqual(["u-v"]);
    expect(new Set(partition.groupA)).toEqual(new Set(protectedIds));
    expect(new Set(partition.groupB)).toEqual(new Set(["u", "v"]));
  });
});
