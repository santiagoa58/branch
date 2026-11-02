import type { Edge, Node } from "@xyflow/react";
import { layoutSiblings } from "./layout/elk";
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
import { assignPorts } from "./layout/ports";
import { projectEdges } from "./layout/projection";
import { layoutTiers } from "./layout/tiers";

export interface DiagramLayout {
  nodes: Node[];
  edges: Edge[];
}

/**
 * Pure automatic left-to-right layout of a stored diagram (not its display rollups).
 * Every component is placed in its zone (clients, edge, services, async, data), laid out by ELK's
 * layered algorithm; children are sized and positioned before their containers take part, and
 * each connection gets the ports that match the flow. Comments are shelved under their
 * container's content. Node IDs are expected to be unique, as enforced by the diagram schema.
 * The inputs are never modified, and the same input always gives the same output.
 */
export async function autoLayoutDiagram(nodes: Node[], edges: Edge[]): Promise<DiagramLayout> {
  const hierarchy = buildHierarchy(nodes);
  const projected = projectEdges(edges, hierarchy);
  const tiers = layoutTiers(hierarchy);
  const expandedSizes = new Map<string, Size>();
  const footprints = new Map<string, Size>();
  const positions = new Map<string, Point>();

  const layoutChildren = async (parent: string | undefined): Promise<Size> => {
    const children = hierarchy.children.get(parent) ?? [];
    const layout = await layoutSiblings(
      children.map((child) => ({
        id: child.id,
        ...footprints.get(child.id)!,
        tier: tiers.get(child.id),
      })),
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

  // Postorder without recursion also handles deeply nested diagrams. Containers are laid out
  // one at a time, bottom-up: each needs its children's final sizes.
  for (const node of [...hierarchy.preorder].reverse()) {
    const container = node.type === "group" || hierarchy.children.has(node.id);
    // oxlint-disable-next-line no-await-in-loop -- a container needs its children's sizes first
    const size = container ? containerSize(node, await layoutChildren(node.id)) : leafSize(node);
    if (container) {
      expandedSizes.set(node.id, size);
    }
    footprints.set(node.id, visibleSize(node, size));
  }
  await layoutChildren(undefined);

  const laidOut = hierarchy.preorder.map((node) => {
    const expanded = expandedSizes.get(node.id);
    return {
      ...node,
      position: anchoredPosition(node, positions.get(node.id)!, footprints.get(node.id)!),
      ...(node.parentId === undefined ? {} : { extent: "parent" as const }),
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
  return { nodes: laidOut, edges: assignPorts(laidOut, edges) };
}
