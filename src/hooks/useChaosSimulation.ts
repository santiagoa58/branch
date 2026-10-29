/**
 * useChaosSimulation — Interval-based chaos engineering simulation hook.
 * Runs random failure rounds or network partition at configurable intervals.
 * Reuses computeBlastRadius for cascade computation and the existing failure
 * cascade animation in useSimulationAnimation.
 */
import { useEffect, useRef, useCallback } from "react";
import { useSimulationStore } from "@/store/simulationStore";
import { useDiagramStore } from "@/store/diagramStore";
import { selectRandomTargets, computeBlastRadius, computePartition } from "@/utils/graphTraversal";
import type { ChaosEvent } from "@/types/simulation";

export function useChaosSimulation() {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roundRef = useRef(0);

  // Store selectors
  const mode = useSimulationStore((s) => s.mode);
  const chaosIsAutoRunning = useSimulationStore((s) => s.chaosIsAutoRunning);
  const chaosConfig = useSimulationStore((s) => s.chaosConfig);

  // Actions
  const executeChaosRound = useSimulationStore((s) => s.executeChaosRound);
  const executePartition = useSimulationStore((s) => s.executePartition);
  const addChaosEvent = useSimulationStore((s) => s.addChaosEvent);
  const clearChaosFailures = useSimulationStore((s) => s.clearChaosFailures);
  const setStats = useSimulationStore((s) => s.setStats);

  // Diagram data
  const nodes = useDiagramStore((s) => s.nodes);
  const edges = useDiagramStore((s) => s.edges);

  /** Execute a single random-failure round */
  const executeRandomFailureRound = useCallback(() => {
    const currentFailedIds = useSimulationStore.getState().failedNodeIds;

    // Select random targets
    const newFailedIds = selectRandomTargets(
      nodes,
      chaosConfig.failureProbability,
      chaosConfig.maxFailuresPerRound,
      chaosConfig.protectedNodeIds,
      currentFailedIds,
    );

    if (newFailedIds.length === 0) {
      return;
    }

    // Compute blast radius for ALL failed nodes (existing + new)
    const allFailed = [...currentFailedIds, ...newFailedIds];
    const blast = computeBlastRadius(nodes, edges, allFailed);

    roundRef.current += 1;
    const round = roundRef.current;

    // Get node labels for the event message
    const failedLabels = newFailedIds.map((id) => {
      const node = nodes.find((n) => n.id === id);
      const label = (node?.data as Record<string, unknown> | undefined)?.["label"];
      return typeof label === "string" && label ? label : id;
    });

    const event: ChaosEvent = {
      round,
      timestamp: Date.now(),
      type: "node-failure",
      message: `Round ${round}: ${failedLabels.join(", ")} failed`,
      nodeIds: newFailedIds,
      affectedCount: blast.affectedNodeIds.length,
    };

    // Update store — this triggers the existing failure cascade animation
    executeChaosRound(newFailedIds, blast.affectedNodeIds, blast.brokenEdgeIds, blast.levels);
    addChaosEvent(event);

    // If there are affected nodes, also log a cascade event
    if (blast.affectedNodeIds.length > 0) {
      const cascadeEvent: ChaosEvent = {
        round,
        timestamp: Date.now(),
        type: "cascade",
        message: `Cascade: ${blast.affectedNodeIds.length} node(s) affected downstream`,
        nodeIds: blast.affectedNodeIds,
        affectedCount: blast.affectedNodeIds.length,
      };
      addChaosEvent(cascadeEvent);
    }

    // Update stats
    const archNodeCount = nodes.filter((n) => n.type === "architecture").length;
    const totalFailedNow = allFailed.length;
    setStats({
      totalHops: 0,
      protocolsUsed: [],
      pathLength: 0,
      totalLatencyMs: 0,
      bottleneckEdgeId: null,
      branchCount: 0,
      roundTripLatencyMs: null,
      failedCount: totalFailedNow,
      affectedCount: blast.affectedNodeIds.length,
      impactPercentage:
        archNodeCount > 0
          ? Math.round(((totalFailedNow + blast.affectedNodeIds.length) / archNodeCount) * 100)
          : 0,
      brokenEdgeCount: blast.brokenEdgeIds.length,
      chaosRounds: round,
      chaosTotalFailures: totalFailedNow,
      chaosMTBF: round > 1 ? Math.round(chaosConfig.intervalMs) : null,
      chaosSeveredEdges: 0,
    });
  }, [nodes, edges, chaosConfig, executeChaosRound, addChaosEvent, setStats]);

  /** Execute a network partition */
  const executePartitionRound = useCallback(() => {
    const partition = computePartition(nodes, edges, chaosConfig.protectedNodeIds);

    if (partition.severedEdgeIds.length === 0) {
      return;
    }

    roundRef.current += 1;
    const round = roundRef.current;

    const event: ChaosEvent = {
      round,
      timestamp: Date.now(),
      type: "partition",
      message: `Partition: network split into groups of ${partition.groupA.length} and ${partition.groupB.length} nodes`,
      nodeIds: [...partition.groupA, ...partition.groupB],
      edgeIds: partition.severedEdgeIds,
      affectedCount: partition.groupB.length,
    };

    executePartition(partition.severedEdgeIds, event);

    // Update stats
    const archNodeCount = nodes.filter((n) => n.type === "architecture").length;
    setStats({
      totalHops: 0,
      protocolsUsed: [],
      pathLength: 0,
      totalLatencyMs: 0,
      bottleneckEdgeId: null,
      branchCount: 0,
      roundTripLatencyMs: null,
      failedCount: 0,
      affectedCount: partition.groupB.length,
      impactPercentage:
        archNodeCount > 0 ? Math.round((partition.groupB.length / archNodeCount) * 100) : 0,
      brokenEdgeCount: partition.severedEdgeIds.length,
      chaosRounds: round,
      chaosTotalFailures: 0,
      chaosMTBF: null,
      chaosSeveredEdges: partition.severedEdgeIds.length,
    });
  }, [nodes, edges, chaosConfig.protectedNodeIds, executePartition, setStats]);

  // Main interval loop
  useEffect(() => {
    if (mode !== "chaos" || !chaosIsAutoRunning) {
      // Clear timer when not in chaos auto-run
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Reset round counter on new auto-run session
    roundRef.current = useSimulationStore.getState().chaosRound;

    // Execute first round immediately
    if (chaosConfig.subMode === "random-failure") {
      executeRandomFailureRound();
    } else {
      executePartitionRound();
    }

    // Set up interval for subsequent rounds
    timerRef.current = setInterval(() => {
      const state = useSimulationStore.getState();
      if (!state.chaosIsAutoRunning || state.mode !== "chaos") {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        return;
      }

      if (chaosConfig.subMode === "random-failure") {
        // Before each round, clear previous failures for a fresh round
        // (so cascades re-animate from new failures)
        clearChaosFailures();
        // Small delay to allow GSAP cleanup before new round
        setTimeout(() => {
          executeRandomFailureRound();
        }, 100);
      } else {
        clearChaosFailures();
        setTimeout(() => {
          executePartitionRound();
        }, 100);
      }
    }, chaosConfig.intervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    mode,
    chaosIsAutoRunning,
    chaosConfig.intervalMs,
    chaosConfig.subMode,
    executeRandomFailureRound,
    executePartitionRound,
    clearChaosFailures,
  ]);

  // Cleanup on mode change away from chaos
  useEffect(() => {
    if (mode !== "chaos") {
      roundRef.current = 0;
    }
  }, [mode]);
}
