import { BaseEdge, EdgeLabelRenderer, type EdgeProps, type Edge } from "@xyflow/react";
import { useCallback } from "react";
import { cn } from "@/lib/utils";
import type { RollupEdgeData, EdgeProtocol } from "@/types";
import { PROTOCOL_CONFIG } from "@/constants";
import type { ConnectionFocusData } from "@/utils/connectionFocus";

import { useDiagramStore } from "@/store/diagramStore";
import { useEditBlocked } from "@/store/editLock";
import { useEdgeLabelPosition } from "@/hooks/useEdgeLabelPosition";
import { useEdgeRoute } from "@/hooks/useEdgeRoute";

/**
 * Synthetic aggregated edge shown when edges cross a collapsed group's
 * boundary (see utils/groupRollup.ts). Renders a dashed connector with a
 * count badge; clicking the badge expands the collapsed group(s) it hides.
 */
export function RollupEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<Edge<Partial<RollupEdgeData> & ConnectionFocusData>>) {
  const {
    connectionFocus,
    count = 0,
    protocols = [],
    bidirectional = false,
    collapsedGroupIds = [],
  } = data ?? {};
  const highlighted = connectionFocus === "highlighted";
  const dimmed = connectionFocus === "dimmed";

  const toggleGroupCollapse = useDiagramStore((s) => s.toggleGroupCollapse);
  // Expanding the groups is an edit, so it is off while edits are blocked (an AI run).
  const editBlocked = useEditBlocked();

  const {
    path: edgePath,
    labelX: preferredLabelX,
    labelY: preferredLabelY,
  } = useEdgeRoute(id, { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  const { labelRef, labelX, labelY } = useEdgeLabelPosition(
    preferredLabelX,
    preferredLabelY,
    false,
    id,
  );

  const handleExpand = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      collapsedGroupIds.forEach((groupId) => toggleGroupCollapse(groupId));
    },
    [collapsedGroupIds, toggleGroupCollapse],
  );

  const stroke = highlighted ? "var(--edge-focus)" : "var(--edge-color)";
  // Thicker line the more edges it stands in for (capped).
  const strokeWidth = Math.max(highlighted ? 3 : 2, Math.min(2 + (count - 1) * 0.5, 4));

  return (
    <g
      data-edge-id={id}
      data-connection-focus={connectionFocus}
      style={{ opacity: dimmed ? 0.18 : 1, transition: "opacity 200ms ease" }}
    >
      <defs>
        <marker
          id={`rollup-arrow-${id}-end`}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={stroke} />
        </marker>
      </defs>
      {highlighted && (
        <path
          className="connection-focus-glow"
          d={edgePath}
          fill="none"
          stroke={stroke}
          strokeWidth={9}
          strokeLinecap="round"
          opacity={0.16}
          pointerEvents="none"
        />
      )}
      <BaseEdge
        path={edgePath}
        style={{ stroke, strokeWidth, strokeDasharray: "7 4" }}
        markerEnd={`url(#rollup-arrow-${id}-end)`}
        {...(bidirectional ? { markerStart: `url(#rollup-arrow-${id}-end)` } : {})}
      />
      <EdgeLabelRenderer>
        <button
          ref={labelRef}
          data-connection-focus={connectionFocus}
          type="button"
          onClick={handleExpand}
          disabled={editBlocked}
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
            opacity: dimmed ? 0.2 : 1,
          }}
          className={cn(
            "connection-label nodrag nopan flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold cursor-pointer transition-colors disabled:cursor-default",
            "bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm",
            "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300",
            "hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400",
          )}
          title={`${count} connection${count === 1 ? "" : "s"} rolled up${
            protocols.length ? ` (${protocols.join(", ")})` : ""
          } — click to expand`}
        >
          {/* Protocol color dots (up to 4) */}
          {protocols.slice(0, 4).map((p) => (
            <span
              key={p}
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                backgroundColor: PROTOCOL_CONFIG[p as EdgeProtocol]?.color.primary ?? "#71717a",
              }}
            />
          ))}
          <span>
            {count} connection{count === 1 ? "" : "s"}
          </span>
        </button>
      </EdgeLabelRenderer>
    </g>
  );
}
