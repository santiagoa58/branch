import { useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow, useStoreApi } from "@xyflow/react";
import { Icon as IconifyIcon } from "@iconify/react";
import { MagnifyingGlassIcon, CommandLineIcon } from "@heroicons/react/24/outline";
import { useDiagramStore } from "@/store/diagramStore";
import { useUIStore } from "@/store/uiStore";
import { NODE_TYPES_CONFIG } from "@/constants";
import type { ArchitectureNodeData } from "@/types";
import { cn } from "@/lib/utils";

const MAX_RESULTS = 8;

interface Result {
  id: string;
  label: string;
  type: string;
  description?: string;
  iconifyIcon?: string;
  /** Lower is better. Used for ranking. */
  score: number;
}

/**
 * Subsequence fuzzy matcher. Returns null if `query` is not a subsequence
 * of `target` (case-insensitive); otherwise returns a score where lower is
 * better. Bonuses for matches at word boundaries (start, after space/_/-/.)
 * and for consecutive runs; penalties for gaps and late match positions.
 */
function fuzzyScore(query: string, target: string): number | null {
  if (!query) {
    return 0;
  }
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  let qi = 0;
  let lastMatchIdx = -1;
  let score = 0;
  let prevMatched = false;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) {
      prevMatched = false;
      continue;
    }
    // Gap from previous match (or distance from start for first match).
    score += lastMatchIdx >= 0 ? ti - lastMatchIdx - 1 : ti;
    // Word-boundary bonus.
    const prev = ti === 0 ? "" : t[ti - 1];
    if (ti === 0 || prev === " " || prev === "_" || prev === "-" || prev === "." || prev === "/") {
      score -= 8;
    }
    // Consecutive-character bonus.
    if (prevMatched) {
      score -= 4;
    }
    lastMatchIdx = ti;
    qi++;
    prevMatched = true;
  }

  return qi === q.length ? score : null;
}

// oxlint-disable-next-line max-lines-per-function -- debt: 222 lines; split into smaller units
export function SpotlightSearch() {
  const open = useUIStore((s) => s.spotlightOpen);
  const setOpen = useUIStore((s) => s.setSpotlightOpen);
  const nodes = useDiagramStore((s) => s.nodes);
  const setSelectedNode = useDiagramStore((s) => s.setSelectedNode);
  const { setCenter, getZoom } = useReactFlow();
  const rfStore = useStoreApi();

  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const archNodes = nodes.filter((n) => n.type === "architecture");
    const q = query.trim().toLowerCase();

    if (!q) {
      // Empty query → most recent nodes (last in array first).
      return archNodes
        .slice(-MAX_RESULTS)
        .reverse()
        .map((n) => {
          const data = n.data as ArchitectureNodeData;
          return {
            id: n.id,
            label: data.label || n.id,
            type: data.type,
            ...(data.description === undefined ? {} : { description: data.description }),
            ...(data.iconifyIcon === undefined ? {} : { iconifyIcon: data.iconifyIcon }),
            score: 0,
          };
        });
    }

    // Field weights — added to the per-field fuzzy score so that label
    // matches outrank type matches outrank technology/description matches.
    const FIELD_OFFSETS = { label: 0, type: 20, technology: 30, description: 50 };

    const scored: Result[] = [];
    for (const n of archNodes) {
      const data = n.data as ArchitectureNodeData;
      const labelScore = fuzzyScore(q, data.label || "");
      const typeScore = fuzzyScore(q, data.type || "");
      const techScore = fuzzyScore(q, data.technology || "");
      const descScore = fuzzyScore(q, data.description || "");

      const candidates: number[] = [];
      if (labelScore !== null) {
        candidates.push(labelScore + FIELD_OFFSETS.label);
      }
      if (typeScore !== null) {
        candidates.push(typeScore + FIELD_OFFSETS.type);
      }
      if (techScore !== null) {
        candidates.push(techScore + FIELD_OFFSETS.technology);
      }
      if (descScore !== null) {
        candidates.push(descScore + FIELD_OFFSETS.description);
      }
      if (candidates.length === 0) {
        continue;
      }

      scored.push({
        id: n.id,
        label: data.label || n.id,
        type: data.type,
        ...(data.description === undefined ? {} : { description: data.description }),
        ...(data.iconifyIcon === undefined ? {} : { iconifyIcon: data.iconifyIcon }),
        score: Math.min(...candidates),
      });
    }
    scored.sort((a, b) => a.score - b.score || a.label.localeCompare(b.label));
    return scored.slice(0, MAX_RESULTS);
  }, [query, nodes]);

  const visibleActiveIdx = activeIdx < results.length ? activeIdx : 0;

  const handleSelect = (id: string) => {
    const node = nodes.find((n) => n.id === id);
    if (!node) {
      return;
    }

    // node.position is relative to the parent group, so we need the React
    // Flow store's positionAbsolute for nested nodes. Fall back to the raw
    // position for ungrouped nodes (or when nodeLookup hasn't measured yet).
    const { nodeLookup } = rfStore.getState();
    const internalNode = nodeLookup.get(id);
    const abs = internalNode?.internals.positionAbsolute ?? node.position;

    const w = node.measured?.width ?? node.width ?? 160;
    const h = node.measured?.height ?? node.height ?? 80;
    const cx = abs.x + w / 2;
    const cy = abs.y + h / 2;
    const zoom = Math.max(getZoom(), 1.1);
    void setCenter(cx, cy, { zoom, duration: 400 });
    setSelectedNode(id);
    setOpen(false);
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-200 flex items-start justify-center pt-[15vh] animate-slide-in">
      <button
        type="button"
        aria-label="Close search"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />
      <dialog
        open
        aria-label="Search nodes"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={cn(
          "w-full max-w-lg mx-4",
          "bg-popover text-popover-foreground border border-border rounded-xl",
          "shadow-2xl shadow-black/40 overflow-hidden",
        )}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring">
          <MagnifyingGlassIcon className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIdx((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIdx((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const hit = results[visibleActiveIdx];
                if (hit) {
                  handleSelect(hit.id);
                }
              } else if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
              }
            }}
            placeholder="Find a node by name, type, technology…"
            className="flex-1 bg-transparent outline-none text-sm text-popover-foreground placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-muted-foreground border border-border rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[55vh] overflow-y-auto">
          {results.length === 0 && (
            <div className="px-4 py-10 text-center text-xs text-muted-foreground">
              No matching nodes
            </div>
          )}
          {results.map((r, i) => {
            const config = NODE_TYPES_CONFIG[r.type as keyof typeof NODE_TYPES_CONFIG];
            const Icon = config?.icon;
            const isActive = i === visibleActiveIdx;
            return (
              <button
                key={r.id}
                type="button"
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => handleSelect(r.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/60 hover:text-accent-foreground",
                )}
              >
                <div
                  className={cn(
                    "shrink-0 w-7 h-7 rounded-md flex items-center justify-center border",
                    config?.bgClass,
                    config?.borderClass,
                  )}
                >
                  {r.iconifyIcon ? (
                    <IconifyIcon icon={r.iconifyIcon} width={14} height={14} />
                  ) : Icon ? (
                    <Icon className={cn("w-3.5 h-3.5", config?.iconColor)} strokeWidth={1.5} />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-popover-foreground truncate">
                    {r.label}
                  </div>
                  {r.description && (
                    <div className="text-[10px] text-muted-foreground truncate">
                      {r.description}
                    </div>
                  )}
                </div>
                <span className="text-[9px] font-mono uppercase tracking-tight text-muted-foreground shrink-0">
                  {r.type}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border text-[10px] font-mono text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="border border-border rounded px-1">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="border border-border rounded px-1">⏎</kbd>
              jump
            </span>
          </div>
          <span className="flex items-center gap-1 opacity-60">
            <CommandLineIcon className="w-3 h-3" />
            Spotlight
          </span>
        </div>
      </dialog>
    </div>
  );
}
