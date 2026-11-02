import type { Point, Rect } from "./geometry";
import { nearestSides, type ConnectionSide } from "./ports";

function orientation(a: Point, b: Point, c: Point): number {
  return Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
}

/** Proper crossings only: touching, shared endpoints and collinear overlaps do not count. */
function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const abc = orientation(a, b, c);
  const abd = orientation(a, b, d);
  const cda = orientation(c, d, a);
  const cdb = orientation(c, d, b);
  return abc * abd < 0 && cda * cdb < 0;
}

/**
 * Number of points where two different routes cross, for orthogonal or straight segments.
 * Routes that share an end or run along each other do not cross. Pure.
 */
export function countCrossings(routes: readonly (readonly Point[])[]): number {
  let crossings = 0;
  for (let i = 0; i < routes.length; i += 1) {
    for (let j = i + 1; j < routes.length; j += 1) {
      crossings += routeCrossings(routes[i]!, routes[j]!);
    }
  }
  return crossings;
}

function routeCrossings(first: readonly Point[], second: readonly Point[]): number {
  let crossings = 0;
  for (let p = 1; p < first.length; p += 1) {
    for (let q = 1; q < second.length; q += 1) {
      if (segmentsCross(first[p - 1]!, first[p]!, second[q - 1]!, second[q]!)) {
        crossings += 1;
      }
    }
  }
  return crossings;
}

/** Anchor at the center of the chosen node side for crossing minimization. */
function sideCenter(rect: Rect, side: ConnectionSide): Point {
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;
  if (side === "left") {
    return { x: rect.x, y: centerY };
  }
  if (side === "right") {
    return { x: rect.x + rect.width, y: centerY };
  }
  if (side === "top") {
    return { x: centerX, y: rect.y };
  }
  return { x: centerX, y: rect.y + rect.height };
}

/** Score the same facing sides the rendered connections will choose, not fixed east/west ports. */
export function sketchRoute(source: Rect, target: Rect): Point[] {
  const sides = nearestSides(source, target);
  const start = sideCenter(source, sides.source);
  const end = sideCenter(target, sides.target);
  if (sides.source === "left" || sides.source === "right") {
    const middle = (start.x + end.x) / 2;
    return [start, { x: middle, y: start.y }, { x: middle, y: end.y }, end];
  }
  const middle = (start.y + end.y) / 2;
  return [start, { x: start.x, y: middle }, { x: end.x, y: middle }, end];
}
