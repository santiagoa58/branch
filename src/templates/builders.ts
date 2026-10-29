import { Node, Edge } from "@xyflow/react";
import {
  ArchitectureEdgeData,
  ArchitectureNodeData,
  ArchitectureNodeType,
  GroupNodeData,
  GroupNodeType,
} from "@/types";

/**
 * Tiny builders for authoring starter templates. They produce exactly the
 * node/edge shapes the editor creates itself (see diagramStore.onConnect and
 * DiagramEditor.onDrop), so a loaded template is indistinguishable from a
 * hand-drawn diagram.
 */

export function archNode(
  id: string,
  type: ArchitectureNodeType,
  label: string,
  x: number,
  y: number,
  extra?: Partial<ArchitectureNodeData> & { parentId?: string },
): Node {
  const { parentId, ...data } = extra ?? {};
  return {
    id,
    type: "architecture",
    position: { x, y },
    data: { label, type, ...(parentId ? { parentId } : {}), ...data },
    ...(parentId ? { parentId, extent: "parent" as const } : {}),
  };
}

export function groupNode(
  id: string,
  groupType: GroupNodeType,
  label: string,
  x: number,
  y: number,
  width: number,
  height: number,
  extra?: Partial<GroupNodeData> & { parentId?: string },
): Node {
  const { parentId, ...data } = extra ?? {};
  return {
    id,
    type: "group",
    position: { x, y },
    zIndex: -1,
    style: { width, height },
    data: { label, groupType, collapsed: false, ...(parentId ? { parentId } : {}), ...data },
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
