import { useEffect, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Icon as IconifyIcon } from "@iconify/react";
import { useDiagramStore } from "@/store/diagramStore";
import { NODE_TYPES_CONFIG } from "@/constants";
import { ArchitectureNodeData } from "@/types";
import { cn } from "@/lib/utils";
import { hasBlockingEditorOverlay, isTextEditingEvent } from "@/utils/keyboardContext";

export function NodeDetailPopup() {
  const selectedNodeId = useDiagramStore((s) => s.selectedNodeId);
  const nodes = useDiagramStore((s) => s.nodes);
  const [dismissedNodeId, setDismissedNodeId] = useState<string | null>(null);
  const dismissed = dismissedNodeId === selectedNodeId;

  // Esc dismisses the card.
  useEffect(() => {
    if (!selectedNodeId || dismissed) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        !e.defaultPrevented &&
        !isTextEditingEvent(e) &&
        !hasBlockingEditorOverlay()
      ) {
        setDismissedNodeId(selectedNodeId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedNodeId, dismissed]);

  if (!selectedNodeId || dismissed) {
    return null;
  }

  const node = nodes.find((n) => n.id === selectedNodeId);
  if (!node || node.type !== "architecture") {
    return null;
  }

  const data = node.data as ArchitectureNodeData;
  const config = NODE_TYPES_CONFIG[data.type];
  if (!config) {
    return null;
  }

  const NodeIcon = config.icon;
  const label = data.label || config.label;
  const description = data.description;
  const technology = data.technology;

  return (
    <div
      className={cn(
        "absolute bottom-17 left-4 z-20 w-67 px-3.5 py-3",
        "bg-white/95 dark:bg-zinc-950/90 backdrop-blur-md",
        "border border-zinc-200 dark:border-zinc-800 rounded-lg",
        "shadow-lg shadow-black/5 dark:shadow-black/40",
        "animate-slide-in",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border",
            config.bgClass,
            config.borderClass,
          )}
        >
          {data.iconifyIcon ? (
            <IconifyIcon
              icon={data.iconifyIcon}
              width={18}
              height={18}
              style={{ color: data.iconColor }}
            />
          ) : (
            <NodeIcon className={cn("w-4.5 h-4.5", config.iconColor)} strokeWidth={1.5} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight truncate">
            {label}
          </div>
          <div className="mt-0.5 text-[10px] font-mono uppercase tracking-tight text-muted-foreground">
            {data.type}
            {technology ? ` · ${technology}` : ""}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDismissedNodeId(selectedNodeId)}
          className="shrink-0 p-1 rounded text-zinc-400 dark:text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          title="Dismiss (Esc)"
        >
          <XMarkIcon className="w-3 h-3" />
        </button>
      </div>

      {/* Description */}
      {description && (
        <p className="mt-2.5 pt-2.5 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
          {description}
        </p>
      )}

      {/* Tags */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="px-2 py-0.5 text-[10px] font-medium font-mono rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300">
          {data.type}
        </span>
        {technology && (
          <span className="px-2 py-0.5 text-[10px] font-medium font-mono rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300">
            {technology}
          </span>
        )}
        {data.port && (
          <span className="px-2 py-0.5 text-[10px] font-medium font-mono rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300">
            :{data.port}
          </span>
        )}
      </div>
    </div>
  );
}
