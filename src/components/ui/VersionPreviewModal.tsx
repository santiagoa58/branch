import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Node, Edge } from "@xyflow/react";
import {
  XMarkIcon,
  EyeIcon,
  ArrowsRightLeftIcon,
  TagIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { DiagramDiffCanvas, DiffCounts } from "@/components/ui/DiagramDiffCanvas";
import type { ApiDiagramVersionFull } from "@/services/api";
import { diagramDataSchema } from "@/schemas/diagram";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface VersionPreviewModalProps {
  version: ApiDiagramVersionFull;
  currentNodes: Node[];
  currentEdges: Edge[];
  onClose: () => void;
}

export function VersionPreviewModal({
  version,
  currentNodes,
  currentEdges,
  onClose,
}: VersionPreviewModalProps) {
  const [mode, setMode] = useState<"preview" | "diff">("preview");

  const snapshot = useMemo(() => {
    const result = diagramDataSchema.safeParse(version.data);
    return result.success ? result.data : { nodes: [], edges: [] };
  }, [version.data]);
  const current = useMemo(
    () => ({ nodes: currentNodes, edges: currentEdges }),
    [currentNodes, currentEdges],
  );

  return createPortal(
    <div
      data-editor-shortcuts="blocked"
      className="fixed inset-0 z-60 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close version preview"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col w-full max-w-4xl h-[82vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Version label */}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  v{version.versionNumber}
                </span>
                {version.label && (
                  <span className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded-full">
                    <TagIcon className="w-2.5 h-2.5" />
                    {version.label}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <ClockIcon className="w-3 h-3" />
                {formatDate(version.createdAt)}
              </p>
            </div>

            {/* Mode toggle */}
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setMode("preview")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  mode === "preview"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                }`}
              >
                <EyeIcon className="w-3.5 h-3.5" />
                Preview
              </button>
              <button
                type="button"
                onClick={() => setMode("diff")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  mode === "diff"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                }`}
              >
                <ArrowsRightLeftIcon className="w-3.5 h-3.5" />
                Diff vs current
              </button>
            </div>

            {mode === "diff" && <DiffCounts before={snapshot} after={current} />}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 transition-colors shrink-0"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        <DiagramDiffCanvas
          before={snapshot}
          after={current}
          view={mode === "preview" ? "before" : "diff"}
          legend={{
            added: "Added in current",
            removed: "Removed in current",
            modified: "Modified",
          }}
        />
      </div>
    </div>,
    document.body,
  );
}
