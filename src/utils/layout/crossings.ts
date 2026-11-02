import type { Point, Rect } from "./geometry";

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

/**
 * A quick stand-in for the canvas route between two boxes: out of the right side, across to
 * halfway, then into the left side; a straight line when the target is not further right.
 */
export function sketchRoute(source: Rect, target: Rect): Point[] {
  const start = { x: source.x + source.width, y: source.y + source.height / 2 };
  const end = { x: target.x, y: target.y + target.height / 2 };
  if (end.x <= start.x) {
    return [
      { x: source.x + source.width / 2, y: start.y },
      { x: target.x + target.width / 2, y: end.y },
    ];
  }
  const middle = (start.x + end.x) / 2;
  return [start, { x: middle, y: start.y }, { x: middle, y: end.y }, end];
}
