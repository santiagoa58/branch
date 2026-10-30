import { useState, useMemo } from "react";
import { TagIcon, XMarkIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { useDiagramStore } from "@/store/diagramStore";
import { useUIStore } from "@/store/uiStore";
import { ArchitectureEdgeData, ArchitectureNodeData } from "@/types";
import { cn } from "@/lib/utils";

export function TagFilter() {
  const [open, setOpen] = useState(false);
  const nodes = useDiagramStore((s) => s.nodes);
  const edges = useDiagramStore((s) => s.edges);
  const hiddenTags = useUIStore((s) => s.hiddenTags);
  const toggleHiddenTag = useUIStore((s) => s.toggleHiddenTag);
  const isolateTag = useUIStore((s) => s.isolateTag);
  const clearHiddenTags = useUIStore((s) => s.clearHiddenTags);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    const bump = (tag: string) => counts.set(tag, (counts.get(tag) || 0) + 1);
    for (const n of nodes) {
      if (n.type === "architecture") {
        const t = (n.data as ArchitectureNodeData).tags;
        if (Array.isArray(t)) {
          for (const tag of t) {
            bump(tag);
          }
        }
      }
    }
    for (const e of edges) {
      const t = (e.data as ArchitectureEdgeData | undefined)?.tags;
      if (Array.isArray(t)) {
        for (const tag of t) {
          bump(tag);
        }
      }
    }
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [nodes, edges]);

  const allTagNames = useMemo(() => allTags.map((t) => t.tag), [allTags]);
  const anyHidden = hiddenTags.size > 0;

  if (allTags.length === 0) {
    return null;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          // Sits below the protocol legend pill (top-4 + ~40px button + 8px gap).
          "absolute top-15 right-4 z-20 flex items-center gap-1.5 px-2.5 py-1.5",
          "bg-white/90 dark:bg-zinc-950/80 backdrop-blur-md",
          "border border-zinc-200 dark:border-zinc-800 rounded-lg",
          "shadow shadow-black/5 dark:shadow-black/40",
          "font-mono text-[10px] font-semibold uppercase tracking-wider",
          "text-zinc-500 dark:text-zinc-400",
          "hover:text-zinc-700 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors",
        )}
        title="Show tag filter"
      >
        <TagIcon className="w-3 h-3" />
        <span>Tags</span>
        <span className="text-muted-foreground normal-case font-normal">{allTags.length}</span>
        {anyHidden && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "absolute top-15 right-4 z-20 min-w-50 max-w-65 px-3.5 py-2.5",
        "bg-white/95 dark:bg-zinc-950/85 backdrop-blur-md",
        "border border-zinc-200 dark:border-zinc-800 rounded-lg",
        "shadow-lg shadow-black/5 dark:shadow-black/40",
        "animate-slide-in",
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Tags
        </span>
        <div className="flex items-center gap-0.5">
          {anyHidden && (
            <button
              type="button"
              onClick={clearHiddenTags}
              className="text-[9px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 px-1 py-0.5 rounded"
              title="Show all tags"
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
            <XMarkIcon className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="space-y-0.5 max-h-[40vh] overflow-y-auto">
        {allTags.map(({ tag, count }) => {
          const isHidden = hiddenTags.has(tag.toLowerCase());
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleHiddenTag(tag)}
              onDoubleClick={() => isolateTag(tag, allTagNames)}
              className={cn(
                "w-full flex items-center gap-2 py-1 px-1.5 -mx-1 rounded text-left transition-colors",
                "hover:bg-zinc-100 dark:hover:bg-zinc-900",
                isHidden && "opacity-40",
              )}
              title={
                isHidden
                  ? `Click to show "${tag}"`
                  : `Click to hide • Double-click to isolate "${tag}"`
              }
            >
              <span className="text-[11px] font-mono text-zinc-700 dark:text-zinc-300 flex-1 truncate">
                {tag}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground shrink-0">{count}</span>
              {isHidden && (
                <EyeSlashIcon className="w-3 h-3 text-zinc-400 dark:text-zinc-600 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-800 text-[9px] text-muted-foreground">
        Click toggle · Dbl-click isolate
      </div>
    </div>
  );
}
