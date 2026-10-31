/**
 * Simulation store — manages the simulation mode state.
 * This state is ephemeral: NOT persisted to localStorage, NOT included in undo/redo.
 */
import { create } from "zustand";
import type {
  SimulationMode,
  SimulationSpeed,
  FlowPath,
  CascadeLevel,
  SimulationStats,
  ChaosConfig,
  ChaosEvent,
  ChaosSubMode,
  TrafficCounts,
  TrafficLogEntry,
} from "@/types/simulation";
import type { WaitingMessage } from "@/utils/trafficSimulation";

/** Recent traffic shown in the log; older entries only remain in the counts. */
export const TRAFFIC_LOG_LIMIT = 40;

interface SimulationState {
  // Mode & playback
  mode: SimulationMode;
  isRunning: boolean;
  speed: SimulationSpeed;

  // Flow simulation
  sourceNodeId: string | null;
  flowPath: FlowPath | null;
  activePathNodeIds: string[];
  activePathEdgeIds: string[];
  /** Index of the currently active step/level in the flow path */
  currentStepIndex: number;
  /** Whether stepping mode is active (step-by-step debugger) */
  steppingMode: boolean;

  // Round-trip
  /** Whether round-trip return animation is enabled */
  roundTripEnabled: boolean;
  /** Current phase of a round-trip animation */
  roundTripPhase: "request" | "response" | null;

  // Failure simulation
  failedNodeIds: string[];
  affectedNodeIds: string[];
  affectedEdgeIds: string[];
  /** Cascade levels for animated domino-effect failure propagation */
  cascadeLevels: CascadeLevel[];

  // Chaos mode
  chaosConfig: ChaosConfig;
  chaosRound: number;
  chaosEventLog: ChaosEvent[];
  chaosIsAutoRunning: boolean;
  /** Edge IDs severed by network partition */
  severedEdgeIds: string[];
  /** Show the chaos event log panel */
  showChaosLog: boolean;

  // Live traffic
  trafficLog: TrafficLogEntry[];
  trafficCounts: TrafficCounts;
  /** Hand-offs held until the component blocking them recovers. */
  waitingMessages: WaitingMessage[];

  // Stats panel
  showStats: boolean;
  stats: SimulationStats | null;

  // Actions
  setMode: (mode: SimulationMode) => void;
  startFlowSimulation: (sourceId: string, path: FlowPath) => void;
  startFailureSimulation: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  setSpeed: (speed: SimulationSpeed) => void;
  toggleNodeFailure: (nodeId: string) => void;
  setFailureResults: (
    affectedNodeIds: string[],
    affectedEdgeIds: string[],
    cascadeLevels?: CascadeLevel[],
  ) => void;
  setCurrentStepIndex: (index: number) => void;
  /** Toggle stepping mode on/off */
  setSteppingMode: (enabled: boolean) => void;
  /** Advance to the next step in flow simulation */
  stepForward: () => void;
  /** Go back to the previous step in flow simulation */
  stepBackward: () => void;
  /** Toggle round-trip animation */
  toggleRoundTrip: () => void;
  /** Set current round-trip phase */
  setRoundTripPhase: (phase: "request" | "response" | null) => void;
  /** Toggle stats panel visibility */
  toggleStats: () => void;
  /** Update simulation stats */
  setStats: (stats: SimulationStats | null) => void;
  // Chaos actions
  /** Update chaos configuration */
  setChaosConfig: (config: Partial<ChaosConfig>) => void;
  /** Set chaos sub-mode */
  setChaosSubMode: (subMode: ChaosSubMode) => void;
  /** Start the chaos auto-run timer */
  startChaos: () => void;
  /** Stop the chaos auto-run timer */
  stopChaos: () => void;
  /** Execute a single chaos round (random failure) */
  executeChaosRound: (
    failedIds: string[],
    affectedIds: string[],
    brokenEdgeIds: string[],
    cascadeLevels: CascadeLevel[],
  ) => void;
  /** Execute a partition event */
  executePartition: (severedEdgeIds: string[], event: ChaosEvent) => void;
  /** Add a chaos event to the log */
  addChaosEvent: (event: ChaosEvent) => void;
  /** Toggle the chaos event log panel */
  toggleChaosLog: () => void;
  /** Toggle a node's protected status */
  toggleProtectedNode: (nodeId: string) => void;
  /** Clear all chaos failures and reset for next round */
  clearChaosFailures: () => void;
  // Traffic actions
  /** Record a finished request or delivery, newest first. */
  recordTraffic: (entry: TrafficLogEntry) => void;
  setWaitingMessages: (messages: WaitingMessage[]) => void;
  reset: () => void;
}

const defaultChaosConfig: ChaosConfig = {
  subMode: "random-failure",
  intervalMs: 3000,
  maxFailuresPerRound: 2,
  failureProbability: 0.3,
  protectedNodeIds: [],
};

const initialState = {
  mode: "idle" as SimulationMode,
  isRunning: false,
  speed: 1 as SimulationSpeed,
  sourceNodeId: null as string | null,
  flowPath: null as FlowPath | null,
  activePathNodeIds: [] as string[],
  activePathEdgeIds: [] as string[],
  currentStepIndex: -1,
  steppingMode: false,
  roundTripEnabled: true,
  roundTripPhase: null as "request" | "response" | null,
  failedNodeIds: [] as string[],
  affectedNodeIds: [] as string[],
  affectedEdgeIds: [] as string[],
  cascadeLevels: [] as CascadeLevel[],
  chaosConfig: { ...defaultChaosConfig },
  chaosRound: 0,
  chaosEventLog: [] as ChaosEvent[],
  chaosIsAutoRunning: false,
  severedEdgeIds: [] as string[],
  showChaosLog: false,
  trafficLog: [] as TrafficLogEntry[],
  trafficCounts: { sent: 0, ok: 0, failed: 0, delivered: 0 } as TrafficCounts,
  waitingMessages: [] as WaitingMessage[],
  showStats: false,
  stats: null as SimulationStats | null,
};

const emptyTraffic = () => ({
  trafficLog: [] as TrafficLogEntry[],
  trafficCounts: { sent: 0, ok: 0, failed: 0, delivered: 0 },
  waitingMessages: [] as WaitingMessage[],
});

export const useSimulationStore = create<SimulationState>((set, get) => ({
  ...initialState,

  setMode: (mode) =>
    set(() => {
      // When switching modes, reset the other mode's state
      if (mode === "idle") {
        return { ...initialState, ...emptyTraffic() };
      }
      if (mode === "traffic") {
        return {
          ...initialState,
          ...emptyTraffic(),
          mode,
          speed: get().speed,
          chaosConfig: get().chaosConfig,
        };
      }
      if (mode === "flow") {
        return {
          mode,
          isRunning: false,
          failedNodeIds: [],
          affectedNodeIds: [],
          affectedEdgeIds: [],
          cascadeLevels: [],
          sourceNodeId: null,
          flowPath: null,
          activePathNodeIds: [],
          activePathEdgeIds: [],
          currentStepIndex: -1,
          steppingMode: false,
          roundTripPhase: null,
          stats: null,
        };
      }
      if (mode === "failure") {
        return {
          mode,
          isRunning: false,
          sourceNodeId: null,
          flowPath: null,
          activePathNodeIds: [],
          activePathEdgeIds: [],
          currentStepIndex: -1,
          steppingMode: false,
          roundTripPhase: null,
          stats: null,
          chaosRound: 0,
          chaosEventLog: [],
          chaosIsAutoRunning: false,
          severedEdgeIds: [],
        };
      }
      // chaos mode
      return {
        mode,
        isRunning: false,
        sourceNodeId: null,
        flowPath: null,
        activePathNodeIds: [],
        activePathEdgeIds: [],
        currentStepIndex: -1,
        steppingMode: false,
        roundTripPhase: null,
        failedNodeIds: [],
        affectedNodeIds: [],
        affectedEdgeIds: [],
        cascadeLevels: [],
        chaosRound: 0,
        chaosEventLog: [],
        chaosIsAutoRunning: false,
        severedEdgeIds: [],
        stats: null,
      };
    }),

  startFlowSimulation: (sourceId, path) =>
    set({
      sourceNodeId: sourceId,
      flowPath: path,
      activePathNodeIds: path.nodeIds,
      activePathEdgeIds: path.edgeIds,
      isRunning: true,
      currentStepIndex: 0,
    }),

  startFailureSimulation: () => set({ isRunning: true }),

  stop: () =>
    set((state) => ({
      isRunning: false,
      currentStepIndex: -1,
      // Keep the mode and selected nodes so user can re-run
      ...(state.mode === "flow"
        ? { sourceNodeId: null, flowPath: null, activePathNodeIds: [], activePathEdgeIds: [] }
        : {}),
    })),

  pause: () => set({ isRunning: false }),

  resume: () => set({ isRunning: true }),

  setSpeed: (speed) => set({ speed }),

  toggleNodeFailure: (nodeId) =>
    set((state) => {
      const exists = state.failedNodeIds.includes(nodeId);
      return {
        failedNodeIds: exists
          ? state.failedNodeIds.filter((id) => id !== nodeId)
          : [...state.failedNodeIds, nodeId],
      };
    }),

  setFailureResults: (affectedNodeIds, affectedEdgeIds, cascadeLevels) =>
    set({ affectedNodeIds, affectedEdgeIds, cascadeLevels: cascadeLevels || [] }),

  setCurrentStepIndex: (index) => set({ currentStepIndex: index }),

  setSteppingMode: (enabled) => set({ steppingMode: enabled }),

  stepForward: () => {
    const { flowPath, currentStepIndex, steppingMode } = get();
    if (!flowPath || !steppingMode) {
      return;
    }
    // Use levels length if available, otherwise fall back to flat steps
    const maxIndex = (flowPath.levels?.length ?? flowPath.steps.length) - 1;
    if (currentStepIndex < maxIndex) {
      set({ currentStepIndex: currentStepIndex + 1, isRunning: true });
    }
  },

  stepBackward: () => {
    const { currentStepIndex, steppingMode } = get();
    if (!steppingMode) {
      return;
    }
    if (currentStepIndex > 0) {
      set({ currentStepIndex: currentStepIndex - 1 });
    }
  },

  toggleRoundTrip: () => set((state) => ({ roundTripEnabled: !state.roundTripEnabled })),

  setRoundTripPhase: (phase) => set({ roundTripPhase: phase }),

  toggleStats: () => set((state) => ({ showStats: !state.showStats })),

  setStats: (stats) => set({ stats }),

  // Chaos actions
  setChaosConfig: (config) =>
    set((state) => ({ chaosConfig: { ...state.chaosConfig, ...config } })),

  setChaosSubMode: (subMode) =>
    set((state) => ({ chaosConfig: { ...state.chaosConfig, subMode } })),

  startChaos: () => set({ chaosIsAutoRunning: true, isRunning: true }),

  stopChaos: () => set({ chaosIsAutoRunning: false, isRunning: false }),

  executeChaosRound: (failedIds, affectedIds, brokenEdgeIds, cascadeLevels) =>
    set((state) => ({
      failedNodeIds: [...state.failedNodeIds, ...failedIds],
      affectedNodeIds: [...new Set([...state.affectedNodeIds, ...affectedIds])],
      affectedEdgeIds: [...new Set([...state.affectedEdgeIds, ...brokenEdgeIds])],
      cascadeLevels,
      chaosRound: state.chaosRound + 1,
    })),

  executePartition: (severedEdgeIds, event) =>
    set((state) => ({
      severedEdgeIds,
      chaosEventLog: [...state.chaosEventLog, event],
      chaosRound: state.chaosRound + 1,
    })),

  addChaosEvent: (event) => set((state) => ({ chaosEventLog: [...state.chaosEventLog, event] })),

  toggleChaosLog: () => set((state) => ({ showChaosLog: !state.showChaosLog })),

  toggleProtectedNode: (nodeId) =>
    set((state) => {
      const current = state.chaosConfig.protectedNodeIds;
      const exists = current.includes(nodeId);
      return {
        chaosConfig: {
          ...state.chaosConfig,
          protectedNodeIds: exists ? current.filter((id) => id !== nodeId) : [...current, nodeId],
        },
      };
    }),

  clearChaosFailures: () =>
    set({
      failedNodeIds: [],
      affectedNodeIds: [],
      affectedEdgeIds: [],
      cascadeLevels: [],
      severedEdgeIds: [],
    }),

  recordTraffic: (entry) =>
    set((state) => {
      const counts = { ...state.trafficCounts };
      if (entry.kind === "delivery") {
        counts.delivered += 1;
      } else {
        counts.sent += 1;
        counts[entry.outcome === "failed" ? "failed" : "ok"] += 1;
      }
      return {
        trafficCounts: counts,
        trafficLog: [entry, ...state.trafficLog].slice(0, TRAFFIC_LOG_LIMIT),
      };
    }),

  setWaitingMessages: (waitingMessages) => set({ waitingMessages }),

  reset: () => set({ ...initialState, ...emptyTraffic(), chaosConfig: { ...defaultChaosConfig } }),
}));
