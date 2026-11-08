import { getSmoothStepPath, Position, type Rect, type XYPosition } from "@xyflow/react";
import { separateChannels } from "./edgeChannels";

/** Where a connection leaves its source and enters its target, as React Flow reports it. */
export interface EdgeEnds {
  sourceX: number;
  sourceY: number;
  sourcePosition: Position;
  targetX: number;
  targetY: number;
  targetPosition: Position;
}

export interface EdgeRoute {
  /** Corners of the orthogonal path, from the source port to the target port. */
  points: XYPosition[];
  labelX: number;
  labelY: number;
}

/** Straight run out of a port before the first turn. */
const PORT_RUN = 20;
const CORNER_RADIUS = 8;
/** Room a run keeps from the nodes it passes. */
const CLEARANCE = 12;

function overlaps(a1: number, a2: number, b1: number, b2: number): boolean {
  return Math.max(Math.min(a1, a2), b1) < Math.min(Math.max(a1, a2), b2);
}

function blocksHorizontal(rect: Rect, y: number, x1: number, x2: number): boolean {
  return (
    y > rect.y - CLEARANCE / 2 &&
    y < rect.y + rect.height + CLEARANCE / 2 &&
    overlaps(x1, x2, rect.x, rect.x + rect.width)
  );
}

function blocksVertical(rect: Rect, x: number, y1: number, y2: number): boolean {
  return (
    x > rect.x - CLEARANCE &&
    x < rect.x + rect.width + CLEARANCE &&
    overlaps(y1, y2, rect.y, rect.y + rect.height)
  );
}

function touches(rect: Rect, point: XYPosition): boolean {
  return (
    point.x >= rect.x - 1 &&
    point.x <= rect.x + rect.width + 1 &&
    point.y >= rect.y - 1 &&
    point.y <= rect.y + rect.height + 1
  );
}

interface Corridor {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  low: number;
  high: number;
  obstacles: Rect[];
}

const clearHorizontal = (c: Corridor, y: number, x1: number, x2: number) =>
  c.obstacles.every((rect) => !blocksHorizontal(rect, y, x1, x2));
const clearVertical = (c: Corridor, x: number, y1: number, y2: number) =>
  c.obstacles.every((rect) => !blocksVertical(rect, x, y1, y2));

/** Candidate turn positions: halfway first, then just beside each node, nearest first. */
function turnCandidates(c: Corridor, prefer: number): number[] {
  return [
    ...new Set([
      prefer,
      c.low,
      c.high,
      ...c.obstacles.flatMap((rect) => [
        rect.x - CLEARANCE * 2,
        rect.x + rect.width + CLEARANCE * 2,
      ]),
    ]),
  ]
    .filter((x) => x >= c.low && x <= c.high)
    .sort((a, b) => Math.abs(a - prefer) - Math.abs(b - prefer) || a - b);
}

/** One turn: across, then up or down, then across into the target. */
function singleTurn(c: Corridor): XYPosition[] | undefined {
  const turn = turnCandidates(c, (c.low + c.high) / 2).find(
    (x) =>
      clearHorizontal(c, c.sy, c.sx, x) &&
      clearVertical(c, x, c.sy, c.ty) &&
      clearHorizontal(c, c.ty, x, c.tx),
  );
  return turn === undefined
    ? undefined
    : [
        { x: c.sx, y: c.sy },
        { x: turn, y: c.sy },
        { x: turn, y: c.ty },
        { x: c.tx, y: c.ty },
      ];
}

/**
 * Two turns through a free row, for a connection that crosses columns of nodes: leave in the
 * first gap, run along a row no node occupies, and come back in the last gap.
 */
function detour(c: Corridor): XYPosition[] | undefined {
  const rows = [
    ...new Set(
      c.obstacles.flatMap((rect) => [rect.y - CLEARANCE * 2, rect.y + rect.height + CLEARANCE * 2]),
    ),
  ].sort(
    (a, b) =>
      Math.min(Math.abs(a - c.sy), Math.abs(a - c.ty)) -
        Math.min(Math.abs(b - c.sy), Math.abs(b - c.ty)) || a - b,
  );
  const exits = turnCandidates(c, c.low);
  const entries = turnCandidates(c, c.high);
  for (const row of rows) {
    const exit = exits.find(
      (x) => clearHorizontal(c, c.sy, c.sx, x) && clearVertical(c, x, c.sy, row),
    );
    const entry = entries.find(
      (x) =>
        exit !== undefined &&
        x > exit &&
        clearVertical(c, x, row, c.ty) &&
        clearHorizontal(c, c.ty, x, c.tx) &&
        clearHorizontal(c, row, exit, x),
    );
    if (exit !== undefined && entry !== undefined) {
      return [
        { x: c.sx, y: c.sy },
        { x: exit, y: c.sy },
        { x: exit, y: row },
        { x: entry, y: row },
        { x: entry, y: c.ty },
        { x: c.tx, y: c.ty },
      ];
    }
  }
  return undefined;
}

function isForward(ends: EdgeEnds): boolean {
  return (
    ends.sourcePosition === Position.Right &&
    ends.targetPosition === Position.Left &&
    ends.targetX - ends.sourceX > PORT_RUN * 2
  );
}

/** React Flow's own smooth step corners, for connections that do not run left to right. */
function smoothStepPoints(ends: EdgeEnds): EdgeRoute {
  const [path, labelX, labelY] = getSmoothStepPath({ ...ends, borderRadius: 0, offset: PORT_RUN });
  const numbers = (path.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g) ?? []).map(Number);
  const points: XYPosition[] = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    const point = { x: numbers[index]!, y: numbers[index + 1]! };
    const last = points.at(-1);
    if (!last || last.x !== point.x || last.y !== point.y) {
      points.push(point);
    }
  }
  // Drop corners that do not turn.
  const corners = points.filter((point, index) => {
    const before = points[index - 1];
    const after = points[index + 1];
    return (
      !before ||
      !after ||
      !(
        (before.x === point.x && point.x === after.x) ||
        (before.y === point.y && point.y === after.y)
      )
    );
  });
  return { points: corners, labelX, labelY };
}

/** The label sits halfway along the route's longest horizontal run, or its middle run. */
function withLabel(points: XYPosition[]): EdgeRoute {
  if (points.length === 4) {
    const [, turn, back] = points as [XYPosition, XYPosition, XYPosition, XYPosition];
    return { points, labelX: turn.x, labelY: (turn.y + back.y) / 2 };
  }
  const middle = Math.floor((points.length - 1) / 2);
  const from = points[middle]!;
  const to = points[middle + 1] ?? from;
  return { points, labelX: (from.x + to.x) / 2, labelY: (from.y + to.y) / 2 };
}

/**
 * The orthogonal route the canvas draws for a connection. Left-to-right connections run out of
 * the right port and into the left one, turning where no node stands in the way: halfway when
 * that is clear, else beside a node, else along a free row between the columns. Other
 * connections keep React Flow's smooth step. Pure and deterministic.
 */
export function routeEdge(ends: EdgeEnds, obstacles: readonly Rect[]): EdgeRoute {
  const { sourceX: sx, sourceY: sy, targetX: tx, targetY: ty } = ends;
  if (!isForward(ends)) {
    return smoothStepPoints(ends);
  }
  const source = { x: sx, y: sy };
  const target = { x: tx, y: ty };
  const corridor: Corridor = {
    sx,
    sy,
    tx,
    ty,
    low: sx + PORT_RUN,
    high: tx - PORT_RUN,
    obstacles: obstacles.filter(
      (rect) =>
        !touches(rect, source) &&
        !touches(rect, target) &&
        overlaps(sx, tx, rect.x - CLEARANCE, rect.x + rect.width + CLEARANCE),
    ),
  };
  if (Math.abs(ty - sy) < 1 && clearHorizontal(corridor, sy, sx, tx)) {
    return { points: [source, target], labelX: (sx + tx) / 2, labelY: sy };
  }
  const points = singleTurn(corridor) ??
    detour(corridor) ?? [source, { x: (sx + tx) / 2, y: sy }, { x: (sx + tx) / 2, y: ty }, target];
  return withLabel(points);
}

/** SVG path through the route's corners, rounding each turn like React Flow's smooth step. */
export function routePath(points: readonly XYPosition[], radius = CORNER_RADIUS): string {
  if (points.length === 0) {
    return "";
  }
  let path = `M${points[0]!.x} ${points[0]!.y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const a = points[index - 1]!;
    const b = points[index]!;
    const c = points[index + 1]!;
    const size = Math.min(
      Math.hypot(b.x - a.x, b.y - a.y) / 2,
      Math.hypot(c.x - b.x, c.y - b.y) / 2,
      radius,
    );
    if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y) || size === 0) {
      path += `L${b.x} ${b.y}`;
    } else if (a.y === b.y) {
      path += `L${b.x + size * (a.x < c.x ? -1 : 1)} ${b.y}Q${b.x} ${b.y} ${b.x} ${b.y + size * (a.y < c.y ? 1 : -1)}`;
    } else {
      path += `L${b.x} ${b.y + size * (a.y < c.y ? -1 : 1)}Q${b.x} ${b.y} ${b.x + size * (a.x < c.x ? 1 : -1)} ${b.y}`;
    }
  }
  const last = points.at(-1)!;
  return `${path}L${last.x} ${last.y}`;
}

export interface RouteRequest {
  id: string;
  ends: EdgeEnds;
}

/**
 * Route every connection of the canvas together: each finds its own clear turn, then
 * connections that would share a vertical channel get separate lanes (see `separateChannels`).
 * Pure; the result does not depend on the order of the requests.
 */
export function routeEdges(
  requests: readonly RouteRequest[],
  obstacles: readonly Rect[],
): Map<string, EdgeRoute> {
  const routed = [...requests]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map(({ id, ends }) => ({ id, forward: isForward(ends), route: routeEdge(ends, obstacles) }));
  const lanes = routed.filter((entry) => entry.forward);
  separateChannels(
    lanes.map((entry) => ({ id: entry.id, points: entry.route.points })),
    obstacles,
  );
  return new Map(
    routed.map((entry) => [entry.id, entry.forward ? withLabel(entry.route.points) : entry.route]),
  );
}
