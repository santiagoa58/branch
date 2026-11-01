import { useState } from "react";
import {
  XMarkIcon,
  PlayIcon,
  StopIcon,
  PencilSquareIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { useDiagramStore } from "@/store/diagramStore";
import { useSimulationStore } from "@/store/simulationStore";
import { SaveFlowDialog } from "@/components/ui/SaveFlowDialog";
import type { ArchitectureNodeData } from "@/types";
import type { NamedFlow } from "@/types/simulation";
import { cn } from "@/lib/utils";

interface FlowsPanelProps {
  onClose: () => void;
}

// oxlint-disable-next-line max-lines-per-function -- debt: 216 lines; split into smaller units
export function FlowsPanel({ onClose }: FlowsPanelProps) {
  const flows = useDiagramStore((s) => s.flows);
  const nodes = useDiagramStore((s) => s.nodes);
  const addFlow = useDiagramStore((s) => s.addFlow);
  const updateFlow = useDiagramStore((s) => s.updateFlow);
  const deleteFlow = useDiagramStore((s) => s.deleteFlow);
  const playFlow = useDiagramStore((s) => s.playFlow);
  const setSelectedNode = useDiagramStore((s) => s.setSelectedNode);

  const simMode = useSimulationStore((s) => s.mode);
  const sourceNodeId = useSimulationStore((s) => s.sourceNodeId);
  const simIsRunning = useSimulationStore((s) => s.isRunning);
  const stopSim = useSimulationStore((s) => s.stop);
  const setSimMode = useSimulationStore((s) => s.setMode);

  const handleClose = () => {
    // Stop any active flow simulation so the diagram doesn't stay highlighted
    if (simMode !== "idle") {
      stopSim();
      setSimMode("idle");
    }
    onClose();
  };

  // 'new' = create with the current sim source; or { id } for edit.
  const [dialog, setDialog] = useState<{ kind: "new" } | { kind: "edit"; id: string } | null>(null);

  const labelFor = (nodeId: string): string | null => {
    const n = nodes.find((x) => x.id === nodeId);
    if (!n) {
      return null;
    }
    return (n.data as ArchitectureNodeData).label || n.id;
  };

  const handleCreate = () => {
    if (!sourceNodeId) {
      return;
    }
    setDialog({ kind: "new" });
  };

  const handleSubmit = (data: Pick<NamedFlow, "name" | "description" | "color" | "speed">) => {
    if (dialog?.kind === "new") {
      if (!sourceNodeId) {
        return;
      }
      addFlow({ ...data, sourceNodeId });
    } else if (dialog?.kind === "edit") {
      updateFlow(dialog.id, data);
    }
    setDialog(null);
  };

  const editingFlow = dialog?.kind === "edit" ? flows.find((f) => f.id === dialog.id) : undefined;
  const sourceLabelForNew = sourceNodeId ? labelFor(sourceNodeId) : null;
  const sourceLabelForEdit = editingFlow ? labelFor(editingFlow.sourceNodeId) : null;
  const dialogSourceLabel = dialog?.kind === "edit" ? sourceLabelForEdit : sourceLabelForNew;

  return (
    <>
      <aside className="w-72 bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 flex flex-col z-20">
        <div className="h-14 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-5 justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Flows</span>
            <span className="text-[10px] font-mono text-muted-foreground">{flows.length}</span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 transition-colors"
            title="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {flows.length === 0 && (
            <div className="text-center mt-12 opacity-60 px-4">
              <PlayIcon className="w-6 h-6 mx-auto mb-3 text-zinc-400 dark:text-zinc-600" />
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Save a replayable flow scenario. Pick a source node in flow simulation, then click
                "+ Save current".
              </p>
            </div>
          )}

          {flows.map((flow) => {
            const sourceMissing = !nodes.some((n) => n.id === flow.sourceNodeId);
            const sourceLabel = labelFor(flow.sourceNodeId);
            const isPlaying =
              simMode === "flow" && simIsRunning && sourceNodeId === flow.sourceNodeId;
            const accent = flow.color || "#3b82f6";

            return (
              <div
                key={flow.id}
                className={cn(
                  "rounded-lg border p-2.5 transition-colors",
                  "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800",
                  "hover:border-zinc-300 dark:hover:border-zinc-700",
                )}
              >
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1 w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: accent }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {flow.name}
                      </span>
                      {sourceMissing && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[9px] font-mono uppercase tracking-wider text-red-500 dark:text-red-400"
                          title="Source node was deleted"
                        >
                          <ExclamationTriangleIcon className="w-3 h-3" />
                          broken
                        </span>
                      )}
                    </div>
                    {flow.description && (
                      <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                        {flow.description}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => !sourceMissing && setSelectedNode(flow.sourceNodeId)}
                      disabled={sourceMissing}
                      className={cn(
                        "mt-1 text-[10px] font-mono text-muted-foreground truncate hover:underline disabled:no-underline disabled:cursor-not-allowed",
                        sourceMissing && "line-through",
                      )}
                      title={sourceMissing ? "Source node deleted" : "Select source node"}
                    >
                      {sourceLabel || flow.sourceNodeId}
                      {flow.speed && ` · ${flow.speed}×`}
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-1">
                  {isPlaying ? (
                    <button
                      type="button"
                      onClick={() => stopSim()}
                      className="flex-1 flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider py-1 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                    >
                      <StopIcon className="w-3 h-3" />
                      Stop
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => playFlow(flow.id)}
                      disabled={sourceMissing}
                      className="flex-1 flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider py-1 rounded text-white transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{ backgroundColor: accent }}
                    >
                      <PlayIcon className="w-3 h-3" />
                      Play
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDialog({ kind: "edit", id: flow.id })}
                    className="p-1.5 rounded text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                    title="Edit flow"
                  >
                    <PencilSquareIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // oxlint-disable-next-line no-alert -- native confirm() guards this destructive delete until an in-app dialog replaces it
                      if (confirm(`Delete flow "${flow.name}"?`)) {
                        deleteFlow(flow.id);
                      }
                    }}
                    className="p-1.5 rounded text-zinc-500 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    title="Delete flow"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer: save current */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-3">
          <button
            type="button"
            onClick={handleCreate}
            disabled={!sourceNodeId}
            className={cn(
              "w-full flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-lg transition-colors",
              sourceNodeId
                ? "bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300"
                : "bg-zinc-100 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-600 cursor-not-allowed",
            )}
            title={
              sourceNodeId ? "Save current flow" : "Pick a source node in flow simulation first"
            }
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Save current
          </button>
          {!sourceNodeId && (
            <p className="mt-1.5 text-[10px] text-muted-foreground leading-snug text-center">
              Enable flow mode and click a node to set a source.
            </p>
          )}
        </div>
      </aside>

      {dialog !== null && (
        <SaveFlowDialog
          isOpen
          onClose={() => setDialog(null)}
          onSubmit={handleSubmit}
          {...(editingFlow ? { existing: editingFlow } : {})}
          {...(dialogSourceLabel ? { sourceNodeLabel: dialogSourceLabel } : {})}
        />
      )}
    </>
  );
}
