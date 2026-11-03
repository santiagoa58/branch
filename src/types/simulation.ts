/**
 * Simulation-related type definitions.
 * These types are ephemeral — not persisted to localStorage or included in undo/redo history.
 */

export type SimulationMode = "idle" | "traffic" | "flow" | "failure" | "chaos";

/** One finished request or delivered message in the live traffic log. */
export interface TrafficLogEntry {
  id: string;
  kind: "request" | "delivery";
  /** Where the request started, or the component that received a released message. */
  sourceId: string;
  outcome: "ok" | "failed" | "waiting" | "delivered";
  /** The down component a failed request reached first. */
  failedAt?: string;
  /** Illustrative end-to-end latency from the diagram's edge latencies. */
  latencyMs: number;
  /** Messages this request left waiting for a down component. */
  waitingCount: number;
}

export interface TrafficCounts {
  sent: number;
  ok: number;
  failed: number;
  delivered: number;
}

export type SimulationSpeed = 0.25 | 0.5 | 1 | 2 | 4;

export interface SimulationStep {
  /** The edge being traversed in this step */
  edgeId: string;
  /** The source node of this step */
  fromNodeId: string;
  /** The target node of this step */
  toNodeId: string;
  /** The protocol used on this edge */
  protocol?: string;
  /** The SVG path string for this edge (for MotionPathPlugin) */
  edgePath?: string;
  /** Latency in milliseconds for this edge (from edge data) */
  latencyMs?: number;
}

/** A single step in a branch-aware BFS level */
export interface BranchStep extends SimulationStep {
  /** Unique identifier for this branch (e.g. 'b-nodeId-edgeId') */
  branchId: string;
  /** BFS depth from the source node (0-based) */
  depth: number;
}

/** A BFS level grouping all steps at the same depth */
export interface BranchLevel {
  /** BFS depth from the source node (0-based) */
  depth: number;
  /** All steps (possibly from multiple branches) at this depth */
  steps: BranchStep[];
}

export interface FlowPath {
  /** All node IDs in the traced path, in order */
  nodeIds: string[];
  /** All edge IDs in the traced path, in order */
  edgeIds: string[];
  /** Ordered steps describing the traversal (flat, backward-compatible) */
  steps: SimulationStep[];
  /** Branch-aware BFS levels for parallel path animation */
  levels?: BranchLevel[];
}

export interface BlastRadius {
  /** Nodes that become unreachable due to failure */
  affectedNodeIds: string[];
  /** Edges that are broken due to failure */
  brokenEdgeIds: string[];
  /**
   * Cascading levels — nodes grouped by BFS hop distance from failed nodes.
   * Level 0 = directly connected to a failed node, level 1 = one hop further, etc.
   */
  levels: CascadeLevel[];
}

/** A single level in the failure cascade (one BFS hop) */
export interface CascadeLevel {
  /** BFS depth from the nearest failed node (0-based) */
  depth: number;
  /** Node IDs at this cascade level */
  nodeIds: string[];
  /** Edge IDs that connect the previous level to this level */
  edgeIds: string[];
}

/** Chaos mode sub-modes */
export type ChaosSubMode = "random-failure" | "network-partition";

/** Configuration for chaos mode */
export interface ChaosConfig {
  /** Which chaos sub-mode to run */
  subMode: ChaosSubMode;
  /** Interval between chaos rounds in milliseconds */
  intervalMs: number;
  /** Max number of nodes to fail per round (random-failure) */
  maxFailuresPerRound: number;
  /** Probability (0-1) that a node will be selected for failure */
  failureProbability: number;
  /** Node IDs that are immune to chaos failures */
  protectedNodeIds: string[];
}

/** A single chaos event logged during simulation */
export interface ChaosEvent {
  /** Sequential round number (1-based) */
  round: number;
  /** Timestamp when the event occurred */
  timestamp: number;
  /** Type of chaos event */
  type: "node-failure" | "cascade" | "partition" | "recovery";
  /** Human-readable description */
  message: string;
  /** Node IDs directly involved */
  nodeIds: string[];
  /** Edge IDs involved (for partitions) */
  edgeIds?: string[];
  /** Number of affected (downstream) nodes */
  affectedCount: number;
}

/** Result of a network partition computation */
export interface PartitionResult {
  /** First partition group of node IDs */
  groupA: string[];
  /** Second partition group of node IDs */
  groupB: string[];
  /** Edge IDs that were severed to create the partition */
  severedEdgeIds: string[];
}

/** Simulation statistics for the stats panel */
export interface SimulationStats {
  // Flow mode stats
  totalHops: number;
  protocolsUsed: string[];
  pathLength: number;
  /** Cumulative latency across all edges in milliseconds */
  totalLatencyMs: number;
  /** Edge ID with the highest latency (bottleneck) */
  bottleneckEdgeId: string | null;
  /** Number of unique branches in the flow path */
  branchCount: number;
  /** Round-trip latency (forward + return) in milliseconds, null if RT disabled */
  roundTripLatencyMs: number | null;
  // Failure mode stats
  failedCount: number;
  affectedCount: number;
  impactPercentage: number;
  brokenEdgeCount: number;
  // Chaos mode stats
  /** Total rounds completed in chaos simulation */
  chaosRounds: number;
  /** Total nodes failed across all chaos rounds */
  chaosTotalFailures: number;
  /** Mean time between failures in milliseconds */
  chaosMTBF: number | null;
  /** Number of severed edges (network partition) */
  chaosSeveredEdges: number;
}

/**
 * A named, replayable flow scenario saved with the diagram. Unlike the
 * simulation runtime state above, NamedFlow is PERSISTED in DiagramData.flows
 * and survives reloads.
 */
export interface NamedFlow {
  id: string;
  name: string;
  description?: string;
  /** ID of the node where the flow originates. */
  sourceNodeId: string;
  /** Optional accent color for the flow chip / source ring (hex or CSS color). */
  color?: string;
  /** Playback speed to apply when the flow starts. */
  speed?: SimulationSpeed;
  /**
   * Optional explicit edge sequence. When omitted the path is traced from
   * sourceNodeId via traceFlowPath on play.
   */
  edgeIds?: string[];
  createdAt: string;
}
