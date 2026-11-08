import { act, cleanup, render, renderHook } from "@testing-library/react";
import { Position, ReactFlowProvider } from "@xyflow/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ArchitectureEdge } from "@/components/edges/ArchitectureEdge";
import { RollupEdge } from "@/components/edges/RollupEdge";
import { gsap } from "@/lib/gsap";
import { useDiagramStore } from "@/store/diagramStore";
import { useSimulationStore } from "@/store/simulationStore";
import { traceFlowPath } from "@/utils/graphTraversal";
import { computeStepDuration, getEdgePath, useSimulationAnimation } from "./useSimulationAnimation";

vi.mock("@/hooks/useEdgeAnimation", () => ({
  useEdgeAnimation: () => ({
    containerRef: { current: null },
    dashPathRef: { current: null },
    dotInnerRef: { current: null },
    dotOuterRef: { current: null },
  }),
}));

const props = {
  id: "payload-path",
  source: "client",
  target: "server",
  sourceX: 100,
  sourceY: 200,
  targetX: 400,
  targetY: 300,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  selected: false,
  selectable: true,
  deletable: true,
};

afterEach(() => {
  cleanup();
  useSimulationStore.getState().reset();
  Reflect.deleteProperty(SVGElement.prototype, "getCTM");
  Reflect.deleteProperty(SVGElement.prototype, "getBBox");
});

describe("causal trace animation", () => {
  it("shows a fast Redis response while a slower independent call is still travelling", () => {
    // jsdom has no SVG geometry API; keep the actual GSAP scheduler and motion
    // plugin, with a fixed straight-line coordinate system for this fixture.
    Object.defineProperty(SVGElement.prototype, "getCTM", {
      configurable: true,
      value: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    });
    Object.defineProperty(SVGElement.prototype, "getBBox", {
      configurable: true,
      value: () => ({ x: 0, y: 0, width: 100, height: 1 }),
    });
    const nodes = [
      {
        id: "collab",
        type: "architecture",
        position: { x: 0, y: 0 },
        data: { type: "service", label: "Collab" },
      },
      {
        id: "redis",
        type: "architecture",
        position: { x: 0, y: 0 },
        data: { type: "cache", label: "Redis" },
      },
      {
        id: "db",
        type: "architecture",
        position: { x: 0, y: 0 },
        data: { type: "database", label: "DB" },
      },
    ];
    const edges = [
      { id: "fast", source: "collab", target: "redis", data: { protocol: "redis", latencyMs: 2 } },
      { id: "slow", source: "collab", target: "db", data: { protocol: "sql", latencyMs: 1000 } },
    ];
    useDiagramStore.setState({ nodes, edges });
    useSimulationStore.getState().setMode("flow");
    useSimulationStore
      .getState()
      .startFlowSimulation("collab", traceFlowPath(nodes, edges, "collab"));
    useSimulationStore.setState({ roundTripEnabled: true });
    const { container } = render(
      <div className="react-flow__edges">
        <svg>
          {edges.map((edge) => (
            <g key={edge.id} data-edge-id={edge.id}>
              <path className="react-flow__edge-path" d="M0 0L100 0" />
            </g>
          ))}
        </svg>
      </div>,
    );
    for (const path of container.querySelectorAll("path")) {
      path.getTotalLength = () => 100;
      path.getPointAtLength = (length) => ({ x: length, y: 0 }) as DOMPoint;
    }
    renderHook(() => useSimulationAnimation());
    const timeline = gsap.globalTimeline
      .getChildren()
      .find((item) => "repeat" in item && item.repeat() === -1);
    if (!(timeline instanceof gsap.core.Timeline)) {
      throw new TypeError("Trace did not create a timeline");
    }
    timeline.pause();
    const returns = timeline.getChildren().filter((item) => {
      const motion: unknown = item.vars["motionPath"];
      return (
        typeof motion === "object" && motion !== null && "start" in motion && motion.start === 1
      );
    });
    // A real response tween must start during the first visual second, while
    // the slower independent outgoing request takes more than two seconds.
    expect(Math.min(...returns.map((item) => item.startTime()))).toBeLessThan(1);
    expect(useSimulationStore.getState().stats?.roundTripLatencyMs).toBe(2000);
    act(() => useSimulationStore.getState().toggleRoundTrip());
    const forwardOnly = gsap.globalTimeline
      .getChildren()
      .find((item) => "repeat" in item && item.repeat() === -1);
    if (!(forwardOnly instanceof gsap.core.Timeline)) {
      throw new TypeError("Trace did not create a forward-only timeline");
    }
    const lastForwardArrival = forwardOnly
      .getChildren()
      .filter((item) => item.vars["motionPath"] !== undefined)
      .reduce((end, item) => Math.max(end, item.startTime() + item.duration()), 0);
    expect(forwardOnly.duration()).toBeCloseTo(lastForwardArrival, 5);
  });

  it("keeps visually distinct timings for fast cache and service interactions", () => {
    expect(computeStepDuration(2)).toBeLessThan(computeStepDuration(20));
    expect(computeStepDuration(0)).toBeLessThan(computeStepDuration(2));
  });
});

describe("step trace cleanup", () => {
  it.each(["stop", "idle", "traffic", "failure", "chaos", "continuous", "unmount"] as const)(
    "removes node highlights and pending tweens when leaving through %s",
    (exit) => {
      const nodes = ["source", "visited"].map((id) => ({
        id,
        type: "architecture",
        position: { x: 0, y: 0 },
        data: { type: "service", label: id },
      }));
      const edges = [
        { id: "call", source: "source", target: "visited", data: { protocol: "http" } },
      ];
      useDiagramStore.setState({ nodes, edges });
      useSimulationStore.getState().setMode("flow");
      useSimulationStore.getState().setSteppingMode(true);
      useSimulationStore
        .getState()
        .startFlowSimulation("source", traceFlowPath(nodes, edges, "source"));
      const { container } = render(
        <div>
          <div data-node-id="source" />
          <div data-node-id="visited" />
        </div>,
      );
      const hook = renderHook(() => useSimulationAnimation());
      const elements = [...container.querySelectorAll<HTMLElement>("[data-node-id]")];
      // Leave while the actual GSAP highlight tweens are still in progress.
      for (const tween of gsap.getTweensOf(elements)) {
        tween.progress(0.5);
      }
      expect(elements.every((element) => element.style.boxShadow !== "")).toBe(true);
      act(() => {
        if (exit === "unmount") {
          hook.unmount();
        } else if (exit === "continuous") {
          useSimulationStore.getState().setSteppingMode(false);
        } else if (exit === "stop") {
          useSimulationStore.getState().stop();
        } else {
          useSimulationStore.getState().setMode(exit);
        }
      });
      for (const tween of gsap.getTweensOf(elements)) {
        tween.progress(1);
      }
      for (const element of elements) {
        expect(element.style.boxShadow).toBe("");
        expect(element.style.opacity).toBe("");
        expect(element.style.filter).toBe("");
      }
      expect(container.querySelector(".simulation-step-badge")).toBeNull();
      expect(gsap.getTweensOf(elements)).toHaveLength(0);
    },
  );
});

describe("simulation connection path lookup", () => {
  it.each([false, true])(
    "follows the real connection instead of its arrowhead or glow (bidirectional: %s)",
    (bidirectional) => {
      const { container } = render(
        <ReactFlowProvider>
          <svg>
            <ArchitectureEdge {...props} data={{ bidirectional, connectionFocus: "highlighted" }} />
          </svg>
        </ReactFlowProvider>,
      );
      const path = getEdgePath(props.id);
      expect(path).toHaveClass("react-flow__edge-path");
      expect(path?.getAttribute("d")).toBe(
        container.querySelector(".react-flow__edge-path")?.getAttribute("d"),
      );
      expect(path?.closest("marker")).toBeNull();
    },
  );

  it("follows a collapsed group's connection instead of its count marker", () => {
    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <RollupEdge {...props} data={{ count: 2 }} />
        </svg>
      </ReactFlowProvider>,
    );
    expect(getEdgePath(props.id)).toHaveClass("react-flow__edge-path");
    expect(getEdgePath(props.id)?.getAttribute("d")).toBe(
      container.querySelector(".react-flow__edge-path")?.getAttribute("d"),
    );
  });

  it("supports short straight connections without guessing from path length", () => {
    const { container } = render(
      <svg>
        <g data-edge-id={props.id}>
          <path className="react-flow__edge-path" d="M0 0L1 1" />
        </g>
      </svg>,
    );
    expect(getEdgePath(props.id)).toBe(container.querySelector(".react-flow__edge-path"));
  });

  it("returns no path for a missing connection or a group containing only decorations", () => {
    render(
      <svg>
        <g data-edge-id={props.id}>
          <defs>
            <marker id="arrow">
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          </defs>
        </g>
      </svg>,
    );
    expect(getEdgePath("missing")).toBeNull();
    expect(getEdgePath(props.id)).toBeNull();
  });
});
