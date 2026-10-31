import { useLayoutEffect, useMemo, useState } from "react";
import { useStore, type ReactFlowState, type Rect, type XYPosition } from "@xyflow/react";
import { placeEdgeLabel } from "@/utils/edgeLabels";
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

function sameObstacles(a: Rect[], b: Rect[]): boolean {
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

/** Label placement is display-only; stored edge geometry and history stay unchanged. */
export function useEdgeLabelPosition(x: number, y: number, hasDecision = false) {
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
  const position = useMemo((): XYPosition => {
    const top = hasDecision ? Math.min(-size.height / 2, -32) : -size.height / 2;
    const right = hasDecision ? Math.max(size.width / 2, 48) : size.width / 2;
    return placeEdgeLabel(
      { x, y },
      {
        x: -size.width / 2,
        y: top,
        width: right + size.width / 2,
        height: size.height / 2 - top,
      },
      obstacles,
    );
  }, [x, y, size, hasDecision, obstacles]);
  return { labelRef, labelX: position.x, labelY: position.y };
}
