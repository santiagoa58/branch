import type { Edge, Node } from "@xyflow/react";

type ConnectionFocus = "highlighted" | "dimmed";

/** Render-only edge metadata. Never written to the diagram store or serialized. */
export interface ConnectionFocusData {
  connectionFocus?: ConnectionFocus;
}

/** Focus direct connections to selected nodes, or to the contents of selected groups. */
export function focusConnections(
  nodes: Node[],
  edges: Edge[],
  selectedNodeId: string | null,
): Edge[] {
  const selected = new Set(
    nodes.filter((node) => node.selected || node.id === selectedNodeId).map((node) => node.id),
  );
  if (selected.size === 0) {
    return edges;
  }

  const children = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.parentId) {
      const siblings = children.get(node.parentId) ?? [];
      siblings.push(node.id);
      children.set(node.parentId, siblings);
    }
  }
  // A Set iterator also visits newly added descendants; visited ids bound nested traversal.
  for (const id of selected) {
    for (const child of children.get(id) ?? []) {
      selected.add(child);
    }
  }

  const raisedZIndex = Math.max(0, ...edges.map((edge) => edge.zIndex ?? 0)) + 1;
  return edges.map((edge) => {
    if (edge.hidden) {
      return edge;
    }
    const highlighted = selected.has(edge.source) || selected.has(edge.target);
    return {
      ...edge,
      ...(highlighted ? { zIndex: raisedZIndex } : {}),
      data: { ...edge.data, connectionFocus: highlighted ? "highlighted" : "dimmed" },
    };
  });
}
