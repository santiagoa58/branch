import { useState, useMemo } from "react";
import { XMarkIcon, SignalIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { useDiagramStore } from "@/store/diagramStore";
import { useUIStore } from "@/store/uiStore";
import { PROTOCOL_CONFIG } from "@/constants";
import { ArchitectureEdgeData, EdgeProtocol } from "@/types";
import { cn } from "@/lib/utils";

export function ProtocolLegend() {
  const [open, setOpen] = useState(false);
  const edges = useDiagramStore((s) => s.edges);
  const hiddenProtocols = useUIStore((s) => s.hiddenProtocols);
  const toggleHiddenProtocol = useUIStore((s) => s.toggleHiddenProtocol);
  const isolateProtocol = useUIStore((s) => s.isolateProtocol);
  const clearHiddenProtocols = useUIStore((s) => s.clearHiddenProtocols);

  const items = useMemo(() => {
    const used = new Set<EdgeProtocol>();
    for (const e of edges) {
      const p = (e.data as ArchitectureEdgeData | undefined)?.protocol;
      if (p) {
        used.add(p);
      }
    }
    return Array.from(used)
      .map((key) => ({ key, ...PROTOCOL_CONFIG[key] }))
      .filter(Boolean);
  }, [edges]);

  const allProtocols = useMemo(() => items.map((i) => i.key), [items]);
  const anyHidden = hiddenProtocols.size > 0;

  if (items.length === 0) {
    return null;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "absolute top-4 right-4 z-20 flex items-center gap-1.5 px-2.5 py-1.5",
          "bg-white/90 dark:bg-zinc-950/80 backdrop-blur-md",
          "border border-zinc-200 dark:border-zinc-800 rounded-lg",
          "shadow shadow-black/5 dark:shadow-black/40",
          "font-mono text-[10px] font-semibold uppercase tracking-wider",
          "text-zinc-500 dark:text-zinc-400",
          "hover:text-zinc-700 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors",
        )}
        title="Show protocol legend"
      >
        <SignalIcon className="w-3 h-3" />
        <span>Legend</span>
        {anyHidden && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "absolute top-4 right-4 z-20 min-w-[180px] px-3.5 py-2.5",
        "bg-white/95 dark:bg-zinc-950/85 backdrop-blur-md",
        "border border-zinc-200 dark:border-zinc-800 rounded-lg",
        "shadow-lg shadow-black/5 dark:shadow-black/40",
        "animate-slide-in",
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
          Protocols
        </span>
        <div className="flex items-center gap-0.5">
          {anyHidden && (
            <button
              type="button"
              onClick={clearHiddenProtocols}
              className="text-[9px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 px-1 py-0.5 rounded"
              title="Show all protocols"
            >
              Show all
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="p-1 opacity-50 hover:opacity-100 transition-opacity"
            title="Hide"
          >
            <XMarkIcon className="w-3 h-3 text-zinc-500 dark:text-zinc-500" />
          </button>
        </div>
      </div>

      <div className="space-y-0.5">
        {items.map(({ key, label, color, style }) => {
          const isHidden = hiddenProtocols.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleHiddenProtocol(key)}
              onDoubleClick={() => isolateProtocol(key, allProtocols)}
              className={cn(
                "w-full flex items-center gap-2.5 py-1 px-1 -mx-1 rounded text-left transition-colors",
                "hover:bg-zinc-100 dark:hover:bg-zinc-900",
                isHidden && "opacity-40",
              )}
              title={
                isHidden
                  ? `Click to show ${label} edges`
                  : `Click to hide • Double-click to isolate ${label}`
              }
            >
              <svg width="24" height="8" className="flex-shrink-0 overflow-visible">
                <line
                  x1="0"
                  y1="4"
                  x2="24"
                  y2="4"
                  stroke={color.primary}
                  strokeWidth={style.strokeWidth ?? 2}
                  strokeDasharray={style.strokeDasharray}
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-[11px] text-zinc-700 dark:text-zinc-300 flex-1">{label}</span>
              {isHidden && <EyeSlashIcon className="w-3 h-3 text-zinc-400 dark:text-zinc-600" />}
            </button>
          );
        })}
      </div>

      <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800 text-[9px] text-zinc-400 dark:text-zinc-600">
        Click toggle · Dbl-click isolate
      </div>
    </div>
  );
}
