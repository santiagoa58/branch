import type { DragEvent } from "react";
import type { ArchitectureNodeType, GroupNodeType } from "@/types";

export function useDragEvent(
  nodeType: ArchitectureNodeType | `group-${GroupNodeType}` | "comment",
) {
  const onDragStart = (event: DragEvent) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return { onDragStart };
}
