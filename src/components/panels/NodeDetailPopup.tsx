import { useEffect, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Icon as IconifyIcon } from "@iconify/react";
import { DesignDecisionSummary } from "@/components/ui/DesignDecisionSummary";
import { NODE_TYPES_CONFIG } from "@/constants";
import { cn } from "@/lib/utils";
import { architectureNodeDataSchema } from "@/schemas/diagram";
import { useDiagramStore } from "@/store/diagramStore";
import { getNodeAttributes, formatArchitectureAttribute } from "@/utils/architectureAttributes";
import { hasBlockingEditorOverlay, isTextEditingEvent } from "@/utils/keyboardContext";

export function NodeDetailPopup() {
  const selectedNodeId = useDiagramStore((state) => state.selectedNodeId);
  const nodes = useDiagramStore((state) => state.nodes);
  const [dismissedNodeId, setDismissedNodeId] = useState<string | null>(null);
  const dismissed = dismissedNodeId === selectedNodeId;

  useEffect(() => {
    if (!selectedNodeId || dismissed) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !isTextEditingEvent(event) &&
        !hasBlockingEditorOverlay()
      ) {
        setDismissedNodeId(selectedNodeId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedNodeId, dismissed]);

  const node = nodes.find((entry) => entry.id === selectedNodeId);
  if (!node || node.type !== "architecture" || dismissed) {
    return null;
  }
  const data = architectureNodeDataSchema.parse(node.data);
  const config = NODE_TYPES_CONFIG[data.type];
  const NodeIcon = config.icon;
  const attributes = getNodeAttributes(data);

  return (
    <section
      aria-label="Selected component decision"
      className="absolute bottom-16 left-4 z-20 flex max-h-[60vh] w-96 max-w-[calc(100%-2rem)] flex-col rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
    >
      <div className="flex items-center gap-3 border-b border-border p-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg border",
            config.bgClass,
            config.borderClass,
          )}
        >
          {data.iconifyIcon ? (
            <IconifyIcon icon={data.iconifyIcon} className={cn("size-5", config.iconColor)} />
          ) : (
            <NodeIcon className={cn("size-5", config.iconColor)} strokeWidth={1.5} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="wrap-anywhere text-sm font-semibold">{data.label}</h2>
          <p className="text-xs text-muted-foreground">{config.label}</p>
        </div>
        <button
          type="button"
          aria-label="Dismiss component decision"
          title="Dismiss (Esc)"
          onClick={() => setDismissedNodeId(selectedNodeId)}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <XMarkIcon className="size-4" />
        </button>
      </div>
      <div className="space-y-4 overflow-y-auto p-3">
        {data.description && (
          <p className="text-sm text-muted-foreground text-pretty">{data.description}</p>
        )}
        <DesignDecisionSummary value={data.decision} compact />
        {attributes.length > 0 && (
          <section aria-label="Architecture attributes" className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground">Architecture attributes</h3>
            <dl className="space-y-2 text-xs">
              {attributes.map((attribute) => (
                <div key={attribute.name} className="flex items-baseline justify-between gap-3">
                  <dt className="wrap-anywhere text-muted-foreground">{attribute.name}</dt>
                  <dd className="wrap-anywhere text-right font-mono">
                    {formatArchitectureAttribute(attribute)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </section>
  );
}
