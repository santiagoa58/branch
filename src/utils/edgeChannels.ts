import type { Rect, XYPosition } from "@xyflow/react";
import { countCrossings } from "./layout/crossings";

/** A vertical run of one route: its corners `index` and `index + 1`. */
interface Run {
  route: XYPosition[];
  index: number;
  x: number;
  top: number;
  bottom: number;
  /** Where the run may move without folding the route back on itself. */
  low: number;
  high: number;
  sourceKey: string;
  targetKey: string;
  id: string;
}

/** Runs that move together: connections leaving one port, or entering one, share a trunk. */
interface Bundle {
  runs: Run[];
  top: number;
  bottom: number;
}

const SPACING = 12;
const CLEARANCE = 12;
const PORT_RUN = 20;
/** Bundles in one channel up to this many are ordered exactly; more use a sort. */
const EXACT_LIMIT = 5;

function pointKey(point: XYPosition): string {
  return `${point.x},${point.y}`;
}

function verticalRuns(id: string, route: XYPosition[]): Run[] {
  const runs: Run[] = [];
  const last = route.length - 1;
  for (let index = 1; index + 1 < last; index += 1) {
    const from = route[index]!;
    const to = route[index + 1]!;
    if (from.x !== to.x || from.y === to.y) {
      continue;
    }
    runs.push({
      route,
      index,
      x: from.x,
      top: Math.min(from.y, to.y),
      bottom: Math.max(from.y, to.y),
      low: index === 1 ? route[0]!.x + PORT_RUN : route[index - 1]!.x + 4,
      high: index + 2 === last ? route[last]!.x - PORT_RUN : route[index + 2]!.x - 4,
      sourceKey: index === 1 ? pointKey(route[0]!) : `${id}:${index}`,
      targetKey: index + 2 === last ? pointKey(route[last]!) : `${id}:${index}`,
      id,
    });
  }
  return runs;
}

/** Group a channel's runs by shared source port, else shared target port, else alone. */
function bundlesOf(runs: Run[]): Bundle[] {
  const count = (key: (run: Run) => string, value: string) =>
    runs.filter((run) => key(run) === value).length;
  const byKey = new Map<string, Run[]>();
  for (const run of runs) {
    const key =
      count((r) => r.sourceKey, run.sourceKey) > 1
        ? `s:${run.sourceKey}`
        : count((r) => r.targetKey, run.targetKey) > 1
          ? `t:${run.targetKey}`
          : `e:${run.id}:${run.index}`;
    byKey.set(key, [...(byKey.get(key) ?? []), run]);
  }
  return [...byKey.values()].map((members) => ({
    runs: members,
    top: Math.min(...members.map((run) => run.top)),
    bottom: Math.max(...members.map((run) => run.bottom)),
  }));
}

/** Bundles whose vertical extents overlap, transitively; others never meet in this channel. */
function overlappingClusters(bundles: Bundle[]): Bundle[][] {
  const sorted = [...bundles].sort((a, b) => a.top - b.top || a.bottom - b.bottom);
  const clusters: Bundle[][] = [];
  let reach = -Infinity;
  for (const bundle of sorted) {
    if (bundle.top < reach) {
      clusters.at(-1)!.push(bundle);
    } else {
      clusters.push([bundle]);
    }
    reach = Math.max(reach, bundle.bottom);
  }
  return clusters.filter((cluster) => cluster.length > 1);
}

function place(bundle: Bundle, x: number): void {
  for (const run of bundle.runs) {
    run.route[run.index] = { x, y: run.route[run.index]!.y };
    run.route[run.index + 1] = { x, y: run.route[run.index + 1]!.y };
  }
}

function crossingsWithin(cluster: Bundle[]): number {
  const routes = [...new Set(cluster.flatMap((bundle) => bundle.runs.map((run) => run.route)))];
  return countCrossings(routes);
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) {
    return [items];
  }
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [
      item,
      ...rest,
    ]),
  );
}

/** Downward runs turn further right the higher they start, upward ones the lower they start. */
function heuristicOrder(cluster: Bundle[]): Bundle[] {
  const start = (bundle: Bundle) => bundle.runs[0]!.route[bundle.runs[0]!.index]!.y;
  const down = (bundle: Bundle) => {
    const run = bundle.runs[0]!;
    return run.route[run.index + 1]!.y > run.route[run.index]!.y;
  };
  return [...cluster].sort(
    (a, b) =>
      Number(down(b)) - Number(down(a)) || (down(a) ? start(b) - start(a) : start(a) - start(b)),
  );
}

/** Free room around the channel: between the nearest nodes and inside every run's limits. */
function channelRoom(cluster: Bundle[], x: number, obstacles: readonly Rect[]): [number, number] {
  const runs = cluster.flatMap((bundle) => bundle.runs);
  const top = Math.min(...cluster.map((bundle) => bundle.top));
  const bottom = Math.max(...cluster.map((bundle) => bundle.bottom));
  let low = Math.max(...runs.map((run) => run.low));
  let high = Math.min(...runs.map((run) => run.high));
  for (const rect of obstacles) {
    if (rect.y < bottom && rect.y + rect.height > top) {
      if (rect.x + rect.width <= x) {
        low = Math.max(low, rect.x + rect.width + CLEARANCE);
      } else if (rect.x >= x) {
        high = Math.min(high, rect.x - CLEARANCE);
      }
    }
  }
  return [Math.min(low, x), Math.max(high, x)];
}

function spread(order: Bundle[], x: number, room: [number, number]): void {
  const gaps = order.length - 1;
  const spacing = Math.min(SPACING, (room[1] - room[0]) / gaps);
  const start = Math.min(Math.max(x - (spacing * gaps) / 2, room[0]), room[1] - spacing * gaps);
  order.forEach((bundle, position) => place(bundle, start + spacing * position));
}

function separateCluster(cluster: Bundle[], x: number, obstacles: readonly Rect[]): void {
  const room = channelRoom(cluster, x, obstacles);
  if (cluster.length > EXACT_LIMIT) {
    spread(heuristicOrder(cluster), x, room);
    return;
  }
  let best: { order: Bundle[]; crossings: number } | undefined;
  for (const order of permutations(heuristicOrder(cluster))) {
    spread(order, x, room);
    const crossings = crossingsWithin(cluster);
    if (!best || crossings < best.crossings) {
      best = { order, crossings };
    }
  }
  spread(best!.order, x, room);
}

/**
 * Give connections that would share a vertical channel their own lanes, so different
 * connections never run along each other. Connections leaving one port (or entering one) keep a
 * shared trunk. Lanes are ordered to cross least and stay clear of nodes. Updates the routes in
 * place; deterministic for routes given in a fixed order.
 */
export function separateChannels(
  routes: readonly { id: string; points: XYPosition[] }[],
  obstacles: readonly Rect[],
): void {
  const runs = routes.flatMap(({ id, points }) => verticalRuns(id, points));
  const channels = new Map<number, Run[]>();
  for (const run of runs) {
    const key = Math.round(run.x);
    channels.set(key, [...(channels.get(key) ?? []), run]);
  }
  for (const [x, channel] of [...channels].sort((a, b) => a[0] - b[0])) {
    for (const cluster of overlappingClusters(bundlesOf(channel))) {
      separateCluster(cluster, x, obstacles);
    }
  }
}
