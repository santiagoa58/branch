import { useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { nodeTypes } from "@/components/nodes";
import { diffDiagrams, type DiagramSide, type DiffStatus } from "@/utils/diagramDiff";

// React Flow styles nodes and edges through style objects, not class names.
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

const LEGEND_DOTS: Record<Exclude<DiffStatus, "unchanged">, string> = {
  added: "bg-green-500",
  removed: "bg-red-500",
  modified: "bg-amber-500",
};

export type DiffView = "before" | "after" | "diff";

export interface DiffLegendLabels {
  added: string;
  removed: string;
  modified: string;
}

interface DiagramDiffCanvasProps {
  before: DiagramSide;
  after: DiagramSide;
  view: DiffView;
  legend: DiffLegendLabels;
}

function readOnly(nodes: Node[], edges: Edge[]) {
  return {
    nodes: nodes.map((node) => ({ ...node, draggable: false, selectable: false })),
    edges: edges.map((edge) => ({ ...edge, animated: false })),
  };
}

/** A read-only canvas showing one side of a comparison, or how `after` differs from `before`. */
export function DiagramDiffCanvas({ before, after, view, legend }: DiagramDiffCanvasProps) {
  const display = useMemo(() => {
    if (view !== "diff") {
      const side = view === "before" ? before : after;
      return readOnly(side.nodes, side.edges);
    }
    const diff = diffDiagrams(before, after);
    return readOnly(
      diff.nodes.map(({ node, status }) => ({
        ...node,
        style: { ...(node.style as React.CSSProperties), ...DIFF_NODE_SHADOW[status] },
      })),
      diff.edges.map(({ edge, status }) => ({ ...edge, style: { ...DIFF_EDGE_STYLE[status] } })),
    );
  }, [before, after, view]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1">
        <ReactFlowProvider>
          <ReactFlow
            nodes={display.nodes}
            edges={display.edges}
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
      {view === "diff" && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-1 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-5 py-2.5">
          <span className="text-xs font-medium text-muted-foreground">Legend:</span>
          {(Object.keys(LEGEND_DOTS) as (keyof typeof LEGEND_DOTS)[]).map((status) => (
            <span
              key={status}
              className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400"
            >
              <span className={`size-2.5 shrink-0 rounded-full ${LEGEND_DOTS[status]}`} />
              {legend[status]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Small "+2 added" style badges summarizing a comparison. */
export function DiffCounts({ before, after }: { before: DiagramSide; after: DiagramSide }) {
  const { counts } = useMemo(() => diffDiagrams(before, after), [before, after]);
  if (counts.added === 0 && counts.removed === 0 && counts.modified === 0) {
    return <span className="text-xs text-muted-foreground">Same components and connections</span>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {counts.added > 0 && (
        <span className="rounded-full border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/40 px-2 py-0.5 text-xs text-green-700 dark:text-green-400">
          +{counts.added} added
        </span>
      )}
      {counts.removed > 0 && (
        <span className="rounded-full border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 text-xs text-red-700 dark:text-red-400">
          -{counts.removed} removed
        </span>
      )}
      {counts.modified > 0 && (
        <span className="rounded-full border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
          ~{counts.modified} modified
        </span>
      )}
    </div>
  );
}
