import { useLayoutEffect, useMemo, useState } from "react";
import { useStore, type ReactFlowState, type Rect, type XYPosition } from "@xyflow/react";
import { useStore as useZustandStore } from "zustand";
import { placeEdgeLabel, placeEdgeLabels, type LabelRequest } from "@/utils/edgeLabels";
import { createCanvasRegistry } from "./canvasRegistry";
import { COLLAPSED_GROUP_HEIGHT, COLLAPSED_GROUP_WIDTH } from "@/utils/groupRollup";
import { CONTAINER_HEADER, leafSize } from "@/utils/layout/geometry";

const obstacleSnapshots = new WeakMap<ReactFlowState, Rect[]>();

function selectObstacles(state: ReactFlowState): Rect[] {
  const cached = obstacleSnapshots.get(state);
  if (cached) {
    return cached;
  }
  const obstacles: Rect[] = [];
  for (const node of state.nodeLookup.values()) {
    if (node.hidden) {
      continue;
    }
    const position = node.internals.positionAbsolute;
    const collapsed = node.type === "group" && node.data["collapsed"] === true;
    const dimensions = collapsed
      ? { width: COLLAPSED_GROUP_WIDTH, height: COLLAPSED_GROUP_HEIGHT }
      : leafSize(node);
    // Expanded containers are not solid obstacles: their children and labels
    // live inside them. Reserve the header, including its overhanging badge.
    obstacles.push(
      node.type === "group" && !collapsed
        ? {
            x: position.x,
            y: position.y - 24,
            width: dimensions.width,
            height: CONTAINER_HEADER + 24,
          }
        : { ...position, ...dimensions },
    );
  }
  // Share one numeric snapshot per store update across all mounted edge labels.
  obstacleSnapshots.set(state, obstacles);
  return obstacles;
}

export function sameObstacles(a: readonly Rect[], b: readonly Rect[]): boolean {
  return (
    a === b ||
    (a.length === b.length &&
      a.every((rect, index) => {
        const other = b[index]!;
        return (
          rect.x === other.x &&
          rect.y === other.y &&
          rect.width === other.width &&
          rect.height === other.height
        );
      }))
  );
}

const labels = createCanvasRegistry<LabelRequest>();
let placement: { entries: ReadonlyMap<string, LabelRequest>; obstacles: Rect[] } | null = null;
let placed = new Map<string, XYPosition>();

/** Every reported label placed together, once per change of labels or nodes. */
function placedLabels(entries: ReadonlyMap<string, LabelRequest>, obstacles: Rect[]) {
  if (placement?.entries !== entries || !sameObstacles(placement.obstacles, obstacles)) {
    placed = placeEdgeLabels([...entries.values()], obstacles);
    placement = { entries, obstacles };
  }
  return placed;
}

function sameRequest(a: LabelRequest | undefined, b: LabelRequest): boolean {
  return (
    a !== undefined &&
    a.anchor.x === b.anchor.x &&
    a.anchor.y === b.anchor.y &&
    sameObstacles([a.box], [b.box])
  );
}

/**
 * Label placement is display-only; stored edge geometry and history stay unchanged. With an
 * `id`, the label also keeps clear of the other labels on the canvas.
 */
export function useEdgeLabelPosition(x: number, y: number, hasDecision = false, id?: string) {
  const [element, labelRef] = useState<HTMLElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!element) {
      return;
    }
    const measure = () => {
      // Layout dimensions stay in flow coordinates, unlike zoomed client rects.
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      setSize((previous) =>
        previous.width === width && previous.height === height ? previous : { width, height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  // Compare geometry values, not the mutable nodeLookup identity. This reacts
  // to unrelated node drags without rerunning placement just for pan or zoom.
  const obstacles = useStore(selectObstacles, sameObstacles);
  const request = useMemo((): LabelRequest => {
    const top = hasDecision ? Math.min(-size.height / 2, -32) : -size.height / 2;
    const right = hasDecision ? Math.max(size.width / 2, 48) : size.width / 2;
    return {
      id: id ?? "",
      anchor: { x, y },
      box: {
        x: -size.width / 2,
        y: top,
        width: right + size.width / 2,
        height: size.height / 2 - top,
      },
    };
  }, [id, x, y, size, hasDecision]);

  useLayoutEffect(() => {
    if (id !== undefined) {
      labels.report(id, request);
    }
  }, [id, request]);
  useLayoutEffect(() => {
    if (id === undefined) {
      return;
    }
    return () => labels.remove(id);
  }, [id]);

  // A primitive snapshot, so only labels whose placement changed render again.
  const shared = useZustandStore(labels.store, (state) => {
    if (id === undefined || !sameRequest(state.entries.get(id), request)) {
      return null;
    }
    const position = placedLabels(state.entries, obstacles).get(id);
    return position ? `${position.x},${position.y}` : null;
  });
  const position = useMemo((): XYPosition => {
    if (shared !== null) {
      const [labelX, labelY] = shared.split(",").map(Number);
      return { x: labelX!, y: labelY! };
    }
    // Until the label is reported (or without an id) it avoids the nodes alone.
    return placeEdgeLabel(request.anchor, request.box, obstacles);
  }, [shared, request, obstacles]);
  return { labelRef, labelX: position.x, labelY: position.y };
}
