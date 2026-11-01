import { useState } from "react";
import type { Node } from "@xyflow/react";
import { Icon as IconifyIcon } from "@iconify/react";
import { TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { NODE_TYPES_CONFIG } from "@/constants";
import { cn } from "@/lib/utils";
import { applyValidatedInput } from "@/lib/validatedInput";
import {
  architectureNodeDataSchema,
  architectureNodeTypeSchema,
  groupNodeDataSchema,
} from "@/schemas/diagram";
import { getIconDisplayName } from "@/services/iconify";
import { useAnimationStore } from "@/store/animationStore";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useDiagramStore } from "@/store/diagramStore";
import { useDesignPipeline } from "@/hooks/useDesignPipeline";
import { getNodeAttributes } from "@/utils/architectureAttributes";
import { hasDesignDecision } from "@/utils/designDecision";
import { ArchitectureFactsEditor } from "@/components/ui/ArchitectureFactsEditor";
import { DesignDecisionEditor } from "@/components/ui/DesignDecisionEditor";
import { IconPickerDialog } from "@/components/ui/IconPickerDialog";
import { useRequireCondition } from "./useRequireCondition";
import { InspectorTabs, type InspectorTab } from "./InspectorTabs";

const fieldClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const buttonClass =
  "rounded-md border border-border bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground hover:bg-accent active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

interface Props {
  node: Node;
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
}

export function NodePropertiesPanel({ node, activeTab, onTabChange }: Props) {
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const { nodes, updateNodeData, setSelectedNode, addNodeToGroup, removeNodeFromGroup } =
    useDiagramStore();
  const requestDelete = useAnimationStore((state) => state.requestDelete);
  const hasBrief = useDiagramStore((state) => state.brief !== null);
  const running = useAiDesignStore((state) => state.running);
  const pipeline = useDesignPipeline();
  const requireProps = useRequireCondition();
  const data = architectureNodeDataSchema.parse(node.data);
  const config = NODE_TYPES_CONFIG[data.type];
  const Icon = config.icon;
  const hasDecision = hasDesignDecision(data.decision);

  return (
    <aside
      aria-label="Node details"
      className="z-20 flex w-80 flex-col border-l border-border bg-background xl:w-96"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn("rounded-lg border p-3", config.bgClass, config.borderClass)}>
            {data.iconifyIcon ? (
              <IconifyIcon icon={data.iconifyIcon} className={cn("size-5", config.iconColor)} />
            ) : (
              <Icon className={cn("size-5", config.iconColor)} />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="wrap-anywhere text-sm font-semibold text-foreground">{data.label}</h2>
            <p className="text-xs text-muted-foreground">{config.label}</p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close node details"
          onClick={() => setSelectedNode(null)}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <XMarkIcon className="size-4" />
        </button>
      </div>
      <InspectorTabs
        items={[
          { id: "design", label: "Decision", populated: hasDecision },
          { id: "basics", label: "Component" },
          { id: "advanced", label: "More" },
        ]}
        value={activeTab}
        onChange={onTabChange}
      />
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {activeTab === "design" && (
          <>
            <DesignDecisionEditor
              value={data.decision}
              onChange={(decision) => updateNodeData(node.id, { decision })}
              {...requireProps}
            />
            {hasBrief && (
              <button
                type="button"
                disabled={running}
                onClick={() => void pipeline.regenerateDecision(node.id)}
                className={cn(
                  buttonClass,
                  "w-full disabled:pointer-events-none disabled:opacity-50",
                )}
              >
                Regenerate reasoning
              </button>
            )}
            <ArchitectureFactsEditor
              key={node.id}
              attributes={getNodeAttributes(data)}
              onChange={(attributes) => updateNodeData(node.id, { attributes, metadata: {} })}
            />
          </>
        )}
        {activeTab === "basics" && (
          <div className="space-y-4">
            <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
              Component name
              <input
                className={fieldClass}
                value={data.label}
                onChange={(event) => updateNodeData(node.id, { label: event.target.value })}
                onKeyDown={(event) => event.stopPropagation()}
              />
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
              Component type
              <select
                className={fieldClass}
                value={data.type}
                onChange={(event) =>
                  applyValidatedInput(architectureNodeTypeSchema, event.target.value, (type) =>
                    updateNodeData(node.id, { type }),
                  )
                }
                onKeyDown={(event) => event.stopPropagation()}
              >
                {Object.entries(NODE_TYPES_CONFIG).map(([type, entry]) => (
                  <option key={type} value={type}>
                    {entry.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
              Responsibility
              <textarea
                className={fieldClass}
                value={data.description ?? ""}
                placeholder="What does this component own or do?"
                rows={3}
                onChange={(event) => updateNodeData(node.id, { description: event.target.value })}
                onKeyDown={(event) => event.stopPropagation()}
              />
            </label>
            <section aria-label="Component icon" className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground">Icon</h3>
              <p className="text-sm text-foreground">
                {data.iconifyIcon
                  ? getIconDisplayName(data.iconifyIcon)
                  : `Default ${config.label.toLowerCase()} icon`}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => setIconPickerOpen(true)}
                >
                  {data.iconifyIcon ? "Change icon" : "Choose icon"}
                </button>
                {data.iconifyIcon && (
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() => updateNodeData(node.id, { iconifyIcon: "", iconColor: "" })}
                  >
                    Use default icon
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Search by name, such as Postgres, AWS, or Docker.
              </p>
            </section>
          </div>
        )}
        {activeTab === "advanced" && (
          <div className="space-y-6">
            <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
              Parent group
              <select
                className={fieldClass}
                value={node.parentId ?? data.parentId ?? ""}
                onChange={(event) =>
                  event.target.value
                    ? addNodeToGroup(node.id, event.target.value)
                    : removeNodeFromGroup(node.id)
                }
                onKeyDown={(event) => event.stopPropagation()}
              >
                <option value="">No group</option>
                {nodes
                  .filter((entry) => entry.type === "group")
                  .map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {groupNodeDataSchema.parse(entry.data).label}
                    </option>
                  ))}
              </select>
            </label>
            <p className="text-xs text-muted-foreground">
              You can also drag this component into a group on the canvas.
            </p>
            <button
              type="button"
              className={cn(
                buttonClass,
                "flex w-full items-center justify-center gap-2 text-destructive",
              )}
              onClick={() => requestDelete(node.id)}
            >
              <TrashIcon className="size-4" /> Delete node
            </button>
          </div>
        )}
      </div>
      <IconPickerDialog
        key={node.id}
        isOpen={iconPickerOpen}
        onClose={() => setIconPickerOpen(false)}
        onSelect={(iconifyIcon) => updateNodeData(node.id, { iconifyIcon, iconColor: "" })}
        {...(data.iconifyIcon ? { currentIcon: data.iconifyIcon } : {})}
      />
    </aside>
  );
}
