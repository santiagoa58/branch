import type { Rect, XYPosition } from "@xyflow/react";

const LABEL_GAP = 8;
const MAX_CANDIDATES = 128;

function contains(rect: Rect, point: XYPosition): boolean {
  return (
    point.x > rect.x &&
    point.x < rect.x + rect.width &&
    point.y > rect.y &&
    point.y < rect.y + rect.height
  );
}

/** Find nearby free space for the entire label, not just its anchor point. */
export function placeEdgeLabel(preferred: XYPosition, label: Rect, obstacles: Rect[]): XYPosition {
  // Expand obstacles by the label's relative bounds so collision checks become
  // point tests. Asymmetric bounds also accommodate the optional decision badge.
  const blocked = obstacles
    .map((rect) => ({
      x: rect.x - label.x - label.width - LABEL_GAP,
      y: rect.y - label.y - label.height - LABEL_GAP,
      width: rect.width + label.width + LABEL_GAP * 2,
      height: rect.height + label.height + LABEL_GAP * 2,
    }))
    .sort((a, b) => a.x - b.x || a.y - b.y || a.width - b.width || a.height - b.height);
  if (!blocked.some((rect) => contains(rect, preferred))) {
    return preferred;
  }

  const distance = (point: XYPosition) =>
    (point.x - preferred.x) ** 2 + (point.y - preferred.y) ** 2;
  const compare = (a: XYPosition, b: XYPosition) =>
    distance(a) - distance(b) ||
    Math.abs(a.x - preferred.x) - Math.abs(b.x - preferred.x) ||
    a.y - b.y ||
    a.x - b.x;
  const candidates = [preferred];
  const seen = new Set<string>();
  for (let attempt = 0; attempt < MAX_CANDIDATES && candidates.length > 0; attempt += 1) {
    candidates.sort(compare);
    const point = candidates.shift()!;
    const collision = blocked.find((rect) => contains(rect, point));
    if (!collision) {
      return point;
    }
    for (const next of [
      { x: point.x, y: collision.y },
      { x: point.x, y: collision.y + collision.height },
      { x: collision.x, y: point.y },
      { x: collision.x + collision.width, y: point.y },
    ]) {
      const key = `${next.x},${next.y}`;
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push(next);
      }
    }
  }

  // Dense/overlapping diagrams must still leave labels readable. These four
  // positions sit outside the union of all obstacles and bound the search cost.
  return [
    { x: preferred.x, y: Math.min(...blocked.map((rect) => rect.y)) },
    { x: preferred.x, y: Math.max(...blocked.map((rect) => rect.y + rect.height)) },
    { x: Math.min(...blocked.map((rect) => rect.x)), y: preferred.y },
    { x: Math.max(...blocked.map((rect) => rect.x + rect.width)), y: preferred.y },
  ].sort(compare)[0]!;
}
