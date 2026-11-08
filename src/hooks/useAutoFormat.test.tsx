import { act, cleanup, renderHook } from "@testing-library/react";
import type { FitView } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vite-plus/test";
import { diagramDataSchema } from "@/schemas/diagram";
import { cloudWorkspace } from "@/services/cloudWorkspace";
import type { CloudState } from "@/services/cloudPersistence";
import { notify } from "@/services/notify";
import { useAnimationStore } from "@/store/animationStore";
import { useDiagramStore, type DiagramStore } from "@/store/diagramStore";
import * as layout from "@/utils/layout";
import { useAutoFormat } from "./useAutoFormat";

const { fitView } = vi.hoisted(() => ({ fitView: vi.fn<FitView>() }));

vi.mock("@xyflow/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@xyflow/react")>()),
  useReactFlow: () => ({ fitView }),
}));

let cloud: CloudState;
let applyLayout: MockInstance<DiagramStore["applyAutoLayout"]>;

/** Wait for every auto-format the hook started; the hook's own continuation runs first. */
async function settle() {
  await act(async () => {
    await Promise.allSettled(applyLayout.mock.results.map((result): unknown => result.value));
  });
}
let reducedMotion: boolean;
let nextFrameId: number;
let frames: Map<number, FrameRequestCallback>;

// A browser frame runs only the callbacks queued before that frame began.
function stepFrame() {
  act(() => {
    const callbacks = [...frames.values()];
    frames.clear();
    for (const callback of callbacks) {
      callback(16);
    }
  });
}

beforeEach(() => {
  useDiagramStore.setState(useDiagramStore.getInitialState());
  useAnimationStore.setState({ pendingDeletions: new Set() });
  const data = diagramDataSchema.parse({
    nodes: [
      {
        id: "api",
        type: "architecture",
        position: { x: 870, y: 640 },
        data: { label: "Checkout API", type: "service" },
        selected: true,
        measured: { width: 240, height: 156 },
      },
      {
        id: "database",
        type: "architecture",
        position: { x: -200, y: -400 },
        data: { label: "Orders", type: "database" },
        measured: { width: 210, height: 140 },
      },
    ],
    edges: [{ id: "query", source: "api", target: "database", data: { protocol: "sql" } }],
    flows: [],
  });
  cloud = {
    diagram: {
      id: "checkout",
      projectId: "commerce",
      name: "Checkout",
      description: null,
      thumbnail: null,
      data,
      revision: 1,
      version: 0,
      createdAt: "2026-10-30T12:00:00.000Z",
      updatedAt: "2026-10-30T12:00:00.000Z",
    },
    status: "saved",
    dirty: false,
    locked: false,
    transitioning: false,
    message: null,
  };
  vi.spyOn(cloudWorkspace, "getState").mockImplementation(() => cloud);
  vi.spyOn(cloudWorkspace, "schedule").mockImplementation(() => {});
  vi.spyOn(notify, "error").mockReturnValue("format-error");
  useDiagramStore.getState().hydrateDiagram(data);
  applyLayout = vi.spyOn(useDiagramStore.getState(), "applyAutoLayout");
  fitView.mockReset().mockResolvedValue(true);

  reducedMotion = false;
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    media: query,
    matches: reducedMotion,
    onchange: null,
    addListener: vi.fn<MediaQueryList["addListener"]>(),
    removeListener: vi.fn<MediaQueryList["removeListener"]>(),
    addEventListener: vi.fn<MediaQueryList["addEventListener"]>(),
    removeEventListener: vi.fn<MediaQueryList["removeEventListener"]>(),
    dispatchEvent: vi.fn<MediaQueryList["dispatchEvent"]>().mockReturnValue(false),
  }));
  frames = new Map();
  nextFrameId = 0;
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn<typeof requestAnimationFrame>((callback) => {
      const id = ++nextFrameId;
      frames.set(id, callback);
      return id;
    }),
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn<typeof cancelAnimationFrame>((id) => {
      frames.delete(id);
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useDiagramStore.setState(useDiagramStore.getInitialState());
  useAnimationStore.setState({ pendingDeletions: new Set() });
});

describe("useAutoFormat", () => {
  it("formats, then waits for two animation frames before fitting the saved layout", async () => {
    const original = structuredClone(useDiagramStore.getState().nodes);
    const { result } = renderHook(() => useAutoFormat());
    expect(result.current.disabled).toBe(false);

    act(() => result.current.autoFormat());

    await settle();

    expect(applyLayout).toHaveBeenCalledExactlyOnceWith();
    expect(useDiagramStore.getState().nodes).not.toEqual(original);
    expect(cloudWorkspace.schedule).toHaveBeenCalledTimes(1);
    expect(fitView).not.toHaveBeenCalled();
    expect(frames.size).toBe(1);
    stepFrame();
    expect(fitView).not.toHaveBeenCalled();
    expect(frames.size).toBe(1);
    stepFrame();
    expect(fitView).toHaveBeenCalledExactlyOnceWith({ padding: 0.2, maxZoom: 1, duration: 300 });
    expect(frames.size).toBe(0);
    expect(notify.error).not.toHaveBeenCalled();
  });

  it("fits an already formatted diagram without adding another save or history entry", async () => {
    await useDiagramStore.getState().applyAutoLayout();
    applyLayout.mockClear();
    vi.mocked(cloudWorkspace.schedule).mockClear();
    const before = useDiagramStore.getState();
    const { result } = renderHook(() => useAutoFormat());

    act(() => result.current.autoFormat());

    await settle();
    stepFrame();
    stepFrame();

    expect(useDiagramStore.getState()).toBe(before);
    expect(cloudWorkspace.schedule).not.toHaveBeenCalled();
    expect(fitView).toHaveBeenCalledExactlyOnceWith({ padding: 0.2, maxZoom: 1, duration: 300 });
  });

  it("honors reduced motion when fitting", async () => {
    reducedMotion = true;
    const { result } = renderHook(() => useAutoFormat());
    act(() => result.current.autoFormat());
    await settle();
    stepFrame();
    stepFrame();
    expect(window.matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    expect(fitView).toHaveBeenCalledExactlyOnceWith({ padding: 0.2, maxZoom: 1, duration: 0 });
  });

  it.each(["empty", "locked", "loading", "pending deletion"])(
    "disables the command and blocks direct invocation when %s",
    async (reason) => {
      if (reason === "empty") {
        useDiagramStore.setState({ nodes: [], edges: [] });
      } else if (reason === "locked") {
        cloud = { ...cloud, locked: true };
      } else if (reason === "loading") {
        cloud = { ...cloud, status: "loading" };
      } else {
        useAnimationStore.setState({ pendingDeletions: new Set(["api"]) });
      }
      const before = useDiagramStore.getState();
      const { result } = renderHook(() => useAutoFormat());
      expect(result.current.disabled).toBe(true);

      act(() => result.current.autoFormat());

      await settle();
      stepFrame();
      stepFrame();

      expect(applyLayout).not.toHaveBeenCalled();
      expect(useDiagramStore.getState()).toBe(before);
      expect(cloudWorkspace.schedule).not.toHaveBeenCalled();
      expect(requestAnimationFrame).not.toHaveBeenCalled();
      expect(fitView).not.toHaveBeenCalled();
      expect(notify.error).not.toHaveBeenCalled();
    },
  );

  it("updates disabled as nodes, cloud state and pending deletions change", async () => {
    const { result, rerender } = renderHook(() => useAutoFormat());
    const nodes = useDiagramStore.getState().nodes;
    expect(result.current.disabled).toBe(false);
    act(() => useDiagramStore.setState({ nodes: [] }));
    expect(result.current.disabled).toBe(true);
    act(() => useDiagramStore.setState({ nodes }));
    expect(result.current.disabled).toBe(false);
    act(() => useAnimationStore.setState({ pendingDeletions: new Set(["api"]) }));
    expect(result.current.disabled).toBe(true);
    act(() => useAnimationStore.setState({ pendingDeletions: new Set() }));
    expect(result.current.disabled).toBe(false);
    cloud = { ...cloud, locked: true };
    rerender();
    expect(result.current.disabled).toBe(true);
    cloud = { ...cloud, locked: false, status: "loading" };
    rerender();
    expect(result.current.disabled).toBe(true);
    cloud = { ...cloud, status: "saved" };
    rerender();
    expect(result.current.disabled).toBe(false);
  });

  it("checks current guards even when invoked through a callback captured before the lock", async () => {
    const { result } = renderHook(() => useAutoFormat());
    const command = result.current.autoFormat;
    cloud = { ...cloud, locked: true };

    act(() => command());

    await settle();

    expect(applyLayout).not.toHaveBeenCalled();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(cloudWorkspace.schedule).not.toHaveBeenCalled();
  });

  it.each([0, 1])("cancels the pending frame on unmount after %i frames", async (elapsedFrames) => {
    const { result, unmount } = renderHook(() => useAutoFormat());
    act(() => result.current.autoFormat());
    await settle();
    if (elapsedFrames === 1) {
      stepFrame();
    }
    const pendingId = [...frames.keys()][0];

    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalledExactlyOnceWith(pendingId);
    expect(frames.size).toBe(0);
    stepFrame();
    stepFrame();
    expect(fitView).not.toHaveBeenCalled();
  });

  it.each([0, 1])(
    "replaces the pending fit on reinvocation after %i frames",
    async (elapsedFrames) => {
      const { result } = renderHook(() => useAutoFormat());
      act(() => result.current.autoFormat());
      await settle();
      if (elapsedFrames === 1) {
        stepFrame();
      }
      const pendingId = [...frames.keys()][0];
      act(() => result.current.autoFormat());
      await settle();

      expect(cancelAnimationFrame).toHaveBeenCalledExactlyOnceWith(pendingId);
      expect(frames.size).toBe(1);
      stepFrame();
      expect(fitView).not.toHaveBeenCalled();
      stepFrame();
      expect(fitView).toHaveBeenCalledTimes(1);
      expect(cloudWorkspace.schedule).toHaveBeenCalledTimes(1);
    },
  );

  it("does not fit or report anything when the editor unmounts while the layout runs", async () => {
    vi.spyOn(layout, "autoLayoutDiagram").mockRejectedValueOnce(new Error("Cannot compute layout"));
    const first = renderHook(() => useAutoFormat());
    act(() => first.result.current.autoFormat());
    first.unmount();
    await settle();
    expect(notify.error).not.toHaveBeenCalled();

    const second = renderHook(() => useAutoFormat());
    act(() => second.result.current.autoFormat());
    second.unmount();
    await settle();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    stepFrame();
    stepFrame();
    expect(fitView).not.toHaveBeenCalled();
  });

  it("fits once for two quick requests, after the later one finishes", async () => {
    const { result } = renderHook(() => useAutoFormat());
    act(() => {
      result.current.autoFormat();
      result.current.autoFormat();
    });
    await settle();

    expect(applyLayout).toHaveBeenCalledTimes(2);
    expect(cloudWorkspace.schedule).toHaveBeenCalledTimes(1);
    expect(useDiagramStore.getState().historyIndex).toBe(1);
    expect(frames.size).toBe(1);
    stepFrame();
    stepFrame();
    expect(fitView).toHaveBeenCalledTimes(1);
  });

  it("cancels a previous pending fit when a reinvoked layout fails", async () => {
    const { result } = renderHook(() => useAutoFormat());
    act(() => result.current.autoFormat());
    await settle();
    stepFrame();
    const formatted = useDiagramStore.getState();
    vi.spyOn(layout, "autoLayoutDiagram").mockImplementationOnce(() => {
      throw new Error("Cannot recompute layout");
    });

    act(() => result.current.autoFormat());

    await settle();
    stepFrame();

    expect(notify.error).toHaveBeenCalledExactlyOnceWith({
      title: "Could not format the diagram",
      message: "Your previous layout is unchanged.",
    });
    expect(useDiagramStore.getState()).toBe(formatted);
    expect(cloudWorkspace.schedule).toHaveBeenCalledTimes(1);
    expect(fitView).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });

  it.each(["switch", "clear", "lock", "loading"])(
    "does not fit when the active document changes before fitting: %s",
    async (change) => {
      const { result } = renderHook(() => useAutoFormat());
      act(() => result.current.autoFormat());
      await settle();
      stepFrame();
      if (change === "switch") {
        const diagram = cloud.diagram;
        if (!diagram) {
          throw new Error("Expected an active diagram");
        }
        cloud = { ...cloud, diagram: { ...diagram, id: "inventory" } };
      } else if (change === "clear") {
        cloud = { ...cloud, diagram: null };
      } else if (change === "lock") {
        cloud = { ...cloud, locked: true };
      } else {
        cloud = { ...cloud, status: "loading" };
      }

      stepFrame();

      expect(fitView).not.toHaveBeenCalled();
      expect(frames.size).toBe(0);
      expect(cloudWorkspace.schedule).toHaveBeenCalledTimes(1);
      expect(notify.error).not.toHaveBeenCalled();
    },
  );

  it("does not suppress a fit just because the same diagram revision changes while saving", async () => {
    const { result } = renderHook(() => useAutoFormat());
    act(() => result.current.autoFormat());
    await settle();
    stepFrame();
    const diagram = cloud.diagram;
    if (!diagram) {
      throw new Error("Expected an active diagram");
    }
    cloud = { ...cloud, diagram: { ...diagram, revision: 2 }, status: "saving" };
    stepFrame();
    expect(fitView).toHaveBeenCalledTimes(1);
  });

  it("reports algorithm errors without changing the diagram, history or save queue", async () => {
    vi.spyOn(layout, "autoLayoutDiagram").mockImplementationOnce(() => {
      throw new Error("Cannot compute layout");
    });
    const before = useDiagramStore.getState();
    const original = structuredClone({ nodes: before.nodes, edges: before.edges });
    const { result } = renderHook(() => useAutoFormat());

    expect(() => act(() => result.current.autoFormat())).not.toThrow();
    await settle();

    expect(useDiagramStore.getState()).toBe(before);
    expect({ nodes: before.nodes, edges: before.edges }).toEqual(original);
    expect(cloudWorkspace.schedule).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledExactlyOnceWith({
      title: "Could not format the diagram",
      message: "Your previous layout is unchanged.",
    });
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(fitView).not.toHaveBeenCalled();
  });

  it("reports fit failures without rolling back or resaving the formatted diagram", async () => {
    fitView.mockRejectedValueOnce(new Error("Viewport unavailable"));
    const { result } = renderHook(() => useAutoFormat());
    act(() => result.current.autoFormat());
    await settle();
    const formatted = useDiagramStore.getState();
    stepFrame();
    stepFrame();
    await act(async () => {
      await Promise.resolve();
    });

    expect(useDiagramStore.getState()).toBe(formatted);
    expect(cloudWorkspace.schedule).toHaveBeenCalledTimes(1);
    expect(notify.error).toHaveBeenCalledExactlyOnceWith({
      title: "Could not fit the diagram in view",
      message: "The layout is formatted. Use Fit view to center it.",
    });
  });
});
