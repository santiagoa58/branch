import { memo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Icon as IconifyIcon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { NODE_TYPES_CONFIG } from "@/constants";
import type { ArchitectureNode as ArchitectureFlowNode } from "@/types";
import { useDiagramStore } from "@/store/diagramStore";
import { useSimulationStore } from "@/store/simulationStore";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useAnimationStore } from "@/store/animationStore";
import { getNodeAttributes, formatArchitectureAttribute } from "@/utils/architectureAttributes";
import { getDocumentedDecision, hasDesignDecision } from "@/utils/designDecision";
import { IconPickerDialog } from "@/components/ui/IconPickerDialog";

export const ArchitectureNode = memo(
  // oxlint-disable-next-line complexity, max-lines-per-function -- debt: complexity 29, 239 lines; extract branches and split into smaller units
  ({ data: nodeData, selected, id }: NodeProps<ArchitectureFlowNode>) => {
    const config = NODE_TYPES_CONFIG[nodeData.type];
    const Icon = config.icon;

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
    const hasDescription = Boolean(nodeData.description?.trim());

    // Auto-focus and select text when entering edit mode
    useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, [isEditing]);

    const attributes = getNodeAttributes(nodeData);
    const decision = hasDesignDecision(nodeData.decision)
      ? getDocumentedDecision(nodeData.decision)
      : undefined;

    // Simulation state
    const failedNodeIds = useSimulationStore((s) => s.failedNodeIds);
    const activePathNodeIds = useSimulationStore((s) => s.activePathNodeIds);
    const affectedNodeIds = useSimulationStore((s) => s.affectedNodeIds);
    const sourceNodeId = useSimulationStore((s) => s.sourceNodeId);
    const protectedNodeIds = useSimulationStore((s) => s.chaosConfig.protectedNodeIds);
    const simulationMode = useSimulationStore((s) => s.mode);
    // Messages wait at the component holding them: the producer, or the queue in front of a consumer.
    const waitingCount = useSimulationStore(
      (s) => s.waitingMessages.filter((message) => message.from === id).length,
    );

    const isFailed = failedNodeIds.includes(id);
    const isOnActivePath = activePathNodeIds.includes(id);
    const isAffected = affectedNodeIds.includes(id);
    const isSource = sourceNodeId === id;
    const isProtected = protectedNodeIds.includes(id) && simulationMode === "chaos";

    // A transient mark from the AI design panel: an update's changes, or an endpoint's components.
    const isHighlighted = useAiDesignStore((s) => s.highlight.has(id));

    // Animation state — hide node during shatter animation
    const isPendingDeletion = useAnimationStore((s) => s.isPendingDeletion(id));

    return (
      <div
        data-node-id={id}
        data-highlighted={isHighlighted || undefined}
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
          isHighlighted &&
            "ring-2 ring-primary ring-offset-2 ring-offset-background motion-safe:animate-pulse",
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
        {simulationMode === "traffic" && isFailed && (
          <span className="absolute -top-2 left-2 rounded bg-red-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            Down
          </span>
        )}
        {simulationMode === "traffic" && waitingCount > 0 && (
          <span className="absolute -top-2 right-2 rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
            {waitingCount} waiting
          </span>
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

        {/* Default ports follow the left-to-right layout; top and bottom stay available. */}
        <Handle
          type="target"
          position={Position.Top}
          id="top"
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

          onDoubleClick={(e) => {
            e.stopPropagation();
            setIsIconPickerOpen(true);
          }}
          title="Double-click to change icon"
        >
          {nodeData.iconifyIcon ? (
            <IconifyIcon icon={nodeData.iconifyIcon} className={cn("w-5 h-5", config.iconColor)} />
          ) : (
            <Icon
              className={cn("w-5 h-5", config.iconColor)}

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
          </div>
          <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-tight">
            {nodeData.type}
          </span>
        </div>

        {/* The chosen approach is the at-a-glance answer to "why this component?". */}
        {decision && (
          <span
            title={[decision.choice, decision.reason].filter(Boolean).join("\n")}
            className="max-w-48 truncate rounded border border-zinc-300 dark:border-zinc-700 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground"
          >
            {decision.choice || "Decision"}
          </span>
        )}

        {/* Important design constraints should be visible without opening properties. */}
        {attributes.length > 0 && (
          <div
            className="w-full max-w-48 border-t border-border pt-2 space-y-1"
            title={attributes
              .map((attribute) => `${attribute.name}: ${formatArchitectureAttribute(attribute)}`)
              .join("\n")}
          >
            {attributes.slice(0, 3).map((attribute) => (
              <div
                key={attribute.name}
                className="flex items-baseline justify-between gap-2 text-xs"
              >
                <span className="truncate text-muted-foreground">{attribute.name}</span>
                <span className="truncate font-mono text-foreground">
                  {formatArchitectureAttribute(attribute)}
                </span>
              </div>
            ))}
            {attributes.length > 3 && (
              <div className="text-xs text-muted-foreground">+{attributes.length - 3} more</div>
            )}
          </div>
        )}

        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          title="Output"
          className="w-2! h-2! rounded-full! bg-zinc-200! dark:bg-zinc-500! border-2! border-white! dark:border-zinc-950! -bottom-1! hover:scale-150! transition-transform!"
        />

        <Handle
          type="target"
          position={Position.Left}
          title="Input"
          className="w-2! h-2! rounded-full! bg-zinc-300! dark:bg-zinc-700! border-2! border-white! dark:border-zinc-950! hover:scale-150! transition-transform!"
        />

        <Handle
          type="source"
          position={Position.Right}
          title="Output"
          className="w-2! h-2! rounded-full! bg-zinc-300! dark:bg-zinc-700! border-2! border-white! dark:border-zinc-950! hover:scale-150! transition-transform!"
        />

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
