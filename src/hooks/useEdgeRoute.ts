import { useLayoutEffect, useMemo } from "react";
import { useStore, type ReactFlowState, type Rect } from "@xyflow/react";
import { useStore as useZustandStore } from "zustand";
import {
  routeEdge,
  routeEdges,
  routePath,
  type EdgeEnds,
  type EdgeRoute,
} from "@/utils/edgeRouting";
import { COLLAPSED_GROUP_HEIGHT, COLLAPSED_GROUP_WIDTH } from "@/utils/groupRollup";
import { leafSize } from "@/utils/layout/geometry";
import { createCanvasRegistry } from "./canvasRegistry";
import { sameObstacles } from "./useEdgeLabelPosition";

const routeObstacleSnapshots = new WeakMap<ReactFlowState, Rect[]>();

/** Nodes a connection should not run across: visible components and collapsed groups. */
function selectRouteObstacles(state: ReactFlowState): Rect[] {
  const cached = routeObstacleSnapshots.get(state);
  if (cached) {
    return cached;
  }
  const obstacles: Rect[] = [];
  for (const node of state.nodeLookup.values()) {
    const collapsed = node.type === "group" && node.data["collapsed"] === true;
    // Expanded groups are containers: connections run in and out of them.
    if (node.hidden || (node.type === "group" && !collapsed)) {
      continue;
    }
    obstacles.push({
      ...node.internals.positionAbsolute,
      ...(collapsed
        ? { width: COLLAPSED_GROUP_WIDTH, height: COLLAPSED_GROUP_HEIGHT }
        : leafSize(node)),
    });
  }
  routeObstacleSnapshots.set(state, obstacles);
  return obstacles;
}

const routes = createCanvasRegistry<EdgeEnds>();
let routing: { entries: ReadonlyMap<string, EdgeEnds>; obstacles: Rect[] } | null = null;
let routed = new Map<string, EdgeRoute>();

/** Every reported connection routed together, once per change of connections or nodes. */
function canvasRoutes(entries: ReadonlyMap<string, EdgeEnds>, obstacles: Rect[]) {
  if (routing?.entries !== entries || !sameObstacles(routing.obstacles, obstacles)) {
    routed = routeEdges(
      [...entries].map(([id, ends]) => ({ id, ends })),
      obstacles,
    );
    routing = { entries, obstacles };
  }
  return routed;
}

function sameEnds(a: EdgeEnds | undefined, b: EdgeEnds): boolean {
  return (
    a !== undefined &&
    a.sourceX === b.sourceX &&
    a.sourceY === b.sourceY &&
    a.sourcePosition === b.sourcePosition &&
    a.targetX === b.targetX &&
    a.targetY === b.targetY &&
    a.targetPosition === b.targetPosition
  );
}

function snapshot(route: EdgeRoute): string {
  return `${route.labelX},${route.labelY},${routePath(route.points)}`;
}

/**
 * The orthogonal path of a connection and its label anchor. Display-only: connections turn
 * where no node stands in the way, and connections sharing a column gap get their own lanes
 * (see `routeEdges`). Stored edges and history never change.
 */
export function useEdgeRoute(id: string, ends: EdgeEnds) {
  const { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition } = ends;
  const current = useMemo(
    (): EdgeEnds => ({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition }),
    [sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition],
  );
  const obstacles = useStore(selectRouteObstacles, sameObstacles);

  useLayoutEffect(() => {
    routes.report(id, current);
  }, [id, current]);
  useLayoutEffect(() => () => routes.remove(id), [id]);

  // A primitive snapshot, so only connections whose route changed render again.
  const shared = useZustandStore(routes.store, (state) =>
    sameEnds(state.entries.get(id), current)
      ? snapshot(canvasRoutes(state.entries, obstacles).get(id)!)
      : null,
  );
  return useMemo(() => {
    // Until the connection is reported it is routed on its own.
    const [labelX, labelY, ...path] = (shared ?? snapshot(routeEdge(current, obstacles))).split(
      ",",
    );
    return { path: path.join(","), labelX: Number(labelX), labelY: Number(labelY) };
  }, [shared, current, obstacles]);
}
