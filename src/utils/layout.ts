import type { Edge, Node } from "@xyflow/react";
import {
  anchoredPosition,
  CONTAINER_HEADER,
  CONTAINER_PADDING,
  containerSize,
  isCollapsed,
  leafSize,
  visibleSize,
  type Point,
  type Size,
} from "./layout/geometry";
import { buildHierarchy } from "./layout/hierarchy";
import { projectEdges } from "./layout/projection";
import { layoutSiblings } from "./layout/rank";

/**
 * Pure automatic top-to-bottom layout of a stored diagram (not its display rollups).
 * Children are sized and positioned before their containers participate in layout.
 * Node IDs are expected to be unique, as enforced by the diagram schema.
 */
export function autoLayoutDiagram(nodes: Node[], edges: Edge[]): Node[] {
  const hierarchy = buildHierarchy(nodes);
  const projected = projectEdges(edges, hierarchy);
  const expandedSizes = new Map<string, Size>();
  const footprints = new Map<string, Size>();
  const positions = new Map<string, Point>();

  const layoutChildren = (parent: string | undefined): Size => {
    const children = hierarchy.children.get(parent) ?? [];
    const layout = layoutSiblings(
      children.map((child) => ({ id: child.id, ...footprints.get(child.id)! })),
      projected.get(parent) ?? [],
    );
    for (const [id, position] of layout.positions) {
      positions.set(id, {
        x: position.x + (parent === undefined ? 0 : CONTAINER_PADDING),
        y: position.y + (parent === undefined ? 0 : CONTAINER_HEADER),
      });
    }
    return { width: layout.width, height: layout.height };
  };

  // Iterative postorder also avoids recursive traversal on deeply nested diagrams.
  for (const node of [...hierarchy.preorder].reverse()) {
    const container = node.type === "group" || hierarchy.children.has(node.id);
    const size = container ? containerSize(node, layoutChildren(node.id)) : leafSize(node);
    if (container) {
      expandedSizes.set(node.id, size);
    }
    footprints.set(node.id, visibleSize(node, size));
  }
  layoutChildren(undefined);

  return hierarchy.preorder.map((node) => {
    const expanded = expandedSizes.get(node.id);
    return {
      ...node,
      position: anchoredPosition(node, positions.get(node.id)!, footprints.get(node.id)!),
      ...(node.parentId !== undefined ? { extent: "parent" as const } : {}),
      ...(expanded
        ? {
            style: { ...node.style, ...expanded },
            width: expanded.width,
            height: expanded.height,
            // Expanded measurements must agree with the resized container; a collapsed
            // card's measurements still describe the visible compact card, not storage.
            ...(node.measured && !isCollapsed(node)
              ? { measured: { ...node.measured, ...expanded } }
              : {}),
          }
        : {}),
    };
  });
}
