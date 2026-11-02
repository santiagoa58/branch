import type { Edge, Node } from "@xyflow/react";
import { absoluteRects, type Rect } from "./geometry";

export type ConnectionSide = "left" | "right" | "top" | "bottom";
export type PortPreference = "auto" | ConnectionSide;

const SIDES: ConnectionSide[] = ["left", "right", "top", "bottom"];

function sidePreference(value: unknown): ConnectionSide | undefined {
  return SIDES.find((side) => side === value);
}

/** Select the facing pair with the shortest directional approach, in either direction. */
export function nearestSides(
  source: Rect,
  target: Rect,
): {
  source: ConnectionSide;
  target: ConnectionSide;
} {
  const dx = target.x + target.width / 2 - source.x - source.width / 2;
  const dy = target.y + target.height / 2 - source.y - source.height / 2;
  const horizontalGap = Math.max(0, Math.abs(dx) - (source.width + target.width) / 2);
  const verticalGap = Math.max(0, Math.abs(dy) - (source.height + target.height) / 2);
  const horizontal = horizontalGap > 0 && (verticalGap === 0 || Math.abs(dx) >= Math.abs(dy));
  const vertical = verticalGap > 0 && !horizontal;
  if (horizontal || (!vertical && Math.abs(dx) >= Math.abs(dy))) {
    if (dx >= 0) {
      return { source: "right", target: "left" };
    }
    return { source: "left", target: "right" };
  }
  if (dy >= 0) {
    return { source: "bottom", target: "top" };
  }
  return { source: "top", target: "bottom" };
}

/** React Flow's default output is right and its default input is left. */
const sourceHandle = (side: ConnectionSide) => (side === "right" ? undefined : side);
const targetHandle = (side: ConnectionSide) => (side === "left" ? undefined : side);

/** Derived geometry, overridden per endpoint by persistent user-selected preferences. */
export function assignPorts(nodes: Node[], edges: Edge[]): Edge[] {
  const rects = absoluteRects(nodes);
  let changed = false;
  const result = edges.map((edge) => {
    const source = rects.get(edge.source);
    const target = rects.get(edge.target);
    if (!source || !target || edge.source === edge.target) {
      return edge;
    }
    const facing = nearestSides(source, target);
    const s = sourceHandle(sidePreference(edge.data?.["sourceSide"]) ?? facing.source);
    const t = targetHandle(sidePreference(edge.data?.["targetSide"]) ?? facing.target);
    if (edge.sourceHandle === s && edge.targetHandle === t) {
      return edge;
    }
    changed = true;
    const { sourceHandle: _source, targetHandle: _target, ...rest } = edge;
    return {
      ...rest,
      ...(s === undefined ? {} : { sourceHandle: s }),
      ...(t === undefined ? {} : { targetHandle: t }),
    };
  });
  return changed ? result : edges;
}
