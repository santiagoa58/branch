// oxlint-disable max-lines -- debt: 613 lines (limit 450); split the module
/**
 * SimulationPanel — A floating overlay control bar for simulation mode.
 * Positioned at the bottom-center of the canvas.
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useSimulationStore } from "@/store/simulationStore";
import { useDiagramStore } from "@/store/diagramStore";
import { traceFlowPath, computeBlastRadius } from "@/utils/graphTraversal";
import { flowPathToMermaidSequence } from "@/utils/sequenceDiagram";
import type { SimulationSpeed, NamedFlow } from "@/types/simulation";
import { simulationSpeedSchema } from "@/schemas/diagram";
import { chaosSubModeSchema } from "@/schemas/ui";
import { applyValidatedInput } from "@/lib/validatedInput";
import { SimulationStats } from "./SimulationStats";
import { ChaosEventLog } from "./ChaosEventLog";
import { SequenceDiagramDialog } from "@/components/ui/SequenceDiagramDialog";
import { SaveFlowDialog } from "@/components/ui/SaveFlowDialog";
import { TrafficLog } from "./TrafficLog";
import { Activity } from "lucide-react";
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  SignalIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  BoltIcon,
  ForwardIcon,
  BackwardIcon,
  ChartBarIcon,
  ArrowPathIcon,
  FireIcon,
  ListBulletIcon,
  Bars3BottomLeftIcon,
  BookmarkIcon,
} from "@heroicons/react/24/outline";

const SPEED_OPTIONS: SimulationSpeed[] = [0.25, 0.5, 1, 2, 4];

interface SimulationPanelProps {
  onClose: () => void;
}

// oxlint-disable-next-line complexity, max-lines-per-function -- debt: complexity 76, 576 lines; extract branches and split into smaller units
export function SimulationPanel({ onClose }: SimulationPanelProps) {
  const {
    mode,
    isRunning,
    speed,
    sourceNodeId,
    failedNodeIds,
    flowPath,
    currentStepIndex,
    steppingMode,
    showStats,
    setMode,
    startFlowSimulation,
    startFailureSimulation,
    stop,
    pause,
    resume,
    setSpeed,
    setFailureResults,
    setSteppingMode,
    stepForward,
    stepBackward,
    toggleStats,
    roundTripEnabled,
    toggleRoundTrip,
    // Chaos
    chaosConfig,
    chaosIsAutoRunning,
    chaosRound,
    showChaosLog,
    setChaosConfig,
    setChaosSubMode,
    startChaos,
    stopChaos,
    toggleChaosLog,
    clearChaosFailures,
    reset,
  } = useSimulationStore();

  const nodes = useDiagramStore((s) => s.nodes);
  const edges = useDiagramStore((s) => s.edges);
  const addFlow = useDiagramStore((s) => s.addFlow);

  // Sequence-diagram dialog (generated on demand from the traced flow path)
  const [sequenceSource, setSequenceSource] = useState<string | null>(null);
  // Save-as-flow dialog
  const [saveFlowOpen, setSaveFlowOpen] = useState(false);

  // Get source node label for display
  const sourceNode = sourceNodeId ? nodes.find((n) => n.id === sourceNodeId) : null;
  const sourceNodeLabel = sourceNode ? sourceNode.data["label"] : null;
  const sourceLabel =
    typeof sourceNodeLabel === "string" && sourceNodeLabel
      ? sourceNodeLabel
      : sourceNode
        ? "Unknown"
        : null;

  const handlePlayFlow = () => {
    if (sourceNodeId) {
      if (steppingMode) {
        // In stepping mode, start paused at step 0
        const path = traceFlowPath(nodes, edges, sourceNodeId);
        startFlowSimulation(sourceNodeId, path);
        pause(); // Immediately pause — user advances via step buttons
      } else {
        const path = traceFlowPath(nodes, edges, sourceNodeId);
        startFlowSimulation(sourceNodeId, path);
      }
    }
  };

  const handlePlayFailure = () => {
    if (failedNodeIds.length > 0) {
      const blast = computeBlastRadius(nodes, edges, failedNodeIds);
      setFailureResults(blast.affectedNodeIds, blast.brokenEdgeIds, blast.levels);
      startFailureSimulation();
    }
  };

  const handleToggleStepping = () => {
    if (steppingMode) {
      setSteppingMode(false);
      // If we were stepping and simulation is paused, resume continuous
      if (isRunning && flowPath) {
        resume();
      }
    } else {
      setSteppingMode(true);
      // If simulation is running, pause it for stepping
      if (isRunning) {
        pause();
      }
    }
  };

  const handleShowSequence = () => {
    if (!sourceNodeId) {
      return;
    }
    const path = traceFlowPath(nodes, edges, sourceNodeId);
    setSequenceSource(
      flowPathToMermaidSequence(nodes, edges, path, sourceLabel ? { title: sourceLabel } : {}),
    );
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // Status message
  // oxlint-disable-next-line complexity -- debt: complexity 22; extract branches
  const getStatusText = () => {
    if (mode === "idle") {
      return "Select a mode to begin";
    }
    if (mode === "traffic") {
      if (!isRunning) {
        return "Press Play to send requests from each entry point";
      }
      return failedNodeIds.length === 0
        ? "Click a component to take it down"
        : `${failedNodeIds.length} down — click a component again to bring it back`;
    }
    if (mode === "flow") {
      if (!sourceNodeId) {
        return "Click a node to set as source";
      }
      if (steppingMode && flowPath) {
        const maxSteps = flowPath.levels?.length ?? flowPath.steps.length;
        const stepLabel =
          currentStepIndex >= 0 && currentStepIndex < maxSteps
            ? (() => {
                if (flowPath.levels) {
                  const level = flowPath.levels[currentStepIndex];
                  if (!level) {
                    return "Ready to step";
                  }
                  const stepCount = level.steps.length;
                  return `Level ${currentStepIndex + 1}/${maxSteps}: ${stepCount} branch${stepCount > 1 ? "es" : ""}`;
                }
                const step = flowPath.steps[currentStepIndex];
                if (!step) {
                  return "Ready to step";
                }
                const fromNode = nodes.find((n) => n.id === step.fromNodeId);
                const toNode = nodes.find((n) => n.id === step.toNodeId);
                const fromLabel = (fromNode?.data?.["label"] as string) || step.fromNodeId;
                const toLabel = (toNode?.data?.["label"] as string) || step.toNodeId;
                const proto = step.protocol ? ` [${step.protocol.toUpperCase()}]` : "";
                return `Step ${currentStepIndex + 1}/${maxSteps}: ${fromLabel} →${proto} ${toLabel}`;
              })()
            : `Ready to step — ${maxSteps} ${flowPath.levels ? "levels" : "hops"}`;
        return stepLabel;
      }
      if (isRunning) {
        return `Tracing from: ${sourceLabel}`;
      }
      return `Source: ${sourceLabel} — Press Play`;
    }
    if (mode === "failure") {
      if (failedNodeIds.length === 0) {
        return "Click components to mark them as failed";
      }
      if (isRunning) {
        return `Showing what depends on ${failedNodeIds.length} failed component(s)`;
      }
      return `${failedNodeIds.length} component(s) marked — Press Play`;
    }
    if (mode === "chaos") {
      if (chaosIsAutoRunning) {
        const subLabel =
          chaosConfig.subMode === "random-failure" ? "Random Failure" : "Network Partition";
        return `${subLabel} — Round ${chaosRound} (every ${chaosConfig.intervalMs / 1000}s)`;
      }
      return `Chaos: ${chaosConfig.subMode === "random-failure" ? "Random Failure" : "Network Partition"} — Press Play`;
    }
    return "";
  };

  return (
    <div className="absolute bottom-6 inset-x-0 z-50 flex flex-col items-center px-2">
      {mode === "traffic" && <TrafficLog />}

      {/* Chaos event log (rendered above everything) */}
      {mode === "chaos" && showChaosLog && <ChaosEventLog />}

      {/* Stats panel (rendered above the control bar) */}
      {showStats && isRunning && <SimulationStats />}

      <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-lg border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl shadow-black/20 dark:shadow-black/60 px-4 py-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 max-w-full">
        {/* Simulation indicator — the toolbar already says Simulate on phones */}
        <div className="hidden sm:flex items-center gap-1.5">
          <BoltIcon
            className={cn("w-4 h-4", isRunning ? "text-amber-500 animate-pulse" : "text-zinc-400")}
          />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Simulate
          </span>
        </div>

        <div className="hidden sm:block w-px h-6 bg-zinc-200 dark:bg-zinc-800" />

        {/* Mode selector: equal 2×2 grid on phones so no label wraps or stretches a button */}
        <div className="grid w-full grid-cols-2 gap-1 sm:flex sm:w-auto">
          <button
            type="button"
            onClick={() => setMode("traffic")}
            className={cn(
              "flex items-center justify-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg border border-transparent text-xs font-medium transition-colors",
              mode === "traffic"
                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
            )}
            title="Traffic — live requests; take components down and bring them back"
          >
            <Activity className="w-3.5 h-3.5" aria-hidden="true" />
            Traffic
          </button>
          <button
            type="button"
            onClick={() => setMode("flow")}
            className={cn(
              "flex items-center justify-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg border border-transparent text-xs font-medium transition-colors",
              mode === "flow"
                ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
            )}
            title="Trace — follow one request's path from a component"
          >
            <SignalIcon className="w-3.5 h-3.5" />
            Trace
          </button>
          <button
            type="button"
            onClick={() => setMode("failure")}
            className={cn(
              "flex items-center justify-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg border border-transparent text-xs font-medium transition-colors",
              mode === "failure"
                ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
            )}
            title="Blast radius — what depends on the components you mark as failed"
          >
            <ExclamationTriangleIcon className="w-3.5 h-3.5" />
            Blast radius
          </button>
          <button
            type="button"
            onClick={() => setMode("chaos")}
            className={cn(
              "flex items-center justify-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg border border-transparent text-xs font-medium transition-colors",
              mode === "chaos"
                ? "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
            )}
            title="Chaos Mode — Random failures & network partition"
          >
            <FireIcon className="w-3.5 h-3.5" />
            Chaos
          </button>
        </div>

        <div className="hidden sm:block w-px h-6 bg-zinc-200 dark:bg-zinc-800" />

        {/* Playback controls */}
        <div className="flex items-center gap-1">
          {mode === "chaos" ? (
            // Chaos mode: toggle auto-run
            chaosIsAutoRunning ? (
              <button
                type="button"
                onClick={stopChaos}
                className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                title="Stop Chaos"
              >
                <PauseIcon className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  clearChaosFailures();
                  startChaos();
                }}
                className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                title="Start Chaos"
              >
                <PlayIcon className="w-4 h-4" />
              </button>
            )
          ) : !isRunning || (steppingMode && flowPath) ? (
            <button
              type="button"
              onClick={
                mode === "traffic" ? resume : mode === "flow" ? handlePlayFlow : handlePlayFailure
              }
              disabled={
                mode === "idle" ||
                (mode === "flow" && !sourceNodeId) ||
                (mode === "failure" && failedNodeIds.length === 0) ||
                (steppingMode && isRunning)
              }
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                mode === "idle" ||
                  (mode === "flow" && !sourceNodeId) ||
                  (mode === "failure" && failedNodeIds.length === 0) ||
                  (steppingMode && isRunning)
                  ? "text-zinc-300 dark:text-zinc-700 cursor-not-allowed"
                  : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
              )}
              title="Play"
            >
              <PlayIcon className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={pause}
              className="p-1.5 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
              title="Pause"
            >
              <PauseIcon className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (mode === "chaos") {
                stopChaos();
                clearChaosFailures();
              } else if (mode === "traffic") {
                // Clears requests, down components and the log for a fresh run.
                setMode("traffic");
              } else {
                stop();
              }
            }}
            disabled={
              mode !== "chaos" &&
              mode !== "traffic" &&
              !isRunning &&
              !sourceNodeId &&
              failedNodeIds.length === 0
            }
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              mode !== "traffic" && !isRunning && !sourceNodeId && failedNodeIds.length === 0
                ? "text-zinc-300 dark:text-zinc-700 cursor-not-allowed"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800",
            )}
            title={mode === "traffic" ? "Stop and reset" : "Stop"}
          >
            <StopIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Step controls (flow mode only) */}
        {mode === "flow" && (
          <>
            <div className="hidden sm:block w-px h-6 bg-zinc-200 dark:bg-zinc-800" />
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleToggleStepping}
                className={cn(
                  "whitespace-nowrap px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors",
                  steppingMode
                    ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700"
                    : "text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800",
                )}
                title="Toggle step-by-step debugger"
              >
                Step
              </button>
              {steppingMode && (
                <>
                  <button
                    type="button"
                    onClick={stepBackward}
                    disabled={currentStepIndex <= 0}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      currentStepIndex <= 0
                        ? "text-zinc-300 dark:text-zinc-700 cursor-not-allowed"
                        : "text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30",
                    )}
                    title="Step backward"
                  >
                    <BackwardIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={stepForward}
                    disabled={
                      !flowPath ||
                      currentStepIndex >= (flowPath.levels?.length ?? flowPath.steps.length) - 1
                    }
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      !flowPath ||
                        currentStepIndex >= (flowPath.levels?.length ?? flowPath.steps.length) - 1
                        ? "text-zinc-300 dark:text-zinc-700 cursor-not-allowed"
                        : "text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30",
                    )}
                    title="Step forward"
                  >
                    <ForwardIcon className="w-3.5 h-3.5" />
                  </button>
                  {flowPath && currentStepIndex >= 0 && (
                    <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 tabular-nums">
                      {currentStepIndex + 1}/{flowPath.levels?.length ?? flowPath.steps.length}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Round-trip toggle */}
            {!steppingMode && (
              <button
                type="button"
                onClick={toggleRoundTrip}
                className={cn(
                  "whitespace-nowrap px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1",
                  roundTripEnabled
                    ? "bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700"
                    : "text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800",
                )}
                title="Toggle request-response round trip"
              >
                <ArrowPathIcon className="w-3 h-3" />
                Round trip
              </button>
            )}

            {/* Sequence-diagram export from the traced flow */}
            <button
              type="button"
              onClick={handleShowSequence}
              disabled={!sourceNodeId}
              className={cn(
                "whitespace-nowrap px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1",
                sourceNodeId
                  ? "text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/30"
                  : "text-zinc-300 dark:text-zinc-700 cursor-not-allowed",
              )}
              title="Generate a Mermaid sequence diagram from the traced flow"
            >
              <Bars3BottomLeftIcon className="w-3 h-3" />
              Sequence
            </button>

            {/* Save current source as a named flow */}
            <button
              type="button"
              onClick={() => setSaveFlowOpen(true)}
              disabled={!sourceNodeId}
              className={cn(
                "whitespace-nowrap px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1",
                sourceNodeId
                  ? "text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
                  : "text-zinc-300 dark:text-zinc-700 cursor-not-allowed",
              )}
              title="Save the current source as a replayable named flow"
            >
              <BookmarkIcon className="w-3 h-3" />
              Save flow
            </button>
          </>
        )}

        {/* Chaos controls */}
        {mode === "chaos" && (
          <>
            <div className="hidden sm:block w-px h-6 bg-zinc-200 dark:bg-zinc-800" />
            <div className="flex items-center gap-1.5">
              {/* Sub-mode selector */}
              <select
                value={chaosConfig.subMode}
                onChange={(e) =>
                  applyValidatedInput(chaosSubModeSchema, e.target.value, setChaosSubMode)
                }
                disabled={chaosIsAutoRunning}
                className="text-[10px] bg-transparent border border-zinc-200 dark:border-zinc-700 rounded-md px-1.5 py-1 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
              >
                <option value="random-failure">Random Failure</option>
                <option value="network-partition">Partition</option>
              </select>

              {/* Interval */}
              <select
                value={chaosConfig.intervalMs}
                onChange={(e) => setChaosConfig({ intervalMs: Number(e.target.value) })}
                disabled={chaosIsAutoRunning}
                className="text-[10px] bg-transparent border border-zinc-200 dark:border-zinc-700 rounded-md px-1.5 py-1 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
                title="Interval between chaos rounds"
              >
                <option value={2000}>2s</option>
                <option value={3000}>3s</option>
                <option value={5000}>5s</option>
                <option value={8000}>8s</option>
                <option value={10000}>10s</option>
              </select>

              {/* Max failures per round (random-failure only) */}
              {chaosConfig.subMode === "random-failure" && (
                <select
                  value={chaosConfig.maxFailuresPerRound}
                  onChange={(e) => setChaosConfig({ maxFailuresPerRound: Number(e.target.value) })}
                  disabled={chaosIsAutoRunning}
                  className="text-[10px] bg-transparent border border-zinc-200 dark:border-zinc-700 rounded-md px-1.5 py-1 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  title="Max nodes to fail per round"
                >
                  <option value={1}>1/round</option>
                  <option value={2}>2/round</option>
                  <option value={3}>3/round</option>
                  <option value={5}>5/round</option>
                </select>
              )}

              {/* Event log toggle */}
              <button
                type="button"
                onClick={toggleChaosLog}
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  showChaosLog
                    ? "bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400"
                    : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                )}
                title="Toggle chaos event log"
              >
                <ListBulletIcon className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        <div className="hidden sm:block w-px h-6 bg-zinc-200 dark:bg-zinc-800" />

        {/* Speed selector */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground font-medium">Speed:</span>
          <select
            value={speed}
            onChange={(e) =>
              applyValidatedInput(simulationSpeedSchema, Number(e.target.value), setSpeed)
            }
            className="text-xs bg-transparent border border-zinc-200 dark:border-zinc-700 rounded-md px-1.5 py-1 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {SPEED_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </div>

        <div className="hidden sm:block w-px h-6 bg-zinc-200 dark:bg-zinc-800" />

        {/* Status text */}
        <span className="text-xs text-zinc-500 dark:text-zinc-400 flex-1 truncate min-w-40 text-center">
          {getStatusText()}
        </span>

        {/* Stats toggle */}
        {(mode === "flow" || mode === "failure" || mode === "chaos") && isRunning && (
          <button
            type="button"
            onClick={toggleStats}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              showStats
                ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400"
                : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800",
            )}
            title="Toggle stats panel"
          >
            <ChartBarIcon className="w-4 h-4" />
          </button>
        )}

        {/* Close */}
        <button
          type="button"
          onClick={handleClose}
          className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title="Close simulation"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      <SequenceDiagramDialog
        isOpen={sequenceSource !== null}
        source={sequenceSource ?? ""}
        {...(sourceLabel ? { title: sourceLabel } : {})}
        onClose={() => setSequenceSource(null)}
      />

      {saveFlowOpen && (
        <SaveFlowDialog
          isOpen
          onClose={() => setSaveFlowOpen(false)}
          {...(sourceLabel ? { sourceNodeLabel: sourceLabel } : {})}
          onSubmit={(data: Pick<NamedFlow, "name" | "description" | "color" | "speed">) => {
            if (!sourceNodeId) {
              return;
            }
            addFlow({ ...data, sourceNodeId });
            setSaveFlowOpen(false);
          }}
        />
      )}
    </div>
  );
}
