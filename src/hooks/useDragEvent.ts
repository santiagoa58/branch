import { DragEvent } from "react";
import { ArchitectureNodeType, GroupNodeType } from "@/types";

export function useDragEvent(
  nodeType: ArchitectureNodeType | `group-${GroupNodeType}` | "comment",
) {
  const onDragStart = (event: DragEvent) => {
    event.dataTransfer.setData("application/reactflow", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return { onDragStart };
}
