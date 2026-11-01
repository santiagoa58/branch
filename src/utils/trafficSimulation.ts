import type { Edge, Node } from "@xyflow/react";
import type { ArchitectureNodeType } from "@/types";
import { isOutsideActor } from "@/utils/designRules";
import { PROTOCOL_CONFIG } from "@/constants";
import { edgeProtocolSchema } from "@/schemas/diagram";

/**
 * Pure planning for the live traffic simulation. A request is a set of timed hops: calls travel
 * along edges, responses and errors travel back. Asynchronous hand-offs (queues, streams, async
 * edges) never block the caller; when the receiver is down they wait until it recovers.
 */

/** Illustrative per-hop latency for edges that don't specify one. */
export const DEFAULT_HOP_MS = 100;

export type HopKind = "request" | "response" | "error" | "message";

interface TrafficHop {
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
  durationMs: number;
  waiting: WaitingMessage[];
}

export type HopDuration = (edge: Edge) => number;

/** The diagram's own illustrative latency for an edge. */
function hopDuration(edge: Edge): number {
  const latency = edge.data?.["latencyMs"];
  return typeof latency === "number" && latency > 0 ? latency : DEFAULT_HOP_MS;
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

interface Planner {
  hops: TrafficHop[];
  waiting: WaitingMessage[];
  visit: (nodeId: string, startMs: number) => { endMs: number; failedAt?: string };
  handOff: (edge: Edge, startMs: number) => void;
}

// oxlint-disable-next-line max-params -- debt: 5 params; take an options object
function createPlanner(
  edges: Edge[],
  down: ReadonlySet<string>,
  requestId: string,
  entryId?: string,
  durationOf: HopDuration = hopDuration,
): Planner {
  const outgoing = outgoingBySource(edges);
  // Each component handles a given request once, which also stops cycles.
  const visited = new Set<string>(entryId === undefined ? [] : [entryId]);
  const hops: TrafficHop[] = [];
  const waiting: WaitingMessage[] = [];

  const wait = (edge: Edge, blockedBy: string) =>
    waiting.push({
      id: `${requestId}:${edge.id}`,
      requestId,
      edgeId: edge.id,
      from: edge.source,
      to: edge.target,
      blockedBy,
    });

  const handOff = (edge: Edge, startMs: number) => {
    const durationMs = durationOf(edge);
    hops.push({
      edgeId: edge.id,
      from: edge.source,
      to: edge.target,
      kind: "message",
      startMs,
      durationMs,
      reverse: false,
    });
    if (down.has(edge.target)) {
      wait(edge, edge.target);
      return;
    }
    visited.add(edge.target);
    // A message is retried until its whole synchronous processing succeeds.
    const processed = visit(edge.target, startMs + durationMs);
    if (processed.failedAt) {
      wait(edge, processed.failedAt);
    }
  };

  const visit = (nodeId: string, startMs: number): { endMs: number; failedAt?: string } => {
    let endMs = startMs;
    let failedAt: string | undefined;
    for (const edge of outgoing.get(nodeId) ?? []) {
      if (visited.has(edge.target)) {
        continue;
      }
      if (isAsyncEdge(edge)) {
        handOff(edge, startMs);
        continue;
      }
      visited.add(edge.target);
      const durationMs = durationOf(edge);
      const call = { edgeId: edge.id, durationMs };
      hops.push({
        ...call,
        from: nodeId,
        to: edge.target,
        kind: "request",
        startMs,
        reverse: false,
      });
      const child = down.has(edge.target)
        ? { endMs: startMs + durationMs, failedAt: edge.target }
        : visit(edge.target, startMs + durationMs);
      hops.push({
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

function toPlan(
  id: string,
  sourceId: string,
  planner: Planner,
  result: { endMs: number; failedAt?: string },
): TrafficPlan {
  return {
    id,
    sourceId,
    hops: planner.hops,
    outcome: result.failedAt ? "failed" : "ok",
    ...(result.failedAt ? { failedAt: result.failedAt } : {}),
    durationMs: Math.max(result.endMs, ...planner.hops.map((hop) => hop.startMs + hop.durationMs)),
    waiting: planner.waiting,
  };
}

/** Plans one request from an entry component, or null when the entry itself is down. */
// oxlint-disable-next-line max-params -- debt: 5 params; take an options object
export function planRequest(
  edges: Edge[],
  sourceId: string,
  down: ReadonlySet<string>,
  requestId: string,
  durationOf?: HopDuration,
): TrafficPlan | null {
  if (down.has(sourceId)) {
    return null;
  }
  const planner = createPlanner(edges, down, requestId, sourceId, durationOf);
  return toPlan(requestId, sourceId, planner, planner.visit(sourceId, 0));
}

/**
 * Delivers waiting messages whose blocking component is back. A message that reaches another
 * down component waits again, now blocked by that one.
 */
export function releaseWaiting(
  edges: Edge[],
  waiting: readonly WaitingMessage[],
  down: ReadonlySet<string>,
  durationOf?: HopDuration,
): { plans: TrafficPlan[]; stillWaiting: WaitingMessage[] } {
  const byId = new Map(edges.map((edge) => [edge.id, edge]));
  const plans: TrafficPlan[] = [];
  const stillWaiting: WaitingMessage[] = [];
  for (const message of waiting) {
    const edge = byId.get(message.edgeId);
    if (!edge) {
      continue;
    }
    if (down.has(message.blockedBy)) {
      stillWaiting.push(message);
      continue;
    }
    const planner = createPlanner(edges, down, message.requestId, undefined, durationOf);
    planner.handOff(edge, 0);
    plans.push(toPlan(message.id, message.to, planner, { endMs: 0 }));
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
