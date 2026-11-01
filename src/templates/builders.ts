import type { Node, Edge } from "@xyflow/react";
import type {
  ArchitectureEdgeData,
  ArchitectureNodeData,
  ArchitectureNodeType,
  GroupNodeData,
  GroupNodeType,
} from "@/types";
import { nodeAttributes } from "./reasoning";

/**
 * Tiny builders for authoring starter templates. They produce exactly the
 * node/edge shapes the editor creates itself (see diagramStore.onConnect and
 * DiagramEditor.onDrop), so a loaded template is indistinguishable from a
 * hand-drawn diagram.
 */

// oxlint-disable-next-line max-params -- debt: 6 params; take an options object
export function archNode(
  id: string,
  type: ArchitectureNodeType,
  label: string,
  x: number,
  y: number,
  extra?: Partial<
    Pick<ArchitectureNodeData, "description" | "decision" | "attributes" | "iconifyIcon">
  > & { parentId?: string },
): Node {
  const { parentId, ...data } = extra ?? {};
  return {
    id,
    type: "architecture",
    position: { x, y },
    data: {
      label,
      type,
      ...(parentId ? { parentId } : {}),
      ...data,
      attributes: (data.attributes ?? nodeAttributes(type)).map((attribute) => ({ ...attribute })),
    },
    ...(parentId ? { parentId, extent: "parent" as const } : {}),
  };
}

// oxlint-disable-next-line max-params -- debt: 8 params; take an options object
export function groupNode(
  id: string,
  groupType: GroupNodeType,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  extra?: Partial<Pick<GroupNodeData, "description" | "decision" | "color">> & {
    parentId?: string;
  },
): Node {
  const { parentId, ...data } = extra ?? {};
  return {
    id,
    type: "group",
    position: { x, y },
    zIndex: -1,
    style: { width, height },
    data: {
      label,
      groupType,
      collapsed: false,
      ...(parentId ? { parentId } : {}),
      ...data,
    },
    ...(parentId ? { parentId, extent: "parent" as const } : {}),
  };
}

export function archEdge(
  id: string,
  source: string,
  target: string,
  data?: ArchitectureEdgeData,
): Edge {
  return {
    id,
    source,
    target,
    type: "architecture",
    data: { animated: false, ...data },
  };
}
