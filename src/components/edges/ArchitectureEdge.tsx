import { BaseEdge, EdgeLabelRenderer, EdgeProps, type Edge, getBezierPath } from "@xyflow/react";
import { cn } from "@/lib/utils";
import type { ArchitectureEdgeData } from "@/types";

import { useSimulationStore } from "@/store/simulationStore";
import { useEdgeAnimation } from "@/hooks/useEdgeAnimation";
import { useUIStore } from "@/store/uiStore";
import { useState, useCallback } from "react";
import { PROTOCOL_CONFIG } from "@/constants";
import { EdgeDetailsDialog } from "@/components/ui/EdgeDetailsDialog";

export function ArchitectureEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<Edge<ArchitectureEdgeData>>) {
  const edgeData = data;

  const isProtocolHidden = useUIStore((s) =>
    edgeData?.protocol ? s.hiddenProtocols.has(edgeData.protocol) : false,
  );
  const isTagHidden = useUIStore((s) => {
    if (!edgeData?.tags || edgeData.tags.length === 0) {
      return false;
    }
    for (const t of edgeData.tags) {
      if (s.hiddenTags.has(t.toLowerCase())) {
        return true;
      }
    }
    return false;
  });
  const isEdgeDimmed = isProtocolHidden || isTagHidden;

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDialogOpen(true);
  }, []);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isAnimated = edgeData?.animated ?? false;

  // Simulation state
  const activePathEdgeIds = useSimulationStore((s) => s.activePathEdgeIds);
  const affectedEdgeIds = useSimulationStore((s) => s.affectedEdgeIds);
  const severedEdgeIds = useSimulationStore((s) => s.severedEdgeIds);
  const isSimulationRunning = useSimulationStore((s) => s.isRunning);
  const simulationSpeed = useSimulationStore((s) => s.speed);

  const isOnActivePath = activePathEdgeIds.includes(id);
  const isBrokenEdge = affectedEdgeIds.includes(id);
  const isSevered = severedEdgeIds.includes(id);

  // Compute effective speed for edge animation
  const effectiveSpeed = isOnActivePath && isSimulationRunning ? simulationSpeed : 1;

  // GSAP edge animation hook
  const { containerRef, dashPathRef, dotInnerRef, dotOuterRef } = useEdgeAnimation({
    edgePath,
    isAnimated: isAnimated && !isBrokenEdge,
    speed: effectiveSpeed,
  });

  // Theme-aware edge colors
  const edgeColors = {
    default: "var(--edge-color)",
    selected: "var(--edge-selected)",
  };

  const getProtocolColor = () => {
    const protocol = edgeData?.protocol || "http";
    const config = PROTOCOL_CONFIG[protocol];
    return config
      ? { primary: config.color.primary, secondary: config.color.secondary }
      : { primary: "#3b82f6", secondary: "#60a5fa" };
  };

  const protocolColors = getProtocolColor();

  const getEdgeStyle = () => {
    const baseStyle: React.CSSProperties = {
      strokeWidth: 2,
      stroke: selected ? edgeColors.selected : edgeColors.default,
    };

    // If async, use dotted pattern regardless of protocol
    if (edgeData?.async) {
      return { ...baseStyle, strokeDasharray: "2 4" };
    }

    const protocol = edgeData?.protocol || "http";
    const config = PROTOCOL_CONFIG[protocol];

    if (config?.style.strokeDasharray) {
      return { ...baseStyle, strokeDasharray: config.style.strokeDasharray };
    }
    if (config?.style.strokeWidth) {
      return { ...baseStyle, strokeWidth: config.style.strokeWidth };
    }

    return baseStyle;
  };

  const label =
    edgeData?.label || (edgeData?.method ? edgeData.method : edgeData?.protocol?.toUpperCase());

  // Build label with async indicator and schema name
  let fullLabel = label;

  // Add async indicator
  if (edgeData?.async) {
    fullLabel = fullLabel ? `${fullLabel} (async)` : "(async)";
  }

  // Append schema name to label if data contract exists
  if (edgeData?.dataContract?.schemaName) {
    const baseLabel = fullLabel || edgeData?.protocol?.toUpperCase() || "DATA";
    fullLabel = `${baseLabel} • ${edgeData.dataContract.schemaName}`;
  }

  const hasDecision = !!edgeData?.decision &&
    Object.values(edgeData.decision).some((value) => value?.trim());

  // Determine marker IDs for bidirectional support
  const isBidirectional = edgeData?.bidirectional ?? false;
  const markerEnd = isBidirectional ? `url(#arrow-${id}-end)` : "url(#arrow-end)";
  const markerStart = isBidirectional ? `url(#arrow-${id}-start)` : undefined;

  return (
    <g
      data-edge-id={id}
      style={
        isEdgeDimmed
          ? { opacity: 0.12, transition: "opacity 200ms ease" }
          : { transition: "opacity 200ms ease" }
      }
    >
      {/* Arrow markers for bidirectional edges */}
      {isBidirectional && (
        <defs>
          <marker
            id={`arrow-${id}-end`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path
              d="M 0 0 L 10 5 L 0 10 z"
              fill={selected ? edgeColors.selected : edgeColors.default}
            />
          </marker>
          <marker
            id={`arrow-${id}-start`}
            viewBox="0 0 10 10"
            refX="1"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path
              d="M 0 0 L 10 5 L 0 10 z"
              fill={selected ? edgeColors.selected : edgeColors.default}
            />
          </marker>
        </defs>
      )}

      {/* Base edge line */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={getEdgeStyle()}
        markerEnd={markerEnd}
        {...(markerStart ? { markerStart } : {})}
      />

      {/* Animated flow overlay - GSAP-powered */}
      {isAnimated && (
        <g ref={containerRef}>
          {/* Glow effect layer */}
          <path
            d={edgePath}
            fill="none"
            strokeWidth={isOnActivePath ? 8 : 6}
            stroke={isBrokenEdge ? "#ef4444" : protocolColors.primary}
            strokeLinecap="round"
            opacity={isOnActivePath ? 0.5 : 0.3}
          />
          {/* Animated dashes — driven by GSAP strokeDashoffset */}
          <path
            ref={dashPathRef}
            d={edgePath}
            fill="none"
            strokeWidth={3}
            stroke={isBrokenEdge ? "#f87171" : protocolColors.secondary}
            strokeDasharray="8 16"
            strokeLinecap="round"
          />
          {/* Moving dot — positioned by GSAP MotionPathPlugin */}
          <circle
            ref={dotInnerRef}
            r="4"
            fill={isBrokenEdge ? "#f87171" : protocolColors.secondary}
            className="animated-edge-dot"
          />
          <circle
            ref={dotOuterRef}
            r="6"
            fill={isBrokenEdge ? "#ef4444" : protocolColors.primary}
            opacity={0.4}
          />
        </g>
      )}

      {/* Non-animated edge: still support simulation highlighting */}
      {!isAnimated && (isOnActivePath || isBrokenEdge) && (
        <g>
          <path
            d={edgePath}
            fill="none"
            strokeWidth={isBrokenEdge ? 4 : 6}
            stroke={isBrokenEdge ? "#ef4444" : protocolColors.primary}
            strokeLinecap="round"
            opacity={0.4}
          />
        </g>
      )}

      {/* Severed edge overlay (network partition) */}
      {isSevered && (
        <g>
          <path
            d={edgePath}
            fill="none"
            strokeWidth={4}
            stroke="#a855f7"
            strokeDasharray="6 8"
            strokeLinecap="round"
            opacity={0.7}
          />
          <path
            d={edgePath}
            fill="none"
            strokeWidth={8}
            stroke="#a855f7"
            strokeLinecap="round"
            opacity={0.15}
          />
        </g>
      )}

      <EdgeLabelRenderer>
        {hasDecision && (
          <div
            title={edgeData?.decision?.reason || "Design reasoning documented"}
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX + 26}px, ${labelY - 24}px)`,
              pointerEvents: "none",
            }}
            className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-1 text-[9px] text-muted-foreground"
          >
            Why
          </div>
        )}
        {/* Invisible hit area at edge centre — always present for double-click */}
        {!fullLabel && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
              width: 24,
              height: 24,
            }}
            onDoubleClick={handleDoubleClick}
          />
        )}

        {fullLabel && (
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: isEdgeDimmed ? "none" : "all",
              opacity: isEdgeDimmed ? 0.2 : 1,
              transition: "opacity 200ms ease",
            }}
            className={cn(
              "px-2 py-0.5 text-[10px] font-medium rounded-full cursor-pointer",
              "bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700",
              "text-zinc-600 dark:text-zinc-400",
              "hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors",
              selected && "border-zinc-400 dark:border-zinc-500 text-zinc-800 dark:text-zinc-200",
            )}
            title="Double-click to view edge details"
            onDoubleClick={handleDoubleClick}
          >
            {fullLabel}
          </div>
        )}
      </EdgeLabelRenderer>

      <EdgeDetailsDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        edgeId={id}
        data={edgeData}
      />
    </g>
  );
}
