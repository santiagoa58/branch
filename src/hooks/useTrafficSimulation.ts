/**
 * useTrafficSimulation — live traffic: requests keep flowing from each entry point while the
 * person takes components down and brings them back. Planning is pure (trafficSimulation);
 * this hook only schedules requests, animates their hops with GSAP and records outcomes.
 */
import { useEffect, useRef } from "react";
import type { Edge } from "@xyflow/react";
import { gsap } from "@/lib/gsap";
import { PROTOCOL_CONFIG } from "@/constants";
import { edgeProtocolSchema } from "@/schemas/diagram";
import { useDiagramStore } from "@/store/diagramStore";
import { useSimulationStore } from "@/store/simulationStore";
import type { TrafficLogEntry } from "@/types/simulation";
import {
  planRequest,
  releaseWaiting,
  trafficSources,
  type HopKind,
  type TrafficPlan,
  type WaitingMessage,
} from "@/utils/trafficSimulation";
import { computeStepDuration, getEdgePath, getEdgeSvgLayer } from "./useSimulationAnimation";

/** How often each entry point sends a request at 1× speed. */
export const SPAWN_EVERY_MS = 1800;
/** Requests on screen at once; more would turn the canvas into noise. */
const MAX_IN_FLIGHT = 24;

const RESPONSE_COLOR = "#22c55e";
const ERROR_COLOR = "#ef4444";
const FALLBACK_COLOR = "#3b82f6";

/** On-screen hop time: readable regardless of the diagram's millisecond latencies. */
function visualHopMs(edge: Edge): number {
  const latency = edge.data?.["latencyMs"];
  return computeStepDuration(typeof latency === "number" ? latency : undefined) * 1000;
}

function hopColor(kind: HopKind, edge: Edge | undefined): string {
  if (kind === "response") {
    return RESPONSE_COLOR;
  }
  if (kind === "error") {
    return ERROR_COLOR;
  }
  const protocol = edgeProtocolSchema.safeParse(edge?.data?.["protocol"]);
  return protocol.success ? PROTOCOL_CONFIG[protocol.data].color.primary : FALLBACK_COLOR;
}

function createDot(layer: SVGSVGElement, color: string, hollow: boolean): SVGCircleElement {
  const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  dot.setAttribute("r", hollow ? "4" : "5");
  dot.setAttribute("fill", hollow ? "none" : color);
  dot.setAttribute("stroke", color);
  dot.setAttribute("stroke-width", "2");
  dot.setAttribute("opacity", "0");
  dot.setAttribute("pointer-events", "none");
  dot.dataset["traffic"] = "true";
  layer.appendChild(dot);
  return dot;
}

function mergeWaiting(current: WaitingMessage[], added: WaitingMessage[]): WaitingMessage[] {
  const ids = new Set(current.map((message) => message.id));
  return [...current, ...added.filter((message) => !ids.has(message.id))];
}

function requestEntry(plan: TrafficPlan): TrafficLogEntry {
  return {
    id: plan.id,
    kind: "request",
    sourceId: plan.sourceId,
    outcome: plan.outcome === "failed" ? "failed" : plan.waiting.length > 0 ? "waiting" : "ok",
    ...(plan.failedAt ? { failedAt: plan.failedAt } : {}),
    latencyMs: plan.durationMs,
    waitingCount: plan.waiting.length,
  };
}

function deliveryEntry(plan: TrafficPlan): TrafficLogEntry {
  return {
    id: plan.id,
    kind: "delivery",
    sourceId: plan.sourceId,
    outcome: plan.waiting.length > 0 ? "waiting" : "delivered",
    latencyMs: plan.durationMs,
    waitingCount: plan.waiting.length,
  };
}

/** Animate a plan's hops; `onDone` runs when its last hop arrives. */
function playPlan(timelines: Set<gsap.core.Timeline>, plan: TrafficPlan, onDone: () => void): void {
  const layer = getEdgeSvgLayer();
  const { edges } = useDiagramStore.getState();
  const { speed: currentSpeed, isRunning: running } = useSimulationStore.getState();
  const edgeById = new Map(edges.map((edge) => [edge.id, edge]));
  const dots: SVGCircleElement[] = [];
  const timeline = gsap.timeline({
    onComplete: () => {
      dots.forEach((dot) => dot.remove());
      timelines.delete(timeline);
      onDone();
    },
  });
  for (const hop of plan.hops) {
    const path = getEdgePath(hop.edgeId);
    if (!layer || !path) {
      continue;
    }
    const dot = createDot(
      layer,
      hopColor(hop.kind, edgeById.get(hop.edgeId)),
      hop.kind === "message",
    );
    dots.push(dot);
    const start = hop.startMs / 1000;
    timeline.set(dot, { opacity: 1 }, start);
    timeline.to(
      dot,
      {
        motionPath: {
          path,
          align: path,
          alignOrigin: [0.5, 0.5],
          start: hop.reverse ? 1 : 0,
          end: hop.reverse ? 0 : 1,
        },
        duration: hop.durationMs / 1000,
        ease: "none",
      },
      start,
    );
    timeline.to(dot, { opacity: 0, duration: 0.15 }, start + hop.durationMs / 1000);
  }
  // Keep the timeline alive for the whole plan even if some edges aren't rendered.
  timeline.set({}, {}, plan.durationMs / 1000);
  timeline.timeScale(currentSpeed);
  if (!running) {
    timeline.pause();
  }
  timelines.add(timeline);
}

/**
 * Deliver messages whose blocking component is back and keep the rest waiting. Requests planned
 * while a component was down can finish after it recovers, so every addition goes through here.
 */
function settleWaiting(timelines: Set<gsap.core.Timeline>, messages: WaitingMessage[]): void {
  const { edges } = useDiagramStore.getState();
  const store = useSimulationStore.getState();
  const down = new Set(store.failedNodeIds);
  const outcome = releaseWaiting(edges, messages, down);
  const visual = releaseWaiting(edges, messages, down, visualHopMs);
  store.setWaitingMessages(outcome.stillWaiting);
  outcome.plans.forEach((plan, index) => {
    const finish = () => {
      const state = useSimulationStore.getState();
      state.recordTraffic(deliveryEntry(plan));
      settleWaiting(timelines, mergeWaiting(state.waitingMessages, plan.waiting));
    };
    const animated = visual.plans[index];
    if (animated) {
      playPlan(timelines, animated, finish);
    } else {
      finish();
    }
  });
}

export function useTrafficSimulation() {
  const mode = useSimulationStore((s) => s.mode);
  const isRunning = useSimulationStore((s) => s.isRunning);
  const speed = useSimulationStore((s) => s.speed);
  const failedNodeIds = useSimulationStore((s) => s.failedNodeIds);
  const timelines = useRef(new Set<gsap.core.Timeline>());
  const requestCount = useRef(0);
  const previousDown = useRef<string[]>([]);
  const active = mode === "traffic";

  // Spawn requests from every entry point while traffic is running.
  useEffect(() => {
    if (!active || !isRunning) {
      return;
    }
    const spawn = () => {
      const { nodes, edges, flows } = useDiagramStore.getState();
      const store = useSimulationStore.getState();
      const down = new Set(store.failedNodeIds);
      for (const sourceId of trafficSources(nodes, edges, flows)) {
        if (timelines.current.size >= MAX_IN_FLIGHT) {
          return;
        }
        const id = `r${++requestCount.current}`;
        const outcome = planRequest(edges, sourceId, down, id);
        const visual = planRequest(edges, sourceId, down, id, visualHopMs);
        if (!outcome || !visual) {
          continue;
        }
        playPlan(timelines.current, visual, () => {
          const state = useSimulationStore.getState();
          state.recordTraffic(requestEntry(outcome));
          settleWaiting(timelines.current, mergeWaiting(state.waitingMessages, outcome.waiting));
        });
      }
    };
    spawn();
    const timer = setInterval(spawn, SPAWN_EVERY_MS / speed);
    return () => clearInterval(timer);
  }, [active, isRunning, speed]);

  // Pause, resume and speed apply to requests already in flight.
  useEffect(() => {
    for (const timeline of timelines.current) {
      timeline.timeScale(speed);
      if (isRunning) {
        timeline.resume();
      } else {
        timeline.pause();
      }
    }
  }, [isRunning, speed]);

  // When a component comes back, deliver the messages that were waiting for it.
  useEffect(() => {
    const recovered = previousDown.current.some((id) => !failedNodeIds.includes(id));
    previousDown.current = failedNodeIds;
    if (!active || !recovered) {
      return;
    }
    settleWaiting(timelines.current, useSimulationStore.getState().waitingMessages);
  }, [active, failedNodeIds]);

  // Leaving traffic mode removes everything still on screen.
  useEffect(() => {
    if (active) {
      return;
    }
    for (const timeline of timelines.current) {
      timeline.kill();
    }
    timelines.current.clear();
    document.querySelectorAll('circle[data-traffic="true"]').forEach((dot) => dot.remove());
  }, [active]);

  useEffect(
    () => () => {
      for (const timeline of timelines.current) {
        timeline.kill();
      }
      document.querySelectorAll('circle[data-traffic="true"]').forEach((dot) => dot.remove());
    },
    [],
  );
}
