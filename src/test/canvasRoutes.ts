import { Position, type Edge, type Node, type XYPosition } from "@xyflow/react";
import { routeEdges, type EdgeEnds } from "@/utils/edgeRouting";
import { countCrossings } from "@/utils/layout/crossings";
import { absoluteRects, type Rect } from "@/utils/layout/geometry";

/**
 * Where React Flow puts a connection's ends: the middle of the right and left sides for the
 * default ports, or of the bottom and top for the stacked `bottom`/`top` ports.
 */
function edgeEnds(
  source: Rect,
  target: Rect,
  ports: Pick<Edge, "sourceHandle" | "targetHandle"> = {},
): EdgeEnds {
  const stacked = ports.sourceHandle === "bottom" && ports.targetHandle === "top";
  return stacked
    ? {
        sourceX: source.x + source.width / 2,
        sourceY: source.y + source.height,
        sourcePosition: Position.Bottom,
        targetX: target.x + target.width / 2,
        targetY: target.y,
        targetPosition: Position.Top,
      }
    : {
        sourceX: source.x + source.width,
        sourceY: source.y + source.height / 2,
        sourcePosition: Position.Right,
        targetX: target.x,
        targetY: target.y + target.height / 2,
        targetPosition: Position.Left,
      };
}

/** Each connection of a laid-out diagram, routed as the canvas routes it. */
function canvasRoutes(nodes: Node[], edges: Edge[]): Map<string, XYPosition[]> {
  const rects = absoluteRects(nodes);
  const obstacles = nodes
    .filter((node) => node.type !== "group")
    .map((node) => rects.get(node.id)!);
  const requests = edges.flatMap((edge) => {
    const source = rects.get(edge.source);
    const target = rects.get(edge.target);
    return source && target && edge.source !== edge.target
      ? [{ id: edge.id, ends: edgeEnds(source, target, edge) }]
      : [];
  });
  return new Map([...routeEdges(requests, obstacles)].map(([id, route]) => [id, route.points]));
}

/** Crossings between the connections of a laid-out diagram, as the canvas draws them. */
export function canvasCrossings(nodes: Node[], edges: Edge[]): number {
  return countCrossings([...canvasRoutes(nodes, edges).values()]);
}
