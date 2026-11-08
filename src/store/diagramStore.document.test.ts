import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from "vite-plus/test";
import type { Edge, Node } from "@xyflow/react";
import { documentOf, useDiagramStore } from "@/store/diagramStore";
import { cloudWorkspace } from "@/services/cloudWorkspace";
import type { DesignBrief } from "@/schemas/aiDesign";
import type { NamedFlow } from "@/types/simulation";

const brief: DesignBrief = {
  inputs: { prompt: "A", scope: "fullstack", requirements: [], outOfScope: [], answers: [] },
  questions: [],
  requirements: [],
  assumptions: [],
  outOfScope: [],
  ranFrom: {},
};

const nodes: Node[] = [
  {
    id: "a",
    type: "architecture",
    position: { x: 0, y: 0 },
    data: { label: "A", type: "service" },
  },
  {
    id: "b",
    type: "architecture",
    position: { x: 200, y: 0 },
    data: { label: "B", type: "database" },
  },
];
const edges: Edge[] = [
  { id: "a-b", source: "a", target: "b", type: "architecture", data: { protocol: "tcp" } },
];
const flows: NamedFlow[] = [];

let schedule: MockInstance<typeof cloudWorkspace.schedule>;

beforeEach(() => {
  useDiagramStore.getState().resetDiagramState();
  schedule = vi.spyOn(cloudWorkspace, "schedule").mockImplementation(() => {});
});

afterEach(() => {
  schedule.mockRestore();
});

describe("documentOf", () => {
  it("includes the brief when there is one", () => {
    expect(documentOf({ nodes, edges, flows, brief })).toEqual({ nodes, edges, flows, brief });
  });

  it("omits the brief key when there is none", () => {
    const document = documentOf({ nodes, edges, flows, brief: null });
    expect(document).toEqual({ nodes, edges, flows });
    expect(document).not.toHaveProperty("brief");
  });

  it("is the document both saves and exports carry", () => {
    for (const current of [brief, null]) {
      useDiagramStore
        .getState()
        .hydrateDiagram(current ? { nodes, edges, brief: current } : { nodes, edges });
      schedule.mockClear();
      useDiagramStore.getState().saveDiagram();
      const expected = documentOf(useDiagramStore.getState());
      expect(schedule).toHaveBeenCalledExactlyOnceWith(expected);
      expect(useDiagramStore.getState().exportDiagram()).toEqual(expected);
    }
  });
});
