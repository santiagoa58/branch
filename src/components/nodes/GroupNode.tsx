import { memo, useEffect, useRef, useState } from "react";
import { NodeProps, NodeResizer, Handle, Position } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { GroupNode as GroupFlowNode } from "@/types";
import { GROUP_TYPES_CONFIG } from "@/constants";
import { useDiagramStore } from "@/store/diagramStore";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

export const GroupNode = memo(({ id, data: nodeData, selected }: NodeProps<GroupFlowNode>) => {
  const config = GROUP_TYPES_CONFIG[nodeData.groupType] || GROUP_TYPES_CONFIG.vpc;
  const Icon = config.icon;
  const isCollapsed = nodeData.collapsed ?? false;

  const toggleGroupCollapse = useDiagramStore((state) => state.toggleGroupCollapse);
  // Subscribe to a derived primitive (childCount) instead of the whole nodes
  // array, so this component is not re-rendered on every drag tick.
  const childCount = useDiagramStore((state) =>
    state.nodes.reduce((count, n) => (n.parentId === id ? count + 1 : count), 0),
  );
  const [isDropHighlightActive, setIsDropHighlightActive] = useState(false);
  const previousChildCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (previousChildCountRef.current === null) {
      previousChildCountRef.current = childCount;
      return undefined;
    }

    if (childCount > previousChildCountRef.current) {
      setIsDropHighlightActive(true);
      const timeout = window.setTimeout(() => {
        setIsDropHighlightActive(false);
      }, 700);

      previousChildCountRef.current = childCount;
      return () => window.clearTimeout(timeout);
    }

    previousChildCountRef.current = childCount;
    return undefined;
  }, [childCount]);

  // Collapsed view - compact card
  if (isCollapsed) {
    return (
      <div data-node-id={id} className="pointer-events-auto w-full h-full">
        <div
          className={cn(
            "w-full h-full rounded-xl border-2 transition-all duration-200 bg-white/90 dark:bg-zinc-900/90 backdrop-blur flex flex-col items-center justify-center p-4 gap-2 relative",
            isDropHighlightActive &&
              "ring-2 ring-emerald-400/70 shadow-lg shadow-emerald-400/20 animate-pulse",
            selected
              ? "border-zinc-400 dark:border-zinc-500 shadow-lg shadow-zinc-400/20 dark:shadow-zinc-500/20"
              : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600",
          )}
        >
          {/* Icon */}
          <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <Icon className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
          </div>

          {/* Label */}
          <div className="text-center">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {nodeData.label}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
              {config.label}
            </div>
          </div>

          {/* Child count badge */}
          {childCount > 0 && (
            <div className="text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
              {childCount} {childCount === 1 ? "item" : "items"}
            </div>
          )}

          {/* Expand button */}
          <button
            type="button"
            onClick={() => toggleGroupCollapse(id)}
            className="mt-1 p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
            title="Expand group"
          >
            <ChevronDownIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Connection handles */}
        <Handle
          type="target"
          position={Position.Top}
          title="Input"
          className="w-3! h-3! bg-sky-400! dark:bg-sky-500! border-2! border-white! dark:border-zinc-950! rounded-full! opacity-0 hover:opacity-100 hover:scale-150! transition-all"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          title="Output"
          className="w-3! h-3! bg-amber-400! dark:bg-amber-500! border-2! border-white! dark:border-zinc-950! rounded-full! opacity-0 hover:opacity-100 hover:scale-150! transition-all"
        />
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          title="Input"
          className="w-3! h-3! bg-sky-400! dark:bg-sky-500! border-2! border-white! dark:border-zinc-950! rounded-full! opacity-0 hover:opacity-100 hover:scale-150! transition-all"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          title="Output"
          className="w-3! h-3! bg-amber-400! dark:bg-amber-500! border-2! border-white! dark:border-zinc-950! rounded-full! opacity-0 hover:opacity-100 hover:scale-150! transition-all"
        />
      </div>
    );
  }

  // Expanded view - container
  return (
    <div data-node-id={id} className="pointer-events-none w-full h-full">
      {/* Resizer - only when selected */}
      <NodeResizer
        minWidth={200}
        minHeight={150}
        isVisible={selected}
        lineClassName="!border-zinc-500 pointer-events-auto"
        handleClassName="!w-2.5 !h-2.5 !bg-zinc-300 !border-zinc-950 pointer-events-auto"
      />

      {/* Group Container */}
      <div
        className={cn(
          "w-full h-full rounded-2xl border-2 transition-all duration-200 pointer-events-none relative isolate",
          isDropHighlightActive &&
            "ring-2 ring-emerald-400/70 shadow-lg shadow-emerald-400/20 animate-pulse bg-emerald-50/20 dark:bg-emerald-900/10",
          selected
            ? "border-zinc-400 dark:border-zinc-500 bg-zinc-100/20 dark:bg-zinc-900/20"
            : "border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-100/10 dark:bg-zinc-900/10 hover:bg-zinc-100/20 dark:hover:bg-zinc-900/20 hover:border-zinc-400 dark:hover:border-zinc-700",
        )}
      >
        {/* Label Badge - positioned at top */}
        <div className="absolute -top-3 left-4 bg-white dark:bg-zinc-950 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase text-muted-foreground flex items-center gap-1.5 border border-zinc-300 dark:border-zinc-800 rounded-full pointer-events-auto cursor-pointer">
          <Icon className="w-2.5 h-2.5" />
          <span>{nodeData.label}</span>
          {/* Collapse Toggle */}
          <button
            type="button"
            onClick={() => toggleGroupCollapse(id)}
            className="ml-1 p-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
            title="Collapse group"
          >
            <ChevronDownIcon className="w-2.5 h-2.5" />
          </button>
        </div>

        {/* Connection handles */}
        <Handle
          type="target"
          position={Position.Top}
          title="Input"
          className="w-3! h-3! bg-sky-400! dark:bg-sky-500! border-2! border-white! dark:border-zinc-950! rounded-full! opacity-0 hover:opacity-100 hover:scale-150! transition-all pointer-events-auto"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          title="Output"
          className="w-3! h-3! bg-amber-400! dark:bg-amber-500! border-2! border-white! dark:border-zinc-950! rounded-full! opacity-0 hover:opacity-100 hover:scale-150! transition-all pointer-events-auto"
        />
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          title="Input"
          className="w-3! h-3! bg-sky-400! dark:bg-sky-500! border-2! border-white! dark:border-zinc-950! rounded-full! opacity-0 hover:opacity-100 hover:scale-150! transition-all pointer-events-auto"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          title="Output"
          className="w-3! h-3! bg-amber-400! dark:bg-amber-500! border-2! border-white! dark:border-zinc-950! rounded-full! opacity-0 hover:opacity-100 hover:scale-150! transition-all pointer-events-auto"
        />
      </div>
    </div>
  );
});

GroupNode.displayName = "GroupNode";
