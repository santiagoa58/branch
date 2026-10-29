import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useDiagramStore } from "./diagramStore";

describe("diagram store validation", () => {
  beforeEach(() => {
    useDiagramStore.getState().resetDiagramState();
    vi.spyOn(localStorage, "setItem").mockClear();
  });

  afterEach(() => useDiagramStore.getState().resetDiagramState());

  it("rejects an invalid import before changing state or history", () => {
    const before = useDiagramStore.getState();
    const invalid = { nodes: [{ id: "bad" }], edges: [] };
    // JavaScript callers and browser data are not protected by TypeScript.
    expect(() => before.importDiagram(invalid)).toThrow(/nodes/);
    expect(useDiagramStore.getState().nodes).toEqual([]);
    expect(useDiagramStore.getState().history).toEqual([]);
    expect(vi.spyOn(localStorage, "setItem")).not.toHaveBeenCalled();
  });

  it("persists clearing optional node data without keeping undefined properties", () => {
    useDiagramStore.setState({
      nodes: [
        {
          id: "s",
          type: "architecture",
          position: { x: 0, y: 0 },
          data: { label: "API", type: "service", description: "Old" },
        },
      ],
    });
    useDiagramStore.getState().updateNodeData("s", { description: undefined });
    expect(() => useDiagramStore.getState().saveDiagram()).not.toThrow();
    expect(useDiagramStore.getState().nodes[0]?.data).not.toHaveProperty("description");
  });
});
