import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from "vite-plus/test";
import type { Node } from "@xyflow/react";
import { useDiagramStore } from "@/store/diagramStore";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { cloudWorkspace } from "@/services/cloudWorkspace";
import type { DesignBrief } from "@/schemas/aiDesign";

function makeBrief(prompt: string): DesignBrief {
  return {
    inputs: { prompt, scope: "fullstack", requirements: [], outOfScope: [], answers: [] },
    questions: [],
    requirements: [],
    assumptions: [],
    outOfScope: [],
    ranFrom: {},
  };
}

const briefA = makeBrief("A");
const briefB = makeBrief("B");
const briefC = makeBrief("C");

function node(id: string): Node {
  return {
    id,
    type: "architecture",
    position: { x: 0, y: 0 },
    data: { label: id, type: "service" },
  };
}

function hydrate(extra: { brief?: DesignBrief } = {}) {
  useDiagramStore.getState().hydrateDiagram({ nodes: [], edges: [], ...extra });
}

let schedule: MockInstance<typeof cloudWorkspace.schedule>;

beforeEach(() => {
  useAiDesignStore.getState().cancel();
  useAiDesignStore.setState({ runId: 0 });
  useDiagramStore.getState().resetDiagramState();
  schedule = vi.spyOn(cloudWorkspace, "schedule").mockImplementation(() => {});
});

afterEach(() => {
  useAiDesignStore.getState().cancel();
  schedule.mockRestore();
});

describe("diagramStore brief", () => {
  it("saves the brief with the diagram", () => {
    useDiagramStore.getState().hydrateDiagram({ nodes: [], edges: [], brief: briefA });
    useDiagramStore.getState().saveDiagram();
    expect(schedule).toHaveBeenCalledWith(expect.objectContaining({ brief: briefA }));
  });

  it("omits the brief from saves when there is none", () => {
    hydrate();
    useDiagramStore.getState().saveDiagram();
    expect(useDiagramStore.getState().brief).toBeNull();
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(schedule.mock.calls[0]?.[0]).not.toHaveProperty("brief");
  });

  it("round trips the brief through export and import", () => {
    hydrate({ brief: briefA });
    const exported = useDiagramStore.getState().exportDiagram();
    expect(exported.brief).toEqual(briefA);
    useDiagramStore.getState().resetDiagramState();
    useDiagramStore.getState().importDiagram(exported);
    expect(useDiagramStore.getState().brief).toEqual(briefA);
  });

  it("undo restores the previous brief", () => {
    hydrate({ brief: briefA });
    useDiagramStore.getState().updateBrief(() => briefB);
    expect(useDiagramStore.getState().brief).toEqual(briefB);
    useDiagramStore.getState().undo();
    expect(useDiagramStore.getState().brief).toEqual(briefA);
    useDiagramStore.getState().redo();
    expect(useDiagramStore.getState().brief).toEqual(briefB);
  });

  it("ignores user edits while an AI run is in progress", () => {
    hydrate({ brief: briefA });
    useAiDesignStore.getState().start("d1");
    useDiagramStore.getState().addNode(node("x"));
    useDiagramStore.getState().updateBrief(() => briefB);
    expect(useDiagramStore.getState().nodes).toEqual([]);
    expect(useDiagramStore.getState().brief).toEqual(briefA);
  });

  it("applies AI results during a run, as one undo step, and saves each apply", () => {
    hydrate({ brief: briefA });
    useAiDesignStore.getState().start("d1");
    useDiagramStore.getState().applyAiResult({ nodes: [node("x")], edges: [], brief: briefB });
    useDiagramStore
      .getState()
      .applyAiResult({ nodes: [node("x"), node("y")], edges: [], brief: briefC });
    expect(useDiagramStore.getState().nodes).toHaveLength(2);
    useAiDesignStore.getState().finish();
    useDiagramStore.getState().undo();
    expect(useDiagramStore.getState().nodes).toEqual([]);
    expect(useDiagramStore.getState().brief).toEqual(briefA);
    expect(schedule).toHaveBeenCalledTimes(3);
  });

  it("starts a new undo step for each run", () => {
    hydrate({ brief: briefA });
    useAiDesignStore.getState().start("d1");
    useDiagramStore.getState().applyAiResult({ nodes: [node("x")], edges: [], brief: briefB });
    useAiDesignStore.getState().finish();
    useAiDesignStore.getState().start("d1");
    useDiagramStore
      .getState()
      .applyAiResult({ nodes: [node("x"), node("y")], edges: [], brief: briefC });
    useAiDesignStore.getState().finish();

    useDiagramStore.getState().undo();
    expect(useDiagramStore.getState().nodes).toHaveLength(1);
    expect(useDiagramStore.getState().brief).toEqual(briefB);
    useDiagramStore.getState().undo();
    expect(useDiagramStore.getState().nodes).toEqual([]);
    expect(useDiagramStore.getState().brief).toEqual(briefA);
    expect(useDiagramStore.getState().canUndo()).toBe(false);
  });

  it("keeps the current graph and flows when an AI result omits them", () => {
    hydrate({ brief: briefA });
    const flow = {
      id: "f1",
      name: "Flow",
      sourceNodeId: "x",
      createdAt: "2026-11-01T00:00:00.000Z",
    };
    useDiagramStore.setState({ nodes: [node("x")], flows: [flow] });
    useAiDesignStore.getState().start("d1");
    useDiagramStore.getState().applyAiResult({ brief: briefB });
    expect(useDiagramStore.getState().brief).toEqual(briefB);
    expect(useDiagramStore.getState().nodes).toHaveLength(1);
    expect(useDiagramStore.getState().flows).toEqual([flow]);
  });

  it("keeps the brief when auto layout rewrites history", () => {
    hydrate({ brief: briefA });
    useDiagramStore.setState({
      nodes: [node("x"), { ...node("y"), position: { x: 0, y: 0 } }],
      edges: [{ id: "e", source: "x", target: "y" }],
    });
    expect(useDiagramStore.getState().applyAutoLayout()).toBe(true);
    useDiagramStore.getState().undo();
    useDiagramStore.getState().redo();
    expect(useDiagramStore.getState().brief).toEqual(briefA);
  });

  it("clearDiagram clears the brief, saves, and stays undoable", () => {
    hydrate({ brief: briefA });
    useDiagramStore.getState().clearDiagram();
    expect(useDiagramStore.getState().brief).toBeNull();
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(schedule.mock.calls[0]?.[0]).not.toHaveProperty("brief");
    useDiagramStore.getState().undo();
    expect(useDiagramStore.getState().brief).toEqual(briefA);
    useDiagramStore.getState().redo();
    expect(useDiagramStore.getState().brief).toBeNull();
  });

  it("ignores an AI result that arrives when no run is in progress", () => {
    hydrate({ brief: briefA });
    useAiDesignStore.getState().start("d1");
    useDiagramStore.getState().applyAiResult({ nodes: [node("x")], edges: [], brief: briefB });
    useAiDesignStore.getState().finish();
    schedule.mockClear();

    useDiagramStore
      .getState()
      .applyAiResult({ nodes: [node("x"), node("y")], edges: [], brief: briefC });

    expect(useDiagramStore.getState().nodes).toHaveLength(1);
    expect(useDiagramStore.getState().brief).toEqual(briefB);
    expect(schedule).not.toHaveBeenCalled();
    // The run's single undo step still returns to the pre-run state.
    useDiagramStore.getState().undo();
    expect(useDiagramStore.getState().nodes).toEqual([]);
    expect(useDiagramStore.getState().brief).toEqual(briefA);
  });

  it("lets React Flow dimension changes through during a run, and blocks other changes", () => {
    hydrate();
    useDiagramStore.setState({ nodes: [node("x")] });
    useAiDesignStore.getState().start("d1");

    useDiagramStore.getState().onNodesChange([
      { id: "x", type: "dimensions", dimensions: { width: 120, height: 60 } },
      { id: "x", type: "position", position: { x: 50, y: 50 }, dragging: false },
      { id: "x", type: "remove" },
    ]);

    const [after] = useDiagramStore.getState().nodes;
    expect(after?.measured).toEqual({ width: 120, height: 60 });
    expect(after?.position).toEqual({ x: 0, y: 0 });
    expect(useDiagramStore.getState().nodes).toHaveLength(1);
  });

  it("still blocks dimension changes while the cloud workspace is locked", () => {
    useDiagramStore.setState({ nodes: [node("x")] });
    useAiDesignStore.getState().start("d1");
    const lock = vi.spyOn(cloudWorkspace, "getState").mockReturnValue({
      ...cloudWorkspace.getState(),
      locked: true,
    });
    try {
      useDiagramStore
        .getState()
        .onNodesChange([{ id: "x", type: "dimensions", dimensions: { width: 1, height: 1 } }]);
    } finally {
      lock.mockRestore();
    }
    expect(useDiagramStore.getState().nodes[0]?.measured).toBeUndefined();
  });

  it("imports JSON with an invalid brief as an error", () => {
    expect(() =>
      useDiagramStore.getState().importDiagram({ nodes: [], edges: [], brief: { inputs: 1 } }),
    ).toThrow(/inputs/);
  });
});
