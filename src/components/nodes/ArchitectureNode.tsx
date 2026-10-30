import { memo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Icon as IconifyIcon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { NODE_TYPES_CONFIG, HEALTH_STATUS_STYLES } from "@/constants";
import type { ArchitectureNode as ArchitectureFlowNode } from "@/types";
import { useDiagramStore } from "@/store/diagramStore";
import { useSimulationStore } from "@/store/simulationStore";
import { useAnimationStore } from "@/store/animationStore";
import { useUIStore } from "@/store/uiStore";
import { HeartIcon } from "@heroicons/react/24/outline";
import { LoadingIndicator } from "@/components/ui/loading";
import { IconPickerDialog } from "@/components/ui/IconPickerDialog";

export const ArchitectureNode = memo(
  ({ data: nodeData, selected, id }: NodeProps<ArchitectureFlowNode>) => {
    const config = NODE_TYPES_CONFIG[nodeData.type];
    const Icon = config.icon;
    const getNodeHealthResult = useDiagramStore((state) => state.getNodeHealthResult);
    const updateNodeData = useDiagramStore((state) => state.updateNodeData);

    // Inline editing state
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    // Icon picker state
    const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);

    // Tooltip hover state
    const [showTooltip, setShowTooltip] = useState(false);
    const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hasDescription = !!nodeData.description?.trim();

    // Auto-focus and select text when entering edit mode
    useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, [isEditing]);

    const getStatusColor = () => {
      switch (nodeData.status) {
        case "active":
          return "bg-emerald-500 border-emerald-400";
        case "warning":
          return "bg-amber-500 border-amber-400";
        case "inactive":
          return "bg-zinc-400 dark:bg-zinc-600 border-zinc-300 dark:border-zinc-500";
        case undefined:
          return null;
        default:
          return null;
      }
    };

    const statusColor = getStatusColor();
    const healthResult = getNodeHealthResult(id);
    const hasHealthCheck = !!nodeData.healthCheckUrl;
    const accentColor = nodeData.accentColor;
    const backgroundColor = nodeData.backgroundColor;

    // Simulation state
    const failedNodeIds = useSimulationStore((s) => s.failedNodeIds);
    const activePathNodeIds = useSimulationStore((s) => s.activePathNodeIds);
    const affectedNodeIds = useSimulationStore((s) => s.affectedNodeIds);
    const sourceNodeId = useSimulationStore((s) => s.sourceNodeId);
    const protectedNodeIds = useSimulationStore((s) => s.chaosConfig.protectedNodeIds);
    const simulationMode = useSimulationStore((s) => s.mode);

    const isFailed = failedNodeIds.includes(id);
    const isOnActivePath = activePathNodeIds.includes(id);
    const isAffected = affectedNodeIds.includes(id);
    const isSource = sourceNodeId === id;
    const isProtected = protectedNodeIds.includes(id) && simulationMode === "chaos";

    // Animation state — hide node during shatter animation
    const isPendingDeletion = useAnimationStore((s) => s.isPendingDeletion(id));

    // Tag filtering — dim if any of this node's tags is hidden.
    const isTagHidden = useUIStore((s) => {
      if (!nodeData.tags || nodeData.tags.length === 0) {
        return false;
      }
      for (const t of nodeData.tags) {
        if (s.hiddenTags.has(t.toLowerCase())) {
          return true;
        }
      }
      return false;
    });

    return (
      <div
        data-node-id={id}
        style={isTagHidden ? { opacity: 0.12, transition: "opacity 200ms ease" } : undefined}
        className={cn(
          "relative flex flex-col items-center gap-2 p-3 min-w-30 rounded-xl bg-white/90 dark:bg-zinc-900/90 border backdrop-blur-sm cursor-grab active:cursor-grabbing transition-all hover:border-zinc-400 dark:hover:border-zinc-600",
          selected
            ? "node-selected z-20 border-zinc-500 dark:border-zinc-400"
            : "border-zinc-300 dark:border-zinc-800 z-10",
          // Simulation visual states
          isFailed && "border-red-500 dark:border-red-500 ring-2 ring-red-500/50",
          isSource && "border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/50",
          isOnActivePath &&
            !isSource &&
            "border-blue-400 dark:border-blue-400 ring-1 ring-blue-400/40",
          isAffected && "opacity-40 grayscale",
          isProtected && "border-cyan-400 dark:border-cyan-400 ring-2 ring-cyan-400/50",
          isPendingDeletion && "opacity-0 pointer-events-none",
        )}
        onMouseEnter={() => {
          if (hasDescription) {
            tooltipTimeout.current = setTimeout(() => setShowTooltip(true), 400);
          }
        }}
        onMouseLeave={() => {
          if (tooltipTimeout.current) {
            clearTimeout(tooltipTimeout.current);
          }
          setShowTooltip(false);
        }}
      >
        {/* Background tint overlay */}
        {backgroundColor && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundColor: `${backgroundColor}33`, zIndex: -1, borderRadius: "inherit" }}
          />
        )}
        {/* Description Tooltip */}
        {showTooltip && hasDescription && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none">
            <div className="relative bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 text-[11px] leading-relaxed px-3 py-2 rounded-lg shadow-lg max-w-55 w-max">
              {nodeData.description}
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-zinc-900 dark:border-t-zinc-100" />
            </div>
          </div>
        )}
        {/* Protected badge (chaos mode) */}
        {isProtected && (
          <div
            className="absolute -top-2 -left-2 z-20 w-5 h-5 rounded-full bg-cyan-500 border-2 border-white dark:border-zinc-950 flex items-center justify-center shadow-sm"
            title="Protected from chaos"
          >
            <span className="text-[8px] text-white font-bold">P</span>
          </div>
        )}

        {/* Input Port - Top */}
        <Handle
          type="target"
          position={Position.Top}
          title="Input"
          className="w-2! h-2! rounded-full! bg-zinc-300! dark:bg-zinc-700! border-2! border-white! dark:border-zinc-950! -top-1! hover:scale-150! transition-transform!"
        />

        {/* Icon */}
        <div
          className={cn(
            "p-2.5 rounded-lg cursor-pointer nodrag nopan",
            config.bgClass,
            config.borderClass,
            "border",
          )}
          style={
            accentColor
              ? { borderColor: accentColor, boxShadow: `0 0 0 1px ${accentColor}33 inset` }
              : undefined
          }
          onDoubleClick={(e) => {
            e.stopPropagation();
            setIsIconPickerOpen(true);
          }}
          title="Double-click to change icon"
        >
          {nodeData.iconifyIcon ? (
            <IconifyIcon
              icon={nodeData.iconifyIcon}
              className="w-5 h-5"
              style={{ color: nodeData.iconColor || accentColor }}
            />
          ) : (
            <Icon
              className={cn("w-5 h-5", config.iconColor)}
              style={accentColor ? { color: accentColor } : undefined}
              strokeWidth={1.5}
            />
          )}
        </div>

        {/* Label & Type */}
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-1.5">
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") {
                    const trimmed = editValue.trim();
                    if (trimmed) {
                      updateNodeData(id, { label: trimmed });
                    }
                    setIsEditing(false);
                  } else if (e.key === "Escape") {
                    setIsEditing(false);
                  }
                }}
                onBlur={() => setIsEditing(false)}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="nodrag nowheel nopan text-xs font-semibold text-zinc-900 dark:text-zinc-200 bg-transparent border-b border-zinc-400 dark:border-zinc-600 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 text-center w-full max-w-30 px-1"
              />
            ) : (
              <span
                className="text-xs font-semibold text-zinc-900 dark:text-zinc-200 cursor-text"
                onDoubleClick={() => {
                  setEditValue(nodeData.label);
                  setIsEditing(true);
                }}
              >
                {nodeData.label}
              </span>
            )}
            {statusColor && (
              <div
                className={cn(
                  "w-2 h-2 rounded-full border border-white dark:border-zinc-950 shadow-sm",
                  statusColor,
                )}
              />
            )}
          </div>
          <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-tight">
            {nodeData.type}
          </span>
        </div>

        {nodeData.decision && Object.values(nodeData.decision).some((value) => value?.trim()) && (
          <span
            title={nodeData.decision.reason || "Design reasoning documented"}
            className="rounded border border-zinc-300 dark:border-zinc-700 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground"
          >
            Why
          </span>
        )}

        {/* Important design constraints should be visible without opening properties. */}
        {nodeData.metadata && Object.keys(nodeData.metadata).length > 0 && (
          <div
            className="w-full max-w-48 border-t border-zinc-200 dark:border-zinc-700 pt-1.5 space-y-0.5"
            title={Object.entries(nodeData.metadata)
              .map(([key, value]) => `${key}: ${value}`)
              .join("\n")}
          >
            {Object.entries(nodeData.metadata)
              .slice(0, 3)
              .map(([key, value]) => (
                <div key={key} className="flex items-baseline justify-between gap-2 text-[9px]">
                  <span className="text-muted-foreground truncate">{key}</span>
                  <span className="text-zinc-700 dark:text-zinc-300 font-mono truncate">
                    {value}
                  </span>
                </div>
              ))}
            {Object.keys(nodeData.metadata).length > 3 && (
              <div className="text-[9px] text-muted-foreground">
                +{Object.keys(nodeData.metadata).length - 3} more
              </div>
            )}
          </div>
        )}

        {/* Output Port - Bottom */}
        <Handle
          type="source"
          position={Position.Bottom}
          title="Output"
          className="w-2! h-2! rounded-full! bg-zinc-200! dark:bg-zinc-500! border-2! border-white! dark:border-zinc-950! -bottom-1! hover:scale-150! transition-transform!"
        />

        {/* Left Handle - Input */}
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          title="Input"
          className="w-2! h-2! rounded-full! bg-zinc-300! dark:bg-zinc-700! border-2! border-white! dark:border-zinc-950! hover:scale-150! transition-transform!"
        />

        {/* Right Handle - Output */}
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          title="Output"
          className="w-2! h-2! rounded-full! bg-zinc-300! dark:bg-zinc-700! border-2! border-white! dark:border-zinc-950! hover:scale-150! transition-transform!"
        />

        {/* Health Check Indicator */}
        {hasHealthCheck && (
          <div className="absolute -top-1 -right-1 z-10">
            {healthResult?.loading ? (
              <div
                className={cn(
                  "w-4 h-4 rounded-full border-2 border-white dark:border-zinc-950 flex items-center justify-center shadow-sm",
                  HEALTH_STATUS_STYLES.loading.bg,
                )}
              >
                <LoadingIndicator className={cn("size-2.5", HEALTH_STATUS_STYLES.loading.icon)} />
              </div>
            ) : healthResult ? (
              <div
                className={cn(
                  "w-4 h-4 rounded-full border-2 border-white dark:border-zinc-950 flex items-center justify-center shadow-sm",
                  HEALTH_STATUS_STYLES[healthResult.status].bg,
                )}
                title={`Health: ${healthResult.status} (${healthResult.latency}ms)`}
              >
                <HeartIcon
                  className={cn("w-2.5 h-2.5", HEALTH_STATUS_STYLES[healthResult.status].icon)}
                  strokeWidth={2}
                />
              </div>
            ) : (
              <div
                className="w-4 h-4 rounded-full border-2 border-white dark:border-zinc-950 bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shadow-sm"
                title="Health check configured"
              >
                <HeartIcon
                  className="w-2.5 h-2.5 text-zinc-500 dark:text-zinc-400"
                  strokeWidth={2}
                />
              </div>
            )}
          </div>
        )}

        {/* Icon Picker Dialog (via Portal) */}
        {isIconPickerOpen &&
          createPortal(
            <IconPickerDialog
              isOpen={isIconPickerOpen}
              onClose={() => setIsIconPickerOpen(false)}
              onSelect={(iconId) => {
                updateNodeData(id, { iconifyIcon: iconId });
                setIsIconPickerOpen(false);
              }}
              {...(nodeData.iconifyIcon ? { currentIcon: nodeData.iconifyIcon } : {})}
            />,
            document.body,
          )}
      </div>
    );
  },
);

ArchitectureNode.displayName = "ArchitectureNode";
