import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  XMarkIcon,
  EyeIcon,
  ArrowsRightLeftIcon,
  TagIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { nodeTypes } from "@/components/nodes";
import type { ApiDiagramVersionFull } from "@/services/api";
import { diagramDataSchema } from "@/schemas/diagram";

// ─── Diff types & styles ─────────────────────────────────────────────────────

type DiffStatus = "added" | "removed" | "modified" | "unchanged";

const DIFF_NODE_SHADOW: Record<DiffStatus, React.CSSProperties> = {
  added: { boxShadow: "0 0 0 3px #22c55e", borderRadius: "8px" },
  removed: { boxShadow: "0 0 0 3px #ef4444", borderRadius: "8px", opacity: 0.55 },
  modified: { boxShadow: "0 0 0 3px #f59e0b", borderRadius: "8px" },
  unchanged: {},
};

const DIFF_EDGE_STYLE: Record<DiffStatus, React.CSSProperties> = {
  added: { stroke: "#22c55e", strokeWidth: 3 },
  removed: { stroke: "#ef4444", strokeWidth: 3, strokeDasharray: "8 4" },
  modified: { stroke: "#f59e0b", strokeWidth: 3 },
  unchanged: { stroke: "#94a3b8", strokeWidth: 1.5 },
};

// ─── Diff computation ─────────────────────────────────────────────────────────

function computeDiff(vNodes: Node[], vEdges: Edge[], cNodes: Node[], cEdges: Edge[]) {
  const cNodeMap = new Map(cNodes.map((n) => [n.id, n]));
  const vNodeMap = new Map(vNodes.map((n) => [n.id, n]));
  const cEdgeMap = new Map(cEdges.map((e) => [e.id, e]));
  const vEdgeMap = new Map(vEdges.map((e) => [e.id, e]));

  const diffNodes: Node[] = [];

  for (const vn of vNodes) {
    const cn = cNodeMap.get(vn.id);
    if (!cn) {
      diffNodes.push({
        ...vn,
        style: { ...(vn.style as React.CSSProperties), ...DIFF_NODE_SHADOW.removed },
        draggable: false,
        selectable: false,
      });
    } else {
      const status: DiffStatus =
        JSON.stringify(vn.data) !== JSON.stringify(cn.data) ? "modified" : "unchanged";
      diffNodes.push({
        ...vn,
        style: { ...(vn.style as React.CSSProperties), ...DIFF_NODE_SHADOW[status] },
        draggable: false,
        selectable: false,
      });
    }
  }

  // Nodes added in current (not present in version snapshot)
  for (const cn of cNodes) {
    if (!vNodeMap.has(cn.id)) {
      diffNodes.push({
        ...cn,
        style: { ...(cn.style as React.CSSProperties), ...DIFF_NODE_SHADOW.added },
        draggable: false,
        selectable: false,
      });
    }
  }

  const diffEdges: Edge[] = [];

  for (const ve of vEdges) {
    const ce = cEdgeMap.get(ve.id);
    if (!ce) {
      diffEdges.push({ ...ve, style: { ...DIFF_EDGE_STYLE.removed }, animated: false });
    } else {
      const status: DiffStatus =
        JSON.stringify(ve.data) !== JSON.stringify(ce.data) ? "modified" : "unchanged";
      diffEdges.push({ ...ve, style: { ...DIFF_EDGE_STYLE[status] }, animated: false });
    }
  }

  // Edges added in current
  for (const ce of cEdges) {
    if (!vEdgeMap.has(ce.id)) {
      diffEdges.push({ ...ce, style: { ...DIFF_EDGE_STYLE.added }, animated: false });
    }
  }

  return { diffNodes, diffEdges };
}

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

  const vData = useMemo(() => {
    const result = diagramDataSchema.safeParse(version.data);
    return result.success ? result.data : { nodes: [], edges: [] };
  }, [version.data]);

  const vNodes: Node[] = useMemo(
    () => vData.nodes.map((node) => ({ ...node, draggable: false, selectable: false })),
    [vData.nodes],
  );
  const vEdges: Edge[] = useMemo(
    () => vData.edges.map((edge) => ({ ...edge, animated: false })),
    [vData.edges],
  );

  const { diffNodes, diffEdges } = useMemo(
    () => computeDiff(vNodes, vEdges, currentNodes, currentEdges),
    // version.id change triggers a new fetch so vNodes/vEdges will be new refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version.id, vNodes, vEdges, currentNodes, currentEdges],
  );

  const addedCount = useMemo(
    () => currentNodes.filter((n) => !vNodes.some((v) => v.id === n.id)).length,
    [vNodes, currentNodes],
  );
  const removedCount = useMemo(
    () => vNodes.filter((n) => !currentNodes.some((c) => c.id === n.id)).length,
    [vNodes, currentNodes],
  );
  const modifiedCount = useMemo(
    () =>
      vNodes.filter((n) => {
        const cn = currentNodes.find((c) => c.id === n.id);
        return cn && JSON.stringify(n.data) !== JSON.stringify(cn.data);
      }).length,
    [vNodes, currentNodes],
  );

  const displayNodes = mode === "preview" ? vNodes : diffNodes;
  const displayEdges = mode === "preview" ? vEdges : diffEdges;

  return createPortal(
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close version preview"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col w-full max-w-4xl h-[82vh]">
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

            {/* Diff stats */}
            {mode === "diff" && (
              <div className="flex items-center gap-2">
                {addedCount > 0 && (
                  <span className="text-xs bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900 px-2 py-0.5 rounded-full">
                    +{addedCount} added
                  </span>
                )}
                {removedCount > 0 && (
                  <span className="text-xs bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900 px-2 py-0.5 rounded-full">
                    -{removedCount} removed
                  </span>
                )}
                {modifiedCount > 0 && (
                  <span className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900 px-2 py-0.5 rounded-full">
                    ~{modifiedCount} modified
                  </span>
                )}
                {addedCount === 0 && removedCount === 0 && modifiedCount === 0 && (
                  <span className="text-xs text-muted-foreground">No changes vs current</span>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 transition-colors shrink-0"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Canvas */}
        <div className="flex-1 min-h-0">
          <ReactFlowProvider>
            <ReactFlow
              nodes={displayNodes}
              edges={displayEdges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              panOnScroll
              zoomOnScroll
              zoomOnPinch
              colorMode="system"
            >
              <Background gap={20} size={1} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </ReactFlowProvider>
        </div>

        {/* Diff legend footer */}
        {mode === "diff" && (
          <div className="flex items-center gap-5 px-5 py-2.5 border-t border-zinc-200 dark:border-zinc-800 shrink-0 bg-zinc-50 dark:bg-zinc-900/50 rounded-b-xl">
            <span className="text-xs text-muted-foreground font-medium">Legend:</span>
            {[
              { dot: "bg-green-500", label: "Added in current" },
              { dot: "bg-red-500", label: "Removed in current" },
              { dot: "bg-amber-500", label: "Modified" },
            ].map(({ dot, label }) => (
              <span
                key={label}
                className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400"
              >
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
                {label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
