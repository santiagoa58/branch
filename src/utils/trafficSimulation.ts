import type { Edge, Node } from "@xyflow/react";
import type { ArchitectureNodeType } from "@/types";
import { isOutsideActor } from "@/utils/designRules";
import { PROTOCOL_CONFIG } from "@/constants";
import { edgeProtocolSchema } from "@/schemas/diagram";

import { isDurableNode, simulationHopMs, simulationNodeType } from "./simulationSemantics";

/** Stop combinatorial branching before it can block the editor or allocate unbounded work. */
const MAX_PLANNED_HOPS = 4096;
const MAX_CALL_DEPTH = 128;

export class SimulationLimitError extends Error {
  constructor() {
    super(
      "This diagram creates too many request branches to simulate. Simplify the connections or trace a smaller part of the design.",
    );
    this.name = "SimulationLimitError";
  }
}

function createHopBudget(): () => void {
  let count = 0;
  return () => {
    if (count >= MAX_PLANNED_HOPS) {
      throw new SimulationLimitError();
    }
    count += 1;
  };
}

/** Pure, illustrative call timing shared by traffic and trace playback. */
export type HopKind = "request" | "response" | "error" | "message";

export interface TrafficHop {
  edgeId: string;
  from: string;
  to: string;
  kind: HopKind;
  startMs: number;
  durationMs: number;
  /** True when the hop travels against the edge direction (responses and errors). */
  reverse: boolean;
}

/** A hand-off that can't be processed yet because a component is down. */
export interface WaitingMessage {
  id: string;
  requestId: string;
  edgeId: string;
  from: string;
  to: string;
  /** The down component that has to recover before this message can be delivered. */
  blockedBy: string;
}

export interface TrafficPlan {
  id: string;
  /** Where the request started, or the receiver for a released message. */
  sourceId: string;
  hops: TrafficHop[];
  outcome: "ok" | "failed";
  /** The first down component a synchronous call reached. */
  failedAt?: string;
  /** Time until the originating caller receives its response; excludes detached work. */
  responseMs: number;
  /** Time until all foreground and detached hops finish. */
  durationMs: number;
  waiting: WaitingMessage[];
}

export interface TrafficOptions {
  nodes?: readonly Node[];
  /** Presentation-only timing transform; metrics use the untransformed plan. */
  durationOf?: (latencyMs: number) => number;
  /** Recovery batch size; zero leaves all accepted messages waiting for a later batch. */
  maxDeliveries?: number;
}

/** Hand-offs the caller doesn't wait for: async edges and fire-and-forget protocols. */
export function isAsyncEdge(edge: Edge): boolean {
  if (edge.data?.["async"] === true) {
    return true;
  }
  const protocol = edgeProtocolSchema.safeParse(edge.data?.["protocol"]);
  return protocol.success && !PROTOCOL_CONFIG[protocol.data].requestResponse;
}

function outgoingBySource(edges: Edge[]): Map<string, Edge[]> {
  const bySource = new Map<string, Edge[]>();
  for (const edge of edges) {
    bySource.set(edge.source, [...(bySource.get(edge.source) ?? []), edge]);
  }
  return bySource;
}

interface VisitResult {
  endMs: number;
  failedAt?: string;
}

interface Planner {
  hops: TrafficHop[];
  waiting: WaitingMessage[];
  visit: (nodeId: string, startMs: number, ancestry: ReadonlySet<string>) => VisitResult;
  handOff: (
    edge: Edge,
    startMs: number,
    ancestry: ReadonlySet<string>,
    deliveryId?: string,
  ) => VisitResult;
}

interface PlannerContext {
  edges: Edge[];
  down: ReadonlySet<string>;
  requestId: string;
  options: TrafficOptions;
  deliveryPrefix?: string;
}

function createPlanner({
  edges,
  down,
  requestId,
  options,
  deliveryPrefix = requestId,
}: PlannerContext): Planner {
  const outgoing = outgoingBySource(edges);
  const nodes = options.nodes ?? [];
  const hops: TrafficHop[] = [];
  const waiting: WaitingMessage[] = [];
  let deliverySequence = 0;
  const consumeHop = createHopBudget();
  const addHop = (hop: TrafficHop) => {
    consumeHop();
    hops.push(hop);
  };
  const durationOf = (edge: Edge) => {
    const latency = simulationHopMs(edge, nodes);
    return options.durationOf ? options.durationOf(latency) : latency;
  };

  const handOff: Planner["handOff"] = (edge, startMs, ancestry, deliveryId) => {
    const durationMs = durationOf(edge);
    addHop({
      edgeId: edge.id,
      from: edge.source,
      to: edge.target,
      kind: "message",
      startMs,
      durationMs,
      reverse: false,
    });
    const processed = down.has(edge.target)
      ? { endMs: startMs + durationMs, failedAt: edge.target }
      : visit(edge.target, startMs + durationMs, new Set([...ancestry, edge.target]));
    // Retention belongs to an actual queue/log, never to an arbitrary async caller.
    if (processed.failedAt && isDurableNode(edge.source, nodes)) {
      waiting.push({
        id: deliveryId ?? `${deliveryPrefix}:delivery-${++deliverySequence}`,
        requestId,
        edgeId: edge.id,
        from: edge.source,
        to: edge.target,
        blockedBy: processed.failedAt,
      });
    }
    return processed;
  };

  const visit: Planner["visit"] = (nodeId, startMs, ancestry) => {
    if (ancestry.size > MAX_CALL_DEPTH) {
      throw new SimulationLimitError();
    }
    let endMs = startMs;
    let failedAt: string | undefined;
    const sourceType = simulationNodeType(nodeId, nodes);
    const dispatches = isDurableNode(nodeId, nodes) || sourceType === "eventbus";
    for (const edge of outgoing.get(nodeId) ?? []) {
      if (ancestry.has(edge.target)) {
        continue;
      }
      // A broker's consumers run independently of its enqueue acknowledgment.
      // A producer must still reach a live queue/log before its message is accepted.
      if (dispatches || (isAsyncEdge(edge) && !isDurableNode(edge.target, nodes))) {
        handOff(edge, startMs, ancestry);
        continue;
      }
      const durationMs = durationOf(edge);
      const call = { edgeId: edge.id, durationMs };
      addHop({
        ...call,
        from: nodeId,
        to: edge.target,
        kind: "request",
        startMs,
        reverse: false,
      });
      const child = down.has(edge.target)
        ? { endMs: startMs + durationMs, failedAt: edge.target }
        : visit(edge.target, startMs + durationMs, new Set([...ancestry, edge.target]));
      addHop({
        ...call,
        from: edge.target,
        to: nodeId,
        kind: child.failedAt ? "error" : "response",
        startMs: child.endMs,
        reverse: true,
      });
      endMs = Math.max(endMs, child.endMs + durationMs);
      failedAt ??= child.failedAt;
    }
    return failedAt ? { endMs, failedAt } : { endMs };
  };

  return { hops, waiting, visit, handOff };
}

function toPlan(id: string, sourceId: string, planner: Planner, result: VisitResult): TrafficPlan {
  return {
    id,
    sourceId,
    hops: planner.hops,
    outcome: result.failedAt ? "failed" : "ok",
    ...(result.failedAt ? { failedAt: result.failedAt } : {}),
    responseMs: result.endMs,
    durationMs: planner.hops.reduce(
      (end, hop) => Math.max(end, hop.startMs + hop.durationMs),
      result.endMs,
    ),
    waiting: planner.waiting,
  };
}

/** Plans one request from an entry component, or null when the entry itself is down. */
// oxlint-disable-next-line max-params -- debt: existing positional API; callers share the options object
export function planRequest(
  edges: Edge[],
  sourceId: string,
  down: ReadonlySet<string>,
  requestId: string,
  options: TrafficOptions = {},
): TrafficPlan | null {
  if (down.has(sourceId)) {
    return null;
  }
  const planner = createPlanner({ edges, down, requestId, options });
  return toPlan(requestId, sourceId, planner, planner.visit(sourceId, 0, new Set([sourceId])));
}

/** Retry only accepted deliveries that still belong to a queue/log in this diagram. */
export function releaseWaiting(
  edges: Edge[],
  waiting: readonly WaitingMessage[],
  down: ReadonlySet<string>,
  options: TrafficOptions = {},
): { plans: TrafficPlan[]; stillWaiting: WaitingMessage[] } {
  const byId = new Map(edges.map((edge) => [edge.id, edge]));
  const plans: TrafficPlan[] = [];
  const stillWaiting: WaitingMessage[] = [];
  const maxDeliveries = Math.max(0, Math.floor(options.maxDeliveries ?? 24));
  let batchHops = 0;
  let batchFull = false;
  for (const message of waiting) {
    const edge = byId.get(message.edgeId);
    if (
      !edge ||
      edge.source !== message.from ||
      edge.target !== message.to ||
      !isDurableNode(message.from, options.nodes ?? [])
    ) {
      continue;
    }
    if (batchFull || plans.length >= maxDeliveries) {
      stillWaiting.push(message);
      continue;
    }
    const blockedBy = down.has(message.from) ? message.from : message.blockedBy;
    if (down.has(blockedBy)) {
      stillWaiting.push({ ...message, blockedBy });
      continue;
    }
    const planner = createPlanner({
      edges,
      down,
      requestId: message.requestId,
      options,
      deliveryPrefix: message.id,
    });
    const result = planner.handOff(edge, 0, new Set([edge.source]), message.id);
    // Each delivery is valid on its own. Defer the rest if this frame's batch is full.
    if (plans.length > 0 && batchHops + planner.hops.length > MAX_PLANNED_HOPS) {
      batchFull = true;
      stillWaiting.push(message);
      continue;
    }
    batchHops += planner.hops.length;
    // A failed delivery remains retained by the broker, not a failed new request.
    plans.push(toPlan(message.id, message.to, planner, { endMs: result.endMs }));
  }
  return { plans, stillWaiting };
}

/**
 * Where traffic starts: each saved flow's start, or else every outside actor (person, app, device
 * or third party) with an outgoing connection, or else any component nothing calls.
 */
export function trafficSources(
  nodes: Node[],
  edges: Edge[],
  flows: readonly { sourceNodeId: string }[],
): string[] {
  const ids = new Set(nodes.map((node) => node.id));
  const fromFlows = [...new Set(flows.map((flow) => flow.sourceNodeId))].filter((id) =>
    ids.has(id),
  );
  if (fromFlows.length > 0) {
    return fromFlows;
  }
  const callers = new Set(edges.map((edge) => edge.source));
  const called = new Set(edges.map((edge) => edge.target));
  const architecture = nodes.filter((node) => node.type === "architecture" && callers.has(node.id));
  const actors = architecture.filter((node) =>
    isOutsideActor((node.data as { type?: ArchitectureNodeType }).type),
  );
  return (actors.length > 0 ? actors : architecture.filter((node) => !called.has(node.id))).map(
    (node) => node.id,
  );
}
