import type { Edge, Node } from "@xyflow/react";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type {
  AiStage,
  ApiOutput,
  ComponentsOutput,
  DecisionsOutput,
  DesignBrief,
  StageInput,
  StageOutput,
} from "@/schemas/aiDesign";
import { MAX_HISTORY_LENGTH } from "@/constants";
import { ApiError } from "@/services/api/errors";
import type { ApiDiagram } from "@/schemas/api";
import { diagramDataSchema } from "@/schemas/diagram";
import type { CloudState } from "@/services/cloudPersistence";
import { cloudWorkspace } from "@/services/cloudWorkspace";
import { notify } from "@/services/notify";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useDiagramStore } from "@/store/diagramStore";
import { archEdge, archNode, groupNode } from "@/templates/builders";
import type { NamedFlow } from "@/types/simulation";
import { diffDiagrams } from "@/utils/diagramDiff";
import { inputsFingerprint, resultFingerprint } from "@/utils/aiDesign/fingerprint";
import {
  cancelIfDiagramChanged,
  runDataModel,
  runDecision,
  runPipeline,
  useDesignPipeline,
  type PipelineDeps,
} from "./useDesignPipeline";

const NOW = "2026-11-01T10:00:00.000Z";

function makeBrief(overrides: Partial<DesignBrief> = {}): DesignBrief {
  return {
    inputs: {
      prompt: "A URL shortener",
      scope: "backend",
      requirements: [{ id: "r1", kind: "functional", text: "Create short links" }],
      outOfScope: [],
      answers: [],
    },
    questions: [],
    requirements: [],
    assumptions: [],
    outOfScope: [],
    ranFrom: {},
    ...overrides,
  };
}

/** Requirements and components already ran from these inputs: only stages 3 and 4 are due. */
function graphOnlyBrief(overrides: Partial<DesignBrief> = {}): DesignBrief {
  const brief = makeBrief({ summary: "Redirects short codes.", ...overrides });
  const inputs = inputsFingerprint(brief.inputs);
  return { ...brief, ranFrom: { requirements: inputs, components: inputs } };
}

const existingNodes = (): Node[] => [
  archNode("web", "client", "Web app", 0, 0),
  archNode("api", "service", "Links API", 0, 0, { description: "Creates and resolves links" }),
  archNode("db", "database", "Links DB", 0, 0),
];
const existingEdges = (): Edge[] => [
  archEdge("e1", "web", "api", { protocol: "http", label: "Shorten" }),
  archEdge("e2", "api", "db", { protocol: "tcp", label: "Store", async: true }),
];

const stage1Ready: StageOutput<"requirements"> = {
  questions: [],
  requirements: [{ kind: "nonFunctional", text: "Redirect in 50 ms", category: "latency" }],
  assumptions: [],
  outOfScope: [],
};
const stage1WithQuestions: StageOutput<"requirements"> = {
  ...stage1Ready,
  questions: [
    {
      id: "q1",
      topic: "Scale",
      question: "How many links per day?",
      why: "Sizes the store",
      options: [],
      recommended: "A million",
      allowsCustom: true,
    },
  ],
};
const componentsOutput: ComponentsOutput = {
  summary: "Redirects short codes to long URLs.",
  groups: [],
  components: [
    { key: "web", type: "client", label: "Web app", responsibility: "Shortens links" },
    { key: "api", type: "service", label: "Links API", responsibility: "Creates links" },
    { key: "cache", type: "cache", label: "Cache", responsibility: "Hot codes" },
  ],
  connections: [
    { from: "web", to: "api", protocol: "http", purpose: "Shorten", async: false },
    { from: "api", to: "cache", protocol: "tcp", purpose: "Lookup", async: false },
  ],
  mainFlow: { name: "Shorten", description: "Create a short link", entry: "web" },
};
const noComponents: ComponentsOutput = { ...componentsOutput, components: [], connections: [] };
const decision = (choice: string): DecisionsOutput => ({
  choice,
  reason: "Fits the load",
  gains: ["Fast"],
  costs: ["Another service"],
  considered: [{ option: "Other", whyNot: "Slower" }],
  revisitWhen: [],
});
const apiOutput: ApiOutput = {
  endpoints: [
    {
      key: "create-link",
      service: "api",
      calledBy: ["web"],
      method: "POST",
      path: "/links",
      summary: "Create a short link",
      auth: "user",
      style: "request",
      errors: [],
    },
  ],
  events: [],
};
const dataModelOutput: StageOutput<"data-model"> = {
  entities: [
    { name: "Link", store: "db", fields: [{ name: "code", type: "string" }], relations: [] },
  ],
};

type Handlers = {
  [S in AiStage]: (input: StageInput<S>, signal: AbortSignal) => Promise<StageOutput<S>>;
};

let handlers: Handlers;
let current: {
  id: string | null;
  nodes: Node[];
  edges: Edge[];
  flows: NamedFlow[];
  brief: DesignBrief | null;
};
let deps: PipelineDeps;

/** Records each request; the generic `fakeRun` below answers it from `handlers`. */
const run = vi.fn<(stage: AiStage, input: StageInput<AiStage>, signal: AbortSignal) => void>();
const fakeRun = <S extends AiStage>(stage: S, input: StageInput<S>, signal: AbortSignal) => {
  run(stage, input, signal);
  return handlers[stage](input, signal);
};
const apply = vi.fn<PipelineDeps["apply"]>((next) => {
  current.nodes = next.nodes ?? current.nodes;
  current.edges = next.edges ?? current.edges;
  current.flows = next.flows ?? current.flows;
  current.brief = next.brief;
});
/** A fake history top: every apply, edit and undo leaves a new entry object current. */
let historyTop: object = {};
const undo = vi.fn<() => void>(() => {
  historyTop = {};
});
const createVersion = vi.fn<PipelineDeps["createVersion"]>(async () => ({}));

const runState = () => useAiDesignStore.getState();
const stagesCalled = () => run.mock.calls.map(([stage]) => stage);
const lastBrief = () => apply.mock.lastCall?.[0].brief;
const nodeDecisions = () => current.nodes.filter((node) => node.data["decision"] !== undefined);
const applyComponentsCallOrder = () => {
  const index = apply.mock.calls.findIndex(([next]) => next.flows !== undefined);
  return apply.mock.invocationCallOrder[index] ?? Number.NaN;
};
/** The graph stage 2 applied, before stage 3 wrote any decision. */
const afterComponents = () => {
  const next = apply.mock.calls.find(([entry]) => entry.flows !== undefined)?.[0];
  return { nodes: next?.nodes ?? [], edges: next?.edges ?? [] };
};
const failure = (stage: string, status: number, statusText: string, message: string) =>
  new ApiError(status, `POST /ai/${stage} failed (${status} ${statusText}): ${message}`);

/** A request that settles only when the run aborts it, the way fetch does. */
const untilAborted = (signal: AbortSignal) =>
  new Promise<never>((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  });

beforeEach(() => {
  useAiDesignStore.setState(useAiDesignStore.getInitialState());
  run.mockClear();
  undo.mockClear();
  historyTop = {};
  apply.mockClear();
  createVersion.mockReset();
  createVersion.mockResolvedValue({});
  vi.spyOn(notify, "success").mockReturnValue("toast");
  handlers = {
    requirements: async () => stage1Ready,
    components: async () => componentsOutput,
    decisions: async (input) => decision(`${input.node.key} choice`),
    api: async () => apiOutput,
    "data-model": async () => dataModelOutput,
  };
  current = { id: "d1", nodes: [], edges: [], flows: [], brief: makeBrief() };
  deps = {
    api: { run: fakeRun },
    diagram: () => current,
    apply,
    createVersion,
    run: useAiDesignStore.getState(),
    now: () => NOW,
    historyEntry: () => historyTop,
    undo,
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runPipeline", () => {
  it("stops after requirements when questions are open", async () => {
    handlers.requirements = async () => stage1WithQuestions;
    await runPipeline(deps);
    expect(run).toHaveBeenCalledTimes(1);
    expect(lastBrief()?.questions).toEqual(stage1WithQuestions.questions);
    expect(runState().running).toBe(false);
  });

  it("does nothing while open questions block a fresh requirements stage", async () => {
    const brief = makeBrief({ questions: stage1WithQuestions.questions });
    current.brief = {
      ...brief,
      ranFrom: { requirements: inputsFingerprint(brief.inputs) },
    };
    await runPipeline(deps);
    expect(run).not.toHaveBeenCalled();
    expect(runState().runId).toBe(0);
  });

  it("does nothing without an open diagram or brief", async () => {
    current.id = null;
    await runPipeline(deps);
    current.id = "d1";
    current.brief = null;
    await runPipeline(deps);
    expect(run).not.toHaveBeenCalled();
    expect(runState().runId).toBe(0);
  });

  it("runs components then decisions and api concurrently", async () => {
    let releaseDecisions = () => {};
    const decisionsGate = new Promise<void>((resolve) => {
      releaseDecisions = resolve;
    });
    handlers.decisions = async (input) => {
      await decisionsGate;
      return decision(input.node.key);
    };

    const pipeline = runPipeline(deps);
    await vi.waitFor(() => expect(stagesCalled()).toContain("api"));
    // api started while every decision was still pending.
    expect(nodeDecisions()).toHaveLength(0);
    releaseDecisions();
    await pipeline;

    expect(stagesCalled()).toEqual([
      "requirements",
      "components",
      "decisions",
      "decisions",
      "decisions",
      "api",
    ]);
    expect(nodeDecisions().map((node) => node.id)).toEqual(
      expect.arrayContaining(["web", "api", "cache"]),
    );
    expect(nodeDecisions()).toHaveLength(3);
    expect(runState().decisions).toEqual({ done: 3, total: 3 });
  });

  it("records the decisions and api fingerprints of the graph they ran against", async () => {
    await runPipeline(deps);
    const brief = current.brief;
    if (!brief) {
      throw new Error("brief missing");
    }
    const expected = resultFingerprint(brief, current.nodes, current.edges);
    expect(brief.ranFrom.decisions).toBe(expected);
    expect(brief.ranFrom.api).toBe(expected);
    expect(brief.api?.endpoints).toEqual(apiOutput.endpoints);
    expect(runState().errors).toEqual({});
  });

  it.each([0, -1, Number.NaN])(
    "runs every decision when the concurrency is %s",
    async (decisionConcurrency) => {
      current.nodes = existingNodes();
      current.edges = existingEdges();
      current.brief = graphOnlyBrief();
      await runPipeline(deps, { decisionConcurrency });
      expect(stagesCalled().filter((stage) => stage === "decisions")).toHaveLength(3);
      expect(nodeDecisions()).toHaveLength(3);
      expect(current.brief?.ranFrom.decisions).toBe(
        resultFingerprint(graphOnlyBrief(), existingNodes(), existingEdges()),
      );
    },
  );

  it("limits concurrent decision requests", async () => {
    current.nodes = existingNodes();
    current.edges = existingEdges();
    current.brief = graphOnlyBrief();
    let inFlight = 0;
    let peak = 0;
    handlers.decisions = async (input) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight -= 1;
      return decision(input.node.key);
    };
    await runPipeline(deps, { decisionConcurrency: 2 });
    expect(peak).toBe(2);
    expect(nodeDecisions()).toHaveLength(3);
  });

  it("saves a version before replacing an existing graph", async () => {
    current.nodes = existingNodes();
    current.edges = existingEdges();
    await runPipeline(deps);
    expect(createVersion).toHaveBeenCalledWith("Before AI update");
    expect(createVersion).toHaveBeenCalledTimes(1);
    expect(createVersion.mock.invocationCallOrder[0]).toBeLessThan(applyComponentsCallOrder());
    // The version is saved after stage 1 has been applied, so it includes it.
    expect(createVersion.mock.invocationCallOrder[0]).toBeGreaterThan(
      apply.mock.invocationCallOrder[0] ?? Number.NaN,
    );
  });

  it("does not save a version for a first design", async () => {
    current.nodes = [{ id: "note", type: "comment", position: { x: 0, y: 0 }, data: {} }];
    await runPipeline(deps);
    expect(createVersion).not.toHaveBeenCalled();
    expect(current.nodes.map((node) => node.id)).toContain("cache");
  });

  it("stops without replacing the design when the version cannot be saved", async () => {
    current.nodes = existingNodes();
    createVersion.mockRejectedValue(new Error("This diagram was changed in another tab."));
    await runPipeline(deps);
    expect(stagesCalled()).toEqual(["requirements"]);
    expect(applyComponentsCallOrder()).toBeNaN();
    expect(runState().errors.components).toBe("This diagram was changed in another tab.");
    expect(runState().running).toBe(false);
  });

  it("discards results when the diagram changes mid-run", async () => {
    handlers.requirements = async () => {
      current.id = "other";
      return stage1Ready;
    };
    await runPipeline(deps);
    expect(apply).not.toHaveBeenCalled();
    expect(stagesCalled()).toEqual(["requirements"]);
    expect(runState().running).toBe(false);
  });

  it("discards a late decision when the diagram changes during stage 3", async () => {
    current.nodes = existingNodes();
    current.brief = graphOnlyBrief();
    handlers.decisions = async (input) => {
      if (input.node.key === "api") {
        current.id = "other";
      }
      return decision(input.node.key);
    };
    handlers.api = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return apiOutput;
    };
    await runPipeline(deps, { decisionConcurrency: 1 });
    expect(nodeDecisions().map((node) => node.id)).toEqual(["web"]);
    expect(current.brief?.api).toBeUndefined();
    expect(current.brief?.ranFrom.decisions).toBeUndefined();
    expect(notify.success).not.toHaveBeenCalled();
  });

  it("keeps successful decisions but leaves the stage outdated when one fails", async () => {
    // 3 nodes; one decision rejects
    current.nodes = existingNodes();
    current.edges = existingEdges();
    current.brief = graphOnlyBrief();
    handlers.decisions = async (input) => {
      if (input.node.key === "db") {
        throw failure("decisions", 502, "Bad Gateway", "The model failed");
      }
      return decision(input.node.key);
    };
    await runPipeline(deps);
    expect(nodeDecisions()).toHaveLength(2);
    expect(lastBrief()?.ranFrom.decisions).toBeUndefined();
    expect(runState().errors.decisions).toBe("Reasoning failed for 1 components");
    expect(runState().decisions).toEqual({ done: 2, total: 3 });
    // Stage 4 is independent and still completes.
    expect(current.brief?.ranFrom.api).toBe(
      resultFingerprint(graphOnlyBrief(), existingNodes(), existingEdges()),
    );
  });

  it("requests decisions again after a partial failure and records them once all succeed", async () => {
    current.nodes = existingNodes();
    current.edges = existingEdges();
    current.brief = graphOnlyBrief();
    let failDb = true;
    handlers.decisions = async (input) => {
      if (failDb && input.node.key === "db") {
        throw failure("decisions", 502, "Bad Gateway", "The model failed");
      }
      return decision(input.node.key);
    };
    await runPipeline(deps);
    expect(current.brief?.ranFrom.decisions).toBeUndefined();

    failDb = false;
    run.mockClear();
    await runPipeline(deps);
    // Update runs the first out-of-date stage (decisions) and every stage after it.
    expect(stagesCalled()).toEqual(["decisions", "decisions", "decisions", "api"]);
    expect(current.brief?.ranFrom.decisions).toBe(
      resultFingerprint(graphOnlyBrief(), existingNodes(), existingEdges()),
    );
    expect(runState().errors).toEqual({});
  });

  it("leaves the diagram unchanged when stage 2 has no usable components", async () => {
    current.nodes = existingNodes();
    current.edges = existingEdges();
    handlers.components = async () => noComponents;
    await runPipeline(deps);
    expect(current.nodes).toEqual(existingNodes());
    expect(current.edges).toEqual(existingEdges());
    expect(applyComponentsCallOrder()).toBeNaN();
    expect(runState().errors.components).toBe("The AI returned no usable components");
    expect(runState().warnings).toContain("The design has no components.");
    expect(stagesCalled()).toEqual(["requirements", "components"]);
    expect(notify.success).not.toHaveBeenCalled();
  });

  it("stores the server message of a failed stage as its error", async () => {
    handlers.requirements = async () => {
      throw failure("requirements", 402, "Payment Required", "AI budget reached");
    };
    await runPipeline(deps);
    expect(runState().errors.requirements).toBe("AI budget reached");
    expect(apply).not.toHaveBeenCalled();
    expect(runState().running).toBe(false);
  });

  it("falls back to the whole message when an error has no server message", async () => {
    current.brief = graphOnlyBrief();
    current.nodes = existingNodes();
    handlers.api = async () => {
      throw new Error("Network unreachable");
    };
    await runPipeline(deps);
    expect(runState().errors.api).toBe("Network unreachable");
    expect(nodeDecisions()).toHaveLength(3);
  });

  it("cancel aborts in-flight requests and applies nothing further", async () => {
    const signals: AbortSignal[] = [];
    handlers.decisions = async (_input, signal) => {
      signals.push(signal);
      return untilAborted(signal);
    };
    handlers.api = async (_input, signal) => {
      signals.push(signal);
      return untilAborted(signal);
    };

    const pipeline = runPipeline(deps);
    await vi.waitFor(() => expect(signals).toHaveLength(4));
    const appliesBeforeCancel = apply.mock.calls.length;
    useAiDesignStore.getState().cancel();
    await pipeline;

    expect(signals.every((signal) => signal.aborted)).toBe(true);
    expect(apply).toHaveBeenCalledTimes(appliesBeforeCancel);
    expect(runState().errors).toEqual({});
    expect(runState().running).toBe(false);
    expect(notify.success).not.toHaveBeenCalled();
  });

  it("does not end a newer run that replaced it", async () => {
    handlers.requirements = async (_input, signal) => untilAborted(signal);
    const first = runPipeline(deps);
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    const newer = useAiDesignStore.getState().start("d1");
    await first;
    expect(runState().running).toBe(true);
    expect(runState().controller?.signal).toBe(newer);
  });

  it("summarizes the change with an undo toast after stage 2", async () => {
    current.nodes = existingNodes();
    current.edges = existingEdges();
    const before = { nodes: existingNodes(), edges: existingEdges() };
    apply.mockImplementation((next) => {
      Object.assign(current, next);
      historyTop = {};
    });

    await runPipeline(deps);

    const { counts } = diffDiagrams(before, afterComponents());
    expect(counts.added).toBeGreaterThan(0);
    expect(runState().lastChange).toEqual({
      added: counts.added,
      changed: counts.modified,
      removed: counts.removed,
    });
    expect(notify.success).toHaveBeenCalledTimes(1);
    const toast = vi.mocked(notify.success).mock.lastCall?.[0];
    expect(toast?.title).toBe("Design updated");
    expect(toast?.message).toBe(
      `+${counts.added} added · ${counts.modified} changed · ${counts.removed} removed`,
    );
    expect(toast?.button?.title).toBe("Undo");
    toast?.button?.onClick();
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it("does not count the decisions stage 3 writes on kept components as changes", async () => {
    apply.mockImplementation((next) => {
      Object.assign(current, next);
      historyTop = {};
    });
    const requirementsDone = (brief: DesignBrief): DesignBrief => ({
      ...brief,
      ranFrom: { requirements: inputsFingerprint(brief.inputs) },
    });
    current.brief = requirementsDone(makeBrief());
    await runPipeline(deps);
    // The same design again: stage 2 keeps every node as it is, stage 3 rewrites every decision.
    const designed = afterComponents();
    current.nodes = designed.nodes;
    current.edges = designed.edges;
    current.brief = requirementsDone(current.brief);
    apply.mockClear();

    await runPipeline(deps);

    expect(stagesCalled()).toContain("components");
    expect(nodeDecisions().length).toBe(componentsOutput.components.length);
    expect(diffDiagrams(designed, current).counts.modified).toBeGreaterThan(0);
    expect(runState().lastChange).toEqual({ added: 0, changed: 0, removed: 0 });
    expect(runState().highlight.size).toBe(0);
  });

  describe("change highlight", () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      current.nodes = existingNodes();
      current.edges = existingEdges();
      apply.mockImplementation((next) => {
        Object.assign(current, next);
        historyTop = {};
      });
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("marks the added and changed nodes for 4 seconds", async () => {
      const before = { nodes: existingNodes(), edges: existingEdges() };
      await runPipeline(deps);

      const changed = diffDiagrams(before, afterComponents())
        .nodes.filter(({ status }) => status === "added" || status === "modified")
        .map(({ node }) => node.id);
      expect(changed.length).toBeGreaterThan(0);
      expect([...runState().highlight].sort()).toEqual([...changed].sort());
      vi.advanceTimersByTime(3999);
      expect(runState().highlight.size).toBe(changed.length);
      vi.advanceTimersByTime(1);
      expect(runState().highlight.size).toBe(0);
    });

    it("leaves a highlight set in the meantime alone", async () => {
      await runPipeline(deps);
      runState().setHighlight(["api"]);
      vi.advanceTimersByTime(4000);
      expect([...runState().highlight]).toEqual(["api"]);
    });
  });

  it("Undo does nothing once another history entry follows the run", async () => {
    apply.mockImplementation((next) => {
      Object.assign(current, next);
      historyTop = {};
    });
    await runPipeline(deps);
    historyTop = {}; // a user edit after the run
    vi.mocked(notify.success).mock.lastCall?.[0].button?.onClick();
    expect(undo).not.toHaveBeenCalled();
  });

  describe("with the real diagram store", () => {
    const store = () => useDiagramStore.getState();
    const clickUndo = () => vi.mocked(notify.success).mock.lastCall?.[0].button?.onClick();
    const ids = () => store().nodes.map((node) => node.id);

    beforeEach(() => {
      useDiagramStore.setState(useDiagramStore.getInitialState());
      store().hydrateDiagram({
        nodes: existingNodes(),
        edges: existingEdges(),
        flows: [],
        brief: makeBrief(),
      });
      deps.diagram = () => {
        const { nodes, edges, flows, brief } = store();
        return { id: "d1", nodes, edges, flows, brief };
      };
      deps.apply = (next) => store().applyAiResult(next);
      deps.historyEntry = () => store().history[store().historyIndex];
      deps.undo = () => store().undo();
    });

    it("Undo reverts the whole run when nothing followed it", async () => {
      await runPipeline(deps);
      expect(ids()).toContain("cache");
      clickUndo();
      expect(ids()).toEqual(["web", "api", "db"]);
      expect(store().brief).toEqual(makeBrief());
    });

    const editSummary = (summary: string) =>
      store().updateBrief((brief) => brief && { ...brief, summary });

    it("Undo leaves a later user edit in place", async () => {
      await runPipeline(deps);
      editSummary("Edited by hand");
      clickUndo();
      expect(store().brief?.summary).toBe("Edited by hand");
      expect(ids()).toContain("cache");
    });

    it("Undo leaves an edit made after undoing the run, at the same history index", async () => {
      await runPipeline(deps);
      const runIndex = store().historyIndex;
      store().undo(); // Ctrl+Z reverts the run
      editSummary("Edited by hand");
      expect(store().historyIndex).toBe(runIndex);
      clickUndo();
      expect(store().brief?.summary).toBe("Edited by hand");
      expect(ids()).toEqual(["web", "api", "db"]);
    });

    it("Undo leaves a later edit in place when the history is full", async () => {
      for (let edit = 0; edit < MAX_HISTORY_LENGTH; edit++) {
        editSummary(`Edit ${edit}`);
      }
      editSummary("Before the run");
      await runPipeline(deps);
      const runIndex = store().historyIndex;
      expect(runIndex).toBe(MAX_HISTORY_LENGTH - 1);
      editSummary("Edited by hand");
      expect(store().historyIndex).toBe(runIndex);
      clickUndo();
      expect(store().brief?.summary).toBe("Edited by hand");
      expect(ids()).toContain("cache");
    });
  });

  it("shows no change summary when stage 2 did not run", async () => {
    current.nodes = existingNodes();
    current.brief = graphOnlyBrief();
    await runPipeline(deps);
    expect(notify.success).not.toHaveBeenCalled();
    expect(runState().lastChange).toBeNull();
    expect(createVersion).not.toHaveBeenCalled();
  });

  it("builds each stage input from the brief and the graph", async () => {
    const brief = graphOnlyBrief();
    current.brief = brief;
    current.nodes = [
      groupNode("backend", "vpc", "Backend", 0, 0, 400, 300),
      ...existingNodes(),
      { id: "note", type: "comment", position: { x: 0, y: 0 }, data: { text: "hi" } },
    ];
    current.edges = [
      ...existingEdges(),
      { id: "loose", source: "web", target: "db", type: "architecture", data: {} },
    ];
    await runPipeline(deps);

    const inputFor = (key: string) =>
      run.mock.calls.find(
        ([stage, input]) => stage === "decisions" && "node" in input && input.node.key === key,
      )?.[1];
    const context = {
      prompt: "A URL shortener",
      scope: "backend",
      requirements: [{ kind: "functional", text: "Create short links", assumed: false }],
      outOfScope: [],
    };
    expect(stagesCalled().filter((stage) => stage === "decisions")).toHaveLength(4);
    expect(inputFor("api")).toEqual({
      context,
      summary: "Redirects short codes.",
      node: {
        key: "api",
        type: "service",
        label: "Links API",
        responsibility: "Creates and resolves links",
      },
      neighbours: [
        { key: "web", type: "client", label: "Web app", protocol: "http", direction: "in" },
        { key: "db", type: "database", label: "Links DB", protocol: "tcp", direction: "out" },
      ],
    });
    expect(inputFor("backend")).toEqual({
      context,
      summary: "Redirects short codes.",
      node: { key: "backend", type: "vpc", label: "Backend" },
      neighbours: [],
    });
    expect(run.mock.calls.find(([stage]) => stage === "api")?.[1]).toEqual({
      context,
      summary: "Redirects short codes.",
      graph: {
        nodes: [
          { key: "web", type: "client", label: "Web app" },
          { key: "api", type: "service", label: "Links API" },
          { key: "db", type: "database", label: "Links DB" },
        ],
        edges: [
          { from: "web", to: "api", protocol: "http", async: false },
          { from: "api", to: "db", protocol: "tcp", async: true },
        ],
      },
    });
  });

  it("sends the current generated keys to stage 2", async () => {
    current.nodes = [groupNode("backend", "vpc", "Backend", 0, 0, 400, 300), ...existingNodes()];
    await runPipeline(deps);
    const input = run.mock.calls.find(([stage]) => stage === "components")?.[1];
    expect(input).toMatchObject({ previousKeys: ["backend", "web", "api", "db"] });
  });

  it("records the stages it plans to run as it starts", async () => {
    current.nodes = existingNodes();
    current.edges = existingEdges();
    current.brief = graphOnlyBrief();
    const planned: AiStage[][] = [];
    const unsubscribe = useAiDesignStore.subscribe((state, previous) => {
      if (state.plannedStages !== previous.plannedStages && state.plannedStages.length > 0) {
        planned.push(state.plannedStages);
      }
    });
    await runPipeline(deps);
    await runDecision(deps, "api");
    await runDataModel(deps);
    unsubscribe();
    expect(planned).toEqual([["decisions", "api"], ["decisions"], ["data-model"]]);

    current.brief = makeBrief();
    await runPipeline(deps);
    expect(runState().plannedStages).toEqual(["requirements", "components", "decisions", "api"]);
  });

  it("keeps errors and warnings of stages that do not run", async () => {
    current.nodes = existingNodes();
    current.brief = graphOnlyBrief();
    useAiDesignStore.setState({
      errors: { components: "old components error", decisions: "old decisions error" },
      warnings: ["Dropped connection"],
    });
    deps.run = useAiDesignStore.getState();
    await runPipeline(deps);
    expect(runState().errors).toEqual({ components: "old components error" });
    expect(runState().warnings).toEqual(["Dropped connection"]);
  });
});

describe("runDecision", () => {
  it("regenerates one node's decision without recording the stage fingerprint", async () => {
    current.nodes = existingNodes();
    current.edges = existingEdges();
    current.brief = graphOnlyBrief();
    await runDecision(deps, "api");
    expect(stagesCalled()).toEqual(["decisions"]);
    expect(nodeDecisions().map((node) => node.id)).toEqual(["api"]);
    expect(current.brief?.ranFrom.decisions).toBeUndefined();
    expect(runState().running).toBe(false);
  });

  it("stores the server message when regeneration fails", async () => {
    current.nodes = existingNodes();
    current.brief = graphOnlyBrief();
    handlers.decisions = async () => {
      throw failure("decisions", 429, "Too Many Requests", "Try again in 20 seconds");
    };
    await runDecision(deps, "api");
    expect(runState().errors.decisions).toBe("Try again in 20 seconds");
    expect(apply).not.toHaveBeenCalled();
  });

  it("ignores ids that are not architecture or group nodes", async () => {
    current.nodes = [{ id: "note", type: "comment", position: { x: 0, y: 0 }, data: {} }];
    await runDecision(deps, "note");
    await runDecision(deps, "missing");
    expect(run).not.toHaveBeenCalled();
  });
});

describe("runDataModel", () => {
  it("generates the data model from the graph and endpoints", async () => {
    current.nodes = existingNodes();
    current.edges = existingEdges();
    current.brief = graphOnlyBrief({ api: apiOutput });
    await runDataModel(deps);
    expect(run.mock.calls[0]?.[0]).toBe("data-model");
    expect(run.mock.calls[0]?.[1]).toMatchObject({
      endpoints: [{ service: "api", method: "POST", path: "/links" }],
      graph: { nodes: [{ key: "web" }, { key: "api" }, { key: "db" }] },
    });
    expect(current.brief?.dataModel).toEqual(dataModelOutput);
    expect(current.brief?.ranFrom.dataModel).toBe(
      resultFingerprint(graphOnlyBrief(), existingNodes(), existingEdges()),
    );
  });

  it("stores the server message when the data model fails", async () => {
    current.brief = graphOnlyBrief();
    handlers["data-model"] = async () => {
      throw failure("data-model", 502, "Bad Gateway", "The AI service failed");
    };
    await runDataModel(deps);
    expect(runState().errors["data-model"]).toBe("The AI service failed");
    expect(apply).not.toHaveBeenCalled();
  });
});

const cloudState: CloudState = {
  diagram: null,
  status: "saved",
  dirty: false,
  locked: false,
  transitioning: false,
  message: null,
};
const diagramWithId = (id: string): ApiDiagram => ({
  id,
  projectId: "p1",
  name: "Shortener",
  description: null,
  thumbnail: null,
  data: diagramDataSchema.parse({ nodes: [], edges: [] }),
  revision: 1,
  version: 0,
  createdAt: NOW,
  updatedAt: NOW,
});

describe("cancelIfDiagramChanged", () => {
  it("cancels a run that belongs to another diagram", () => {
    const signal = useAiDesignStore.getState().start("d1");
    cancelIfDiagramChanged("d2");
    expect(signal.aborted).toBe(true);
    expect(runState().running).toBe(false);
  });

  it("cancels a run when no diagram is open", () => {
    const signal = useAiDesignStore.getState().start("d1");
    cancelIfDiagramChanged(null);
    expect(signal.aborted).toBe(true);
  });

  it("keeps a run on its own diagram, and ignores idle state", () => {
    const signal = useAiDesignStore.getState().start("d1");
    cancelIfDiagramChanged("d1");
    expect(signal.aborted).toBe(false);
    useAiDesignStore.getState().finish();
    const cancel = vi.spyOn(useAiDesignStore.getState(), "cancel");
    cancelIfDiagramChanged("d2");
    expect(cancel).not.toHaveBeenCalled();
  });
});

describe("useDesignPipeline", () => {
  it("cancels the run when the active diagram changes, until unmounted", () => {
    let notifyChange = () => {};
    const unsubscribe = vi.fn<() => void>();
    vi.spyOn(cloudWorkspace, "subscribe").mockImplementation((listener) => {
      notifyChange = listener;
      return unsubscribe;
    });
    let activeId = "d1";
    vi.spyOn(cloudWorkspace, "getState").mockImplementation(() => ({
      ...cloudState,
      diagram: diagramWithId(activeId),
    }));
    const { unmount } = renderHook(() => useDesignPipeline());
    const signal = useAiDesignStore.getState().start("d1");

    notifyChange();
    expect(signal.aborted).toBe(false);
    activeId = "d2";
    notifyChange();
    expect(signal.aborted).toBe(true);
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("delegates cancel to the run store", () => {
    const { result } = renderHook(() => useDesignPipeline());
    const signal = useAiDesignStore.getState().start("d1");
    result.current.cancel();
    expect(signal.aborted).toBe(true);
    expect(runState().running).toBe(false);
  });

  it("retry clears the stage error before running again", async () => {
    useAiDesignStore.setState({ errors: { api: "AI budget reached" } });
    const { result } = renderHook(() => useDesignPipeline());
    // No diagram is open, so nothing runs; only the error is cleared.
    await result.current.retry("api");
    expect(runState().errors).toEqual({});
  });
});
