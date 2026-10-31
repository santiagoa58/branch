import { act, cleanup, renderHook } from "@testing-library/react";
import {
  ReactFlowProvider,
  getBezierPath,
  useStoreApi,
  type InternalNode,
  type Node,
  type Rect,
} from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { collaborativeDocs } from "@/templates/catalog/storage";
import { autoLayoutDiagram } from "@/utils/layout";
import { leafSize } from "@/utils/layout/geometry";
import * as edgeLabels from "@/utils/edgeLabels";
import { useEdgeLabelPosition } from "./useEdgeLabelPosition";

let resize: () => void;

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resize = () => callback([], this);
      }
      observe = vi.fn<ResizeObserver["observe"]>();
      unobserve = vi.fn<ResizeObserver["unobserve"]>();
      disconnect = vi.fn<ResizeObserver["disconnect"]>();
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function node(id: string, x: number, y: number, extra: Partial<Node> = {}): Node {
  return { id, position: { x, y }, data: {}, measured: { width: 160, height: 100 }, ...extra };
}

function mount(nodes: Node[], x: number, y: number, hasDecision = false) {
  const result = renderHook(
    () => ({ ...useEdgeLabelPosition(x, y, hasDecision), store: useStoreApi() }),
    {
      wrapper: ({ children }) => (
        <ReactFlowProvider initialNodes={nodes}>{children}</ReactFlowProvider>
      ),
    },
  );
  const label = document.createElement("div");
  Object.defineProperties(label, {
    offsetWidth: { configurable: true, value: 180 },
    offsetHeight: { value: 20 },
  });
  act(() => result.result.current.labelRef(label));
  return { ...result, label };
}

function rect(node: InternalNode): Rect {
  return { ...node.internals.positionAbsolute, ...leafSize(node) };
}

function expectClear(x: number, y: number, obstacles: Rect[], width = 180) {
  expect(
    obstacles.filter(
      (obstacle) =>
        x - width / 2 < obstacle.x + obstacle.width &&
        x + width / 2 > obstacle.x &&
        y - 10 < obstacle.y + obstacle.height &&
        y + 10 > obstacle.y,
    ),
  ).toEqual([]);
}

describe("collision-aware edge labels", () => {
  it("reproduces and fixes the collaborative editor autoformat overlap", () => {
    const edges = structuredClone(collaborativeDocs.data.edges);
    const nodes = autoLayoutDiagram(
      collaborativeDocs.data.nodes.map((entry) =>
        entry.type === "architecture" ? { ...entry, measured: { width: 160, height: 104 } } : entry,
      ),
      edges,
    );
    const snapshot = structuredClone({ nodes, edges });
    const byId = new Map(nodes.map((entry) => [entry.id, entry]));
    const group = byId.get("collab")!;
    const source = byId.get("collab-svc")!;
    const target = byId.get("docs")!;
    const [, midpointX, midpointY] = getBezierPath({
      sourceX: group.position.x + source.position.x + 80,
      sourceY: group.position.y + source.position.y + 104,
      targetX: target.position.x + 80,
      targetY: target.position.y,
    });
    const { result } = mount(nodes, midpointX, midpointY);
    const presence = rect(result.current.store.getState().nodeLookup.get("presence")!);

    expect(midpointX).toBeGreaterThan(presence.x);
    expect(midpointX).toBeLessThan(presence.x + presence.width);
    expect(midpointY).toBeGreaterThan(presence.y);
    expect(midpointY).toBeLessThan(presence.y + presence.height);
    const obstacles = [...result.current.store.getState().nodeLookup.values()]
      .filter((entry) => entry.type !== "group")
      .map(rect);
    expectClear(result.current.labelX, result.current.labelY, obstacles);
    expect({ nodes, edges }).toEqual(snapshot);
  });

  it("reacts when an unrelated node moves over a stationary edge", () => {
    const { result } = mount([node("obstacle", 500, 500)], 100, 150);
    expect({ x: result.current.labelX, y: result.current.labelY }).toEqual({ x: 100, y: 150 });

    act(() => result.current.store.getState().setNodes([node("obstacle", 20, 100)]));

    expectClear(result.current.labelX, result.current.labelY, [
      { x: 20, y: 100, width: 160, height: 100 },
    ]);
    act(() => result.current.store.getState().setNodes([node("obstacle", 500, 500)]));
    expect({ x: result.current.labelX, y: result.current.labelY }).toEqual({ x: 100, y: 150 });
  });

  it("uses measured absolute bounds for nested nodes with a custom origin", () => {
    const { result } = mount(
      [
        node("group", 400, 300, { type: "group", measured: { width: 600, height: 500 } }),
        node("child", 200, 200, { parentId: "group", origin: [0.5, 0.5] }),
      ],
      600,
      500,
    );
    const obstacle = rect(result.current.store.getState().nodeLookup.get("child")!);

    expect(obstacle).toEqual({ x: 520, y: 450, width: 160, height: 100 });
    expectClear(result.current.labelX, result.current.labelY, [obstacle]);
  });

  it("allows labels inside expanded containers but avoids their overhanging headers", () => {
    const nodes = [node("group", 0, 100, { type: "group", measured: { width: 600, height: 500 } })];
    const { result, rerender } = renderHook(({ y }) => useEdgeLabelPosition(300, y), {
      initialProps: { y: 300 },
      wrapper: ({ children }) => (
        <ReactFlowProvider initialNodes={nodes}>{children}</ReactFlowProvider>
      ),
    });
    expect(result.current.labelY).toBe(300);

    rerender({ y: 88 });

    expect(result.current.labelY).not.toBe(88);
  });

  it("ignores hidden descendants and uses the compact collapsed group footprint", () => {
    const { result } = mount(
      [
        node("collapsed", 0, 0, {
          type: "group",
          data: { collapsed: true },
          measured: { width: 2000, height: 1500 },
        }),
        node("hidden", 300, 250, { parentId: "collapsed", hidden: true }),
      ],
      400,
      300,
    );
    expect({ x: result.current.labelX, y: result.current.labelY }).toEqual({ x: 400, y: 300 });

    act(() =>
      result.current.store.getState().setNodes([
        node("collapsed", 300, 250, {
          type: "group",
          data: { collapsed: true },
          measured: { width: 2000, height: 1500 },
        }),
      ]),
    );

    expectClear(result.current.labelX, result.current.labelY, [
      { x: 300, y: 250, width: 240, height: 190 },
    ]);
  });

  it("does not rerun placement for pan, zoom, or selection changes", () => {
    const place = vi.spyOn(edgeLabels, "placeEdgeLabel");
    const { result } = mount([node("obstacle", 20, 100)], 100, 150);
    place.mockClear();

    act(() =>
      result.current.store.setState({ transform: [40, 60, 0.25], nodesSelectionActive: true }),
    );

    expect(place).not.toHaveBeenCalled();
    act(() => result.current.store.getState().setNodes([node("obstacle", 500, 500)]));
    expect(place).toHaveBeenCalled();
    expect(result.current.labelY).toBe(150);
  });

  it("includes the decision badge when avoiding obstacles", () => {
    const { result } = mount(
      [node("obstacle", 20, -35, { measured: { width: 160, height: 10 } })],
      0,
      0,
      true,
    );

    expect(result.current.labelY).toBeGreaterThan(0);
    expect(result.current.labelY - 32).toBeGreaterThanOrEqual(-25);
  });

  it("remeasures changing labels in unzoomed layout units", () => {
    const obstacle = { x: 100, y: 100, width: 160, height: 100 };
    const { result, label } = mount([node("obstacle", 100, 100)], 0, 150);
    expect(result.current.labelX).toBe(0);
    act(() => result.current.store.setState({ transform: [0, 0, 0.25] }));
    expect(result.current.labelX).toBe(0);

    Object.defineProperty(label, "offsetWidth", { value: 280 });
    act(() => resize());

    expectClear(result.current.labelX, result.current.labelY, [obstacle], 280);
    expect(result.current.labelX).not.toBe(0);
  });
});
