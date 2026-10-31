import type { Edge, Node } from "@xyflow/react";

export type DiffStatus = "added" | "removed" | "modified" | "unchanged";

export interface DiagramSide {
  nodes: Node[];
  edges: Edge[];
}

export interface DiagramDiff {
  /** Every node from both sides, each tagged with how `after` differs from `before`. */
  nodes: { node: Node; status: DiffStatus }[];
  edges: { edge: Edge; status: DiffStatus }[];
  counts: { added: number; removed: number; modified: number };
}

function statusOf(before: { data?: unknown }, after: { data?: unknown } | undefined): DiffStatus {
  if (!after) {
    return "removed";
  }
  return JSON.stringify(before.data) === JSON.stringify(after.data) ? "unchanged" : "modified";
}

/** Compare two diagrams by node and edge id; content changes are changes to `data`. */
export function diffDiagrams(before: DiagramSide, after: DiagramSide): DiagramDiff {
  const afterNodes = new Map(after.nodes.map((node) => [node.id, node]));
  const afterEdges = new Map(after.edges.map((edge) => [edge.id, edge]));
  const beforeNodeIds = new Set(before.nodes.map((node) => node.id));
  const beforeEdgeIds = new Set(before.edges.map((edge) => edge.id));

  const nodes = [
    ...before.nodes.map((node) => ({ node, status: statusOf(node, afterNodes.get(node.id)) })),
    ...after.nodes
      .filter((node) => !beforeNodeIds.has(node.id))
      .map((node) => ({ node, status: "added" as const })),
  ];
  const edges = [
    ...before.edges.map((edge) => ({ edge, status: statusOf(edge, afterEdges.get(edge.id)) })),
    ...after.edges
      .filter((edge) => !beforeEdgeIds.has(edge.id))
      .map((edge) => ({ edge, status: "added" as const })),
  ];
  const count = (status: DiffStatus) => nodes.filter((entry) => entry.status === status).length;
  return {
    nodes,
    edges,
    counts: { added: count("added"), removed: count("removed"), modified: count("modified") },
  };
}
