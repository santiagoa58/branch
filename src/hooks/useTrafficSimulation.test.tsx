import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { Edge, Node } from "@xyflow/react";
import { gsap } from "@/lib/gsap";
import { useDiagramStore } from "@/store/diagramStore";
import { TRAFFIC_LOG_LIMIT, useSimulationStore } from "@/store/simulationStore";
import { useTrafficSimulation } from "./useTrafficSimulation";

function node(id: string, type: string): Node {
  return { id, type: "architecture", position: { x: 0, y: 0 }, data: { label: id, type } };
}

function edge(source: string, target: string, protocol: string): Edge {
  return { id: `${source}-${target}`, source, target, data: { protocol } };
}

/** Finish every animation now, so request outcomes are recorded without waiting. */
function finishAnimations() {
  act(() => {
    gsap.exportRoot().progress(1);
  });
}

beforeEach(() => {
  useDiagramStore.setState({
    ...useDiagramStore.getInitialState(),
    nodes: [
      node("app", "webapp"),
      node("api", "service"),
      node("db", "database"),
      node("queue", "queue"),
      node("worker", "worker"),
    ],
    edges: [
      edge("app", "api", "http"),
      edge("api", "db", "sql"),
      edge("api", "queue", "amqp"),
      edge("queue", "worker", "amqp"),
    ],
  });
  useSimulationStore.getState().reset();
  useSimulationStore.getState().setMode("traffic");
});

afterEach(() => {
  cleanup();
  useSimulationStore.getState().reset();
});

describe("useTrafficSimulation", () => {
  it("sends nothing until traffic is playing", () => {
    renderHook(() => useTrafficSimulation());
    finishAnimations();
    expect(useSimulationStore.getState().trafficCounts.sent).toBe(0);
  });

  it("records a successful request from each entry point", () => {
    useSimulationStore.getState().resume();
    renderHook(() => useTrafficSimulation());
    finishAnimations();
    const { trafficCounts, trafficLog } = useSimulationStore.getState();
    expect(trafficCounts).toMatchObject({ sent: 1, ok: 1, failed: 0 });
    expect(trafficLog[0]).toMatchObject({ kind: "request", sourceId: "app", outcome: "ok" });
  });

  it("records where a request failed while a component is down", () => {
    useSimulationStore.setState({ failedNodeIds: ["db"] });
    useSimulationStore.getState().resume();
    renderHook(() => useTrafficSimulation());
    finishAnimations();
    expect(useSimulationStore.getState().trafficLog[0]).toMatchObject({
      outcome: "failed",
      failedAt: "db",
    });
    expect(useSimulationStore.getState().trafficCounts.failed).toBe(1);
  });

  it("holds messages while a consumer is down and delivers them when it recovers", () => {
    useSimulationStore.setState({ failedNodeIds: ["worker"] });
    useSimulationStore.getState().resume();
    renderHook(() => useTrafficSimulation());
    finishAnimations();
    expect(useSimulationStore.getState().trafficLog[0]).toMatchObject({
      outcome: "waiting",
      waitingCount: 1,
    });
    expect(useSimulationStore.getState().waitingMessages).toMatchObject([
      { from: "queue", to: "worker", blockedBy: "worker" },
    ]);

    // Pause so no new requests interleave with the recovery.
    act(() => {
      useSimulationStore.getState().pause();
      useSimulationStore.getState().toggleNodeFailure("worker");
    });
    expect(useSimulationStore.getState().waitingMessages).toEqual([]);
    act(() => useSimulationStore.getState().resume());
    finishAnimations();
    expect(useSimulationStore.getState().trafficCounts.delivered).toBe(1);
    expect(
      useSimulationStore.getState().trafficLog.find((entry) => entry.kind === "delivery"),
    ).toMatchObject({ sourceId: "worker", outcome: "delivered" });
  });

  it("delivers messages from requests that finish after their blocker already recovered", () => {
    useSimulationStore.setState({ failedNodeIds: ["worker"] });
    useSimulationStore.getState().resume();
    renderHook(() => useTrafficSimulation());
    // The request was planned with the worker down but is still in flight when it recovers.
    act(() => {
      useSimulationStore.getState().pause();
      useSimulationStore.getState().toggleNodeFailure("worker");
    });
    act(() => useSimulationStore.getState().resume());
    finishAnimations();
    finishAnimations();
    expect(useSimulationStore.getState().waitingMessages).toEqual([]);
    expect(useSimulationStore.getState().trafficCounts.delivered).toBeGreaterThanOrEqual(1);
  });

  it("clears in-flight requests when leaving traffic mode", () => {
    useSimulationStore.getState().resume();
    renderHook(() => useTrafficSimulation());
    act(() => useSimulationStore.getState().setMode("idle"));
    finishAnimations();
    expect(useSimulationStore.getState().trafficCounts.sent).toBe(0);
  });
});

describe("traffic log in the simulation store", () => {
  it("keeps the newest entries first and only the most recent ones", () => {
    const store = useSimulationStore.getState();
    for (let index = 0; index < TRAFFIC_LOG_LIMIT + 5; index++) {
      store.recordTraffic({
        id: `r${index}`,
        kind: "request",
        sourceId: "app",
        outcome: index % 2 ? "failed" : "ok",
        latencyMs: 10,
        waitingCount: 0,
      });
    }
    const { trafficLog, trafficCounts } = useSimulationStore.getState();
    expect(trafficLog).toHaveLength(TRAFFIC_LOG_LIMIT);
    expect(trafficLog[0]?.id).toBe(`r${TRAFFIC_LOG_LIMIT + 4}`);
    expect(trafficCounts).toMatchObject({ sent: TRAFFIC_LOG_LIMIT + 5, ok: 23, failed: 22 });
  });

  it("starts each traffic run with an empty log and nothing down", () => {
    const store = useSimulationStore.getState();
    store.toggleNodeFailure("db");
    store.recordTraffic({
      id: "r1",
      kind: "delivery",
      sourceId: "worker",
      outcome: "delivered",
      latencyMs: 5,
      waitingCount: 0,
    });
    store.setMode("traffic");
    expect(useSimulationStore.getState()).toMatchObject({
      failedNodeIds: [],
      trafficLog: [],
      trafficCounts: { sent: 0, ok: 0, failed: 0, delivered: 0 },
      waitingMessages: [],
    });
  });
});
