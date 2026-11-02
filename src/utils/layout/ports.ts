import type { Edge, Node } from "@xyflow/react";
import { absoluteRects } from "./geometry";

/** Named ports for a connection between stacked nodes; every other edge uses the side ports. */
const STACKED_PORTS = { sourceHandle: "bottom", targetHandle: "top" } as const;

function withoutPorts(edge: Edge): Edge {
  const { sourceHandle: _source, targetHandle: _target, ...rest } = edge;
  return rest;
}

/**
 * Pick each connection's ports from where layout put its endpoints, matching the left-to-right
 * flow: out of the right side and into the left (the default, unnamed ports) when the target is
 * further right, and bottom to top only when the target sits below without being to the right.
 * Edges that already use the right ports, and the array itself when nothing changes, are kept.
 */
export function assignPorts(nodes: Node[], edges: Edge[]): Edge[] {
  const rects = absoluteRects(nodes);
  let changed = false;
  const result = edges.map((edge) => {
    const source = rects.get(edge.source);
    const target = rects.get(edge.target);
    if (!source || !target || edge.source === edge.target) {
      return edge;
    }
    const forward = target.x >= source.x + source.width;
    const stacked = !forward && target.y >= source.y + source.height;
    if (stacked) {
      if (
        edge.sourceHandle === STACKED_PORTS.sourceHandle &&
        edge.targetHandle === STACKED_PORTS.targetHandle
      ) {
        return edge;
      }
      changed = true;
      return { ...edge, ...STACKED_PORTS };
    }
    if (edge.sourceHandle === undefined && edge.targetHandle === undefined) {
      return edge;
    }
    changed = true;
    return withoutPorts(edge);
  });
  return changed ? result : edges;
}
