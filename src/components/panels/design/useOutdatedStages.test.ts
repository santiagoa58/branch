import type { Node } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { DesignBrief } from "@/schemas/aiDesign";
import { useDiagramStore } from "@/store/diagramStore";
import {
  inputsFingerprint,
  nextStages,
  outdatedStages,
  resultFingerprint,
} from "@/utils/aiDesign/fingerprint";
import { useOutdatedStages } from "./useOutdatedStages";

const service: Node = {
  id: "api",
  type: "architecture",
  position: { x: 0, y: 0 },
  data: { label: "API", type: "service" },
};

const base: DesignBrief = {
  inputs: {
    prompt: "A URL shortener",
    scope: "backend",
    requirements: [],
    outOfScope: [],
    answers: [],
  },
  questions: [],
  requirements: [],
  assumptions: [],
  outOfScope: [],
  ranFrom: {},
};

/** Every stage ran from the current inputs and the graph holding `service`. */
function freshBrief(): DesignBrief {
  const inputs = inputsFingerprint(base.inputs);
  const result = resultFingerprint(base, [service], []);
  return {
    ...base,
    ranFrom: { requirements: inputs, components: inputs, decisions: result, api: result },
  };
}

beforeEach(() => {
  useDiagramStore.getState().resetDiagramState();
});

afterEach(() => {
  cleanup();
});

describe("useOutdatedStages", () => {
  it("reports nothing to run without a brief", () => {
    const { result } = renderHook(() => useOutdatedStages());
    expect(result.current.outdated).toBeNull();
    expect(result.current.next).toEqual([]);
  });

  it("matches outdatedStages and nextStages for the diagram brief", () => {
    useDiagramStore.setState({ brief: freshBrief(), nodes: [service], edges: [] });
    const { result } = renderHook(() => useOutdatedStages());
    expect(result.current.outdated).toEqual({ stages: [], dataModel: false });
    expect(result.current.next).toEqual([]);

    // A new component leaves reasoning and the API stale.
    const added: Node = { ...service, id: "db", data: { label: "DB", type: "database" } };
    act(() => useDiagramStore.setState({ nodes: [service, added] }));
    const { brief, nodes, edges } = useDiagramStore.getState();
    expect(brief).not.toBeNull();
    expect(result.current.outdated).toEqual(outdatedStages(brief!, nodes, edges));
    expect(result.current.next).toEqual(nextStages(brief!, nodes, edges));
    expect(result.current.next).toEqual(["decisions", "api"]);
  });

  it("keeps its result while a change leaves the graph fingerprint alone", () => {
    useDiagramStore.setState({ brief: freshBrief(), nodes: [service], edges: [] });
    const { result } = renderHook(() => useOutdatedStages());
    const first = result.current;
    act(() => useDiagramStore.setState({ nodes: [{ ...service, position: { x: 40, y: 80 } }] }));
    expect(result.current).toBe(first);
  });

  it("previews another brief against the current graph", () => {
    useDiagramStore.setState({ brief: freshBrief(), nodes: [service], edges: [] });
    const { result } = renderHook(() => useOutdatedStages());
    const preview: DesignBrief = {
      ...freshBrief(),
      inputs: { ...base.inputs, prompt: "A pastebin" },
    };
    expect(result.current.nextFor(preview)).toEqual(nextStages(preview, [service], []));
    expect(result.current.nextFor(preview)).toEqual([
      "requirements",
      "components",
      "decisions",
      "api",
    ]);
  });
});
