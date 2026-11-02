import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { MAX_HISTORY_LENGTH } from "@/constants";
import { diagramDataSchema } from "@/schemas/diagram";
import { cloudWorkspace } from "@/services/cloudWorkspace";
import type { CloudState } from "@/services/cloudPersistence";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useAnimationStore } from "@/store/animationStore";
import { useDiagramStore } from "@/store/diagramStore";
import * as layout from "@/utils/layout";

function createDiagram() {
  return diagramDataSchema.parse({
    nodes: [
      {
        id: "cluster",
        type: "group",
        position: { x: 780, y: 620 },
        data: { label: "Checkout", groupType: "cluster", color: "blue" },
        style: { width: 300, height: 200 },
        width: 300,
        height: 200,
        measured: { width: 300, height: 200 },
      },
      {
        id: "api",
        type: "architecture",
        parentId: "cluster",
        extent: "parent",
        position: { x: 210, y: 170 },
        data: { label: "Checkout API", type: "service", technology: "Node.js" },
        measured: { width: 310, height: 186 },
        selected: true,
      },
      {
        id: "database",
        type: "architecture",
        parentId: "cluster",
        extent: "parent",
        position: { x: 10, y: 15 },
        data: { label: "Orders", type: "database" },
        measured: { width: 240, height: 142 },
      },
      {
        id: "gateway",
        type: "architecture",
        position: { x: -300, y: 900 },
        data: { label: "Public gateway", type: "gateway" },
        measured: { width: 210, height: 154 },
      },
    ],
    edges: [
      {
        id: "request",
        source: "gateway",
        target: "api",
        sourceHandle: "bottom",
        targetHandle: "top",
        type: "architecture",
        data: { protocol: "http", method: "POST", label: "Create order" },
        selected: true,
      },
      {
        id: "query",
        source: "api",
        target: "database",
        type: "architecture",
        data: { protocol: "sql", latencyMs: 12 },
      },
    ],
    flows: [
      {
        id: "checkout",
        name: "Create an order",
        sourceNodeId: "gateway",
        edgeIds: ["request", "query"],
        speed: 1,
        createdAt: "2026-10-30T12:00:00.000Z",
      },
    ],
  });
}

function graphSnapshot() {
  const { nodes, edges } = useDiagramStore.getState();
  return structuredClone({ nodes, edges });
}

let cloud: CloudState;

beforeEach(() => {
  useDiagramStore.setState(useDiagramStore.getInitialState());
  useAnimationStore.setState({ pendingDeletions: new Set() });
  useAiDesignStore.setState(useAiDesignStore.getInitialState());
  cloud = {
    diagram: null,
    status: "saved",
    dirty: false,
    locked: false,
    transitioning: false,
    message: null,
  };
  vi.spyOn(cloudWorkspace, "getState").mockImplementation(() => cloud);
  vi.spyOn(cloudWorkspace, "schedule").mockImplementation(() => {});
  useDiagramStore.getState().hydrateDiagram(createDiagram());
  useDiagramStore.setState({ selectedNodeId: "api", selectedEdgeId: "request" });
});

afterEach(() => {
  vi.restoreAllMocks();
  useDiagramStore.setState(useDiagramStore.getInitialState());
  useAnimationStore.setState({ pendingDeletions: new Set() });
  useAiDesignStore.setState(useAiDesignStore.getInitialState());
});

describe("diagram store auto-format integration", () => {
  it("applies the real layout, preserves edges, flows and selection, and saves once after the edit", () => {
    const before = useDiagramStore.getState();
    const original = graphSnapshot();
    const expectedNodes = layout.autoLayoutDiagram(before.nodes, before.edges);
    const saves: ReturnType<typeof graphSnapshot>[] = [];
    vi.mocked(cloudWorkspace.schedule).mockImplementation(() => {
      saves.push(graphSnapshot());
    });
    const saveHistory = vi.spyOn(before, "saveToHistory");
    const saveDiagram = vi.spyOn(before, "saveDiagram");

    expect(before.applyAutoLayout()).toBe(true);

    const after = useDiagramStore.getState();
    expect(after.nodes).toEqual(expectedNodes);
    expect(after.nodes).not.toEqual(original.nodes);
    expect(before.nodes).toEqual(original.nodes);
    expect(after.edges).toBe(before.edges);
    expect(after.flows).toBe(before.flows);
    expect(after.selectedNodeId).toBe("api");
    expect(after.selectedEdgeId).toBe("request");
    expect(after.nodes.find((node) => node.id === "api")?.selected).toBe(true);
    expect(after.edges.find((edge) => edge.id === "request")?.selected).toBe(true);
    expect(saveHistory).toHaveBeenCalledTimes(1);
    expect(saveDiagram).toHaveBeenCalledTimes(1);
    expect(cloudWorkspace.schedule).toHaveBeenCalledExactlyOnceWith({
      nodes: after.nodes,
      edges: after.edges,
      flows: after.flows,
    });
    expect(saves).toEqual([graphSnapshot()]);
    expect(after.history).toEqual([original, graphSnapshot()]);
    expect(after.historyIndex).toBe(1);
  });

  it("persists measured leaf sizes and resized group dimensions through the diagram schema", () => {
    const original = graphSnapshot();
    useDiagramStore.getState().applyAutoLayout();
    const formatted = useDiagramStore.getState();
    const savedInput = vi.mocked(cloudWorkspace.schedule).mock.calls[0]?.[0];
    const saved = diagramDataSchema.parse(savedInput);
    expect(saved).toEqual(formatted.exportDiagram());
    expect(saved.nodes).toEqual(formatted.nodes);
    expect(saved.edges).toEqual(original.edges);
    expect(saved.flows).toEqual(formatted.flows);

    for (const id of ["api", "database", "gateway"]) {
      expect(saved.nodes.find((node) => node.id === id)?.measured).toEqual(
        original.nodes.find((node) => node.id === id)?.measured,
      );
    }
    const group = saved.nodes.find((node) => node.id === "cluster");
    expect(group?.width).toBeGreaterThan(300);
    expect(group?.height).toBeGreaterThan(200);
    expect(group?.style).toMatchObject({ width: group?.width, height: group?.height });
    expect(group?.measured).toEqual({ width: group?.width, height: group?.height });
    expect(saved.nodes.find((node) => node.id === "api")).toMatchObject({
      parentId: "cluster",
      extent: "parent",
    });
    expect(saved.nodes.findIndex((node) => node.id === "cluster")).toBeLessThan(
      saved.nodes.findIndex((node) => node.id === "api"),
    );

    formatted.hydrateDiagram(saved);
    expect(useDiagramStore.getState().exportDiagram()).toEqual(saved);
    expect(cloudWorkspace.schedule).toHaveBeenCalledTimes(1);
  });

  it("does not add history or save again when the real layout is already formatted", () => {
    useDiagramStore.getState().applyAutoLayout();
    const before = useDiagramStore.getState();
    vi.mocked(cloudWorkspace.schedule).mockClear();
    const saveHistory = vi.spyOn(before, "saveToHistory");
    const snapshot = useDiagramStore.getState();

    expect(snapshot.applyAutoLayout()).toBe(false);

    expect(useDiagramStore.getState()).toBe(snapshot);
    expect(saveHistory).not.toHaveBeenCalled();
    expect(cloudWorkspace.schedule).not.toHaveBeenCalled();
  });

  it.each(["empty", "hydrated", "stale measurements"])(
    "undoes to the exact original and redoes to the exact format with %s history",
    (historyKind) => {
      if (historyKind === "empty") {
        useDiagramStore.setState({ history: [], historyIndex: -1 });
      }
      if (historyKind === "stale measurements") {
        // React Flow measures and drag updates can precede the next history snapshot.
        useDiagramStore.setState((state) => ({
          nodes: state.nodes.map((node) =>
            node.id === "api"
              ? { ...node, position: { x: 181, y: 203 }, measured: { width: 342, height: 198 } }
              : node,
          ),
        }));
      }
      const original = graphSnapshot();
      const { flows, selectedNodeId, selectedEdgeId } = useDiagramStore.getState();
      expect(useDiagramStore.getState().applyAutoLayout()).toBe(true);
      const formatted = graphSnapshot();
      expect(formatted).not.toEqual(original);
      expect(useDiagramStore.getState().canUndo()).toBe(true);
      expect(useDiagramStore.getState().canRedo()).toBe(false);

      useDiagramStore.getState().undo();
      expect(graphSnapshot()).toEqual(original);
      expect(useDiagramStore.getState().canUndo()).toBe(false);
      expect(useDiagramStore.getState().canRedo()).toBe(true);
      expect(cloudWorkspace.schedule).toHaveBeenNthCalledWith(2, { ...original, flows });

      useDiagramStore.getState().redo();
      expect(graphSnapshot()).toEqual(formatted);
      expect(useDiagramStore.getState().canUndo()).toBe(true);
      expect(useDiagramStore.getState().canRedo()).toBe(false);
      expect(cloudWorkspace.schedule).toHaveBeenNthCalledWith(3, { ...formatted, flows });
      expect(useDiagramStore.getState()).toMatchObject({ flows, selectedNodeId, selectedEdgeId });
    },
  );

  it("discards a redo branch without losing older history or the current measured baseline", () => {
    const original = graphSnapshot();
    const older = {
      nodes: original.nodes.map((node) => ({ ...node, position: { x: -901, y: -503 } })),
      edges: original.edges,
    };
    const abandoned = {
      nodes: original.nodes.map((node) => ({ ...node, position: { x: 1901, y: 1503 } })),
      edges: original.edges,
    };
    useDiagramStore.setState({ history: [older, original, abandoned], historyIndex: 1 });
    expect(useDiagramStore.getState().canRedo()).toBe(true);

    useDiagramStore.getState().applyAutoLayout();
    const formatted = graphSnapshot();
    expect(useDiagramStore.getState().history).toEqual([older, original, formatted]);
    expect(useDiagramStore.getState().canRedo()).toBe(false);
    useDiagramStore.getState().undo();
    expect(graphSnapshot()).toEqual(original);
    useDiagramStore.getState().undo();
    expect(graphSnapshot()).toEqual(older);
    useDiagramStore.getState().redo();
    useDiagramStore.getState().redo();
    expect(graphSnapshot()).toEqual(formatted);
  });

  it("keeps a redo branch intact for a no-op", () => {
    useDiagramStore.getState().applyAutoLayout();
    const formatted = graphSnapshot();
    const future = {
      nodes: formatted.nodes.map((node) => ({ ...node, position: { x: 999, y: 999 } })),
      edges: formatted.edges,
    };
    useDiagramStore.setState({ history: [formatted, future], historyIndex: 0 });
    const before = useDiagramStore.getState();
    vi.mocked(cloudWorkspace.schedule).mockClear();

    expect(before.applyAutoLayout()).toBe(false);
    expect(useDiagramStore.getState()).toBe(before);
    expect(useDiagramStore.getState().canRedo()).toBe(true);
    expect(cloudWorkspace.schedule).not.toHaveBeenCalled();
  });

  it("caps history while retaining exact pre-format and post-format snapshots", () => {
    const original = graphSnapshot();
    const history = Array.from({ length: MAX_HISTORY_LENGTH }, (_, index) => ({
      nodes: original.nodes.map((node) => ({ ...node, position: { x: index, y: index } })),
      edges: structuredClone(original.edges),
    }));
    useDiagramStore.setState({ history, historyIndex: history.length - 1 });

    useDiagramStore.getState().applyAutoLayout();
    const formatted = graphSnapshot();
    const after = useDiagramStore.getState();
    expect(after.history).toHaveLength(MAX_HISTORY_LENGTH);
    expect(after.historyIndex).toBe(MAX_HISTORY_LENGTH - 1);
    expect(after.history).toEqual([...history.slice(1, -1), original, formatted]);
    useDiagramStore.getState().undo();
    expect(graphSnapshot()).toEqual(original);
    useDiagramStore.getState().redo();
    expect(graphSnapshot()).toEqual(formatted);
    expect(cloudWorkspace.schedule).toHaveBeenCalledTimes(3);
  });

  it.each(["empty", "locked", "loading", "pending deletion", "an AI run is active"])(
    "does not run layout, mutate history or save when %s",
    (reason) => {
      if (reason === "an AI run is active") {
        useAiDesignStore.getState().start("d1");
      } else if (reason === "empty") {
        useDiagramStore.setState({ nodes: [], edges: [], flows: [] });
      } else if (reason === "locked") {
        cloud = { ...cloud, locked: true };
      } else if (reason === "loading") {
        cloud = { ...cloud, status: "loading" };
      } else {
        useAnimationStore.setState({ pendingDeletions: new Set(["api"]) });
      }
      const runLayout = vi.spyOn(layout, "autoLayoutDiagram");
      const saveHistory = vi.spyOn(useDiagramStore.getState(), "saveToHistory");
      const saveDiagram = vi.spyOn(useDiagramStore.getState(), "saveDiagram");
      const before = useDiagramStore.getState();
      const original = graphSnapshot();

      expect(before.applyAutoLayout()).toBe(false);
      expect(useDiagramStore.getState()).toBe(before);
      expect(graphSnapshot()).toEqual(original);
      expect(useDiagramStore.getState().history).toBe(before.history);
      expect(runLayout).not.toHaveBeenCalled();
      expect(saveHistory).not.toHaveBeenCalled();
      expect(saveDiagram).not.toHaveBeenCalled();
      expect(cloudWorkspace.schedule).not.toHaveBeenCalled();
    },
  );

  it("formats again once the AI run has finished", () => {
    useAiDesignStore.getState().start("d1");
    useAiDesignStore.getState().finish();

    expect(useDiagramStore.getState().applyAutoLayout()).toBe(true);
    expect(useDiagramStore.getState().historyIndex).toBe(1);
    expect(cloudWorkspace.schedule).toHaveBeenCalledTimes(1);
  });

  it("propagates an algorithm error before any history mutation or save", () => {
    const failure = new Error("Layout could not be computed");
    vi.spyOn(layout, "autoLayoutDiagram").mockImplementationOnce(() => {
      throw failure;
    });
    const saveHistory = vi.spyOn(useDiagramStore.getState(), "saveToHistory");
    const before = useDiagramStore.getState();
    const original = graphSnapshot();

    expect(() => before.applyAutoLayout()).toThrow(failure);
    expect(useDiagramStore.getState()).toBe(before);
    expect(graphSnapshot()).toEqual(original);
    expect(saveHistory).not.toHaveBeenCalled();
    expect(cloudWorkspace.schedule).not.toHaveBeenCalled();
  });
});
