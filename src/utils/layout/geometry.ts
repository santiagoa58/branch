import type { Node } from "@xyflow/react";
import { COLLAPSED_GROUP_HEIGHT, COLLAPSED_GROUP_WIDTH } from "../groupRollup";

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export const CONTAINER_PADDING = 32;
export const CONTAINER_HEADER = 56;

export function isCollapsed(node: Node): boolean {
  return node.type === "group" && node.data["collapsed"] === true;
}

// Without a DOM only absolute numeric / px dimensions have a known footprint.
function dimension(value: number | string | undefined): number | undefined {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\s*\d+(?:\.\d+)?(?:px)?\s*$/.test(value)
        ? Number(value.trim().replace(/px$/, ""))
        : NaN;
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

export function leafSize(node: Node): Size {
  const fallback =
    node.type === "comment"
      ? { width: 280, height: node.data["minimized"] === true ? 80 : 180 }
      : { width: 180, height: 140 };
  return {
    width:
      dimension(node.measured?.width) ??
      dimension(node.width) ??
      dimension(node.style?.width) ??
      dimension(node.initialWidth) ??
      fallback.width,
    height:
      dimension(node.measured?.height) ??
      dimension(node.height) ??
      dimension(node.style?.height) ??
      dimension(node.initialHeight) ??
      fallback.height,
  };
}

/** Expanded containers fit content; collapsed cards retain their stored expansion size. */
export function containerSize(node: Node, content: Size): Size {
  const minimum = isCollapsed(node)
    ? {
        // Measurements may describe the compact card, not its stored expanded size.
        width:
          dimension(node.style?.width) ??
          dimension(node.width) ??
          dimension(node.initialWidth) ??
          400,
        height:
          dimension(node.style?.height) ??
          dimension(node.height) ??
          dimension(node.initialHeight) ??
          300,
      }
    : {
        width: Math.max(200, dimension(node.style?.minWidth) ?? 0),
        height: Math.max(150, dimension(node.style?.minHeight) ?? 0),
      };
  return {
    width: Math.max(minimum.width, content.width + CONTAINER_PADDING * 2),
    height: Math.max(minimum.height, content.height + CONTAINER_HEADER + CONTAINER_PADDING),
  };
}

export function visibleSize(node: Node, expanded: Size): Size {
  return isCollapsed(node)
    ? { width: COLLAPSED_GROUP_WIDTH, height: COLLAPSED_GROUP_HEIGHT }
    : expanded;
}

/** Layout uses top-left rectangles; React Flow positions may use a custom origin. */
export function anchoredPosition(node: Node, position: Point, size: Size): Point {
  return {
    x: position.x + size.width * (node.origin?.[0] ?? 0),
    y: position.y + size.height * (node.origin?.[1] ?? 0),
  };
}
