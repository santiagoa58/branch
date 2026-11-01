import type { Edge, Node } from "@xyflow/react";
import { useEffect } from "react";
import type {
  AiStage,
  ApiInput,
  DecisionsInput,
  DesignBrief,
  StageInput,
  StageOutput,
} from "@/schemas/aiDesign";
import { aiStageSchema } from "@/schemas/aiDesign";
import {
  architectureNodeTypeSchema,
  edgeProtocolSchema,
  groupNodeTypeSchema,
} from "@/schemas/catalogEnums";
import { aiApi } from "@/services/api/ai";
import { cloudWorkspace } from "@/services/cloudWorkspace";
import { notify } from "@/services/notify";
import { useAiDesignStore, type AiDesignState } from "@/store/aiDesignStore";
import { useDiagramStore, type DiagramStore } from "@/store/diagramStore";
import type { NamedFlow } from "@/types/simulation";
import { applyComponents } from "@/utils/aiDesign/applyComponents";
import { applyRequirements } from "@/utils/aiDesign/applyRequirements";
import { applyApi, applyDataModel, applyDecision } from "@/utils/aiDesign/applyResults";
import { nextStages, resultFingerprint } from "@/utils/aiDesign/fingerprint";
import { buildDesignContext, requirementsInput } from "@/utils/aiDesign/inputs";
import { diffDiagrams, type DiagramSide } from "@/utils/diagramDiff";

export const VERSION_LABEL = "Before AI update";
export const NO_COMPONENTS_ERROR = "The AI returned no usable components";

interface PipelineDiagram {
  id: string | null;
  nodes: Node[];
  edges: Edge[];
  flows: NamedFlow[];
  /** Null for a hand-made diagram; a run never starts, and stops, without a brief. */
  brief: DesignBrief | null;
}

type LiveDiagram = PipelineDiagram & { brief: DesignBrief };

export interface PipelineDeps {
  api: Pick<typeof aiApi, "run">;
  diagram: () => PipelineDiagram;
  apply: (next: Parameters<DiagramStore["applyAiResult"]>[0]) => void;
  /** `cloudWorkspace.createVersion`, which flushes pending saves first. */
  createVersion: (label: string) => Promise<unknown>;
  /** aiDesignStore state read when the call starts; only its actions are used afterwards. */
  run: AiDesignState;
  now: () => string;
  /**
   * The diagram store's current history entry (`history[historyIndex]`). Undo in the summary toast
   * reverts only the run, so it compares entries by identity: an index can come back holding a
   * different entry (undo then edit, or the history cap trimming the oldest entry).
   */
  historyEntry: () => unknown;
  undo: () => void;
}

type Outcome<T> = { ok: true; value: T } | { ok: false; message: string | null };

/** The server's message from `ApiError` ("POST /ai/x failed (402 …): <message>"), else the whole message. */
function errorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Something went wrong.";
  }
  const index = error.message.indexOf("): ");
  return index === -1 ? error.message : error.message.slice(index + 3);
}

// --- Stage inputs ---

const isGenerated = (node: Node) => node.type === "architecture" || node.type === "group";

/** The catalog type of an architecture or group node, when it is a valid one. */
function nodeType(node: Node): DecisionsInput["node"]["type"] | undefined {
  const parsed =
    node.type === "architecture"
      ? architectureNodeTypeSchema.safeParse(node.data["type"])
      : node.type === "group"
        ? groupNodeTypeSchema.safeParse(node.data["groupType"])
        : undefined;
  return parsed?.success ? parsed.data : undefined;
}

const nodeLabel = (node: Node) =>
  typeof node.data["label"] === "string" ? node.data["label"] : node.id;

function edgeProtocol(edge: Edge) {
  const parsed = edgeProtocolSchema.safeParse(edge.data?.["protocol"]);
  return parsed.success ? parsed.data : undefined;
}

function graphSummary(nodes: Node[], edges: Edge[]): ApiInput["graph"] {
  return {
    nodes: nodes.flatMap((node) => {
      const type = node.type === "architecture" ? nodeType(node) : undefined;
      return type ? [{ key: node.id, type, label: nodeLabel(node) }] : [];
    }),
    edges: edges.flatMap((edge) => {
      const protocol = edgeProtocol(edge);
      return protocol
        ? [{ from: edge.source, to: edge.target, protocol, async: edge.data?.["async"] === true }]
        : [];
    }),
  };
}

function decisionInput(diagram: LiveDiagram, node: Node): DecisionsInput | undefined {
  const type = nodeType(node);
  if (!isGenerated(node) || !type) {
    return undefined;
  }
  const byId = new Map(diagram.nodes.map((entry) => [entry.id, entry]));
  const neighbours = diagram.edges.flatMap((edge): DecisionsInput["neighbours"] => {
    const direction = edge.source === node.id ? "out" : edge.target === node.id ? "in" : undefined;
    const other = byId.get(direction === "out" ? edge.target : edge.source);
    const protocol = edgeProtocol(edge);
    if (!direction || !other || !protocol) {
      return [];
    }
    return [
      {
        key: other.id,
        type: nodeType(other) ?? other.type ?? "",
        label: nodeLabel(other),
        protocol,
        direction,
      },
    ];
  });
  const description = node.data["description"];
  return {
    context: buildDesignContext(diagram.brief),
    summary: diagram.brief.summary ?? "",
    node: {
      key: node.id,
      type,
      label: nodeLabel(node),
      ...(typeof description === "string" && description !== ""
        ? { responsibility: description }
        : {}),
    },
    neighbours,
  };
}

// --- Runs ---

interface Session {
  /** The diagram, or null once the run was cancelled or replaced, or the user left the diagram. */
  current: () => LiveDiagram | null;
  request: <S extends AiStage>(stage: S, input: StageInput<S>) => Promise<Outcome<StageOutput<S>>>;
  /** Records a stage error unless the run's results are being discarded. */
  fail: (stage: AiStage, message: string | null) => void;
  end: () => void;
}

/**
 * Starts a run for the open diagram. `start()` resets all errors and warnings, so those of stages
 * that will not run are put back.
 */
function beginRun(deps: PipelineDeps, stages: readonly AiStage[]): Session | null {
  const opened = deps.diagram();
  if (opened.id === null || opened.brief === null) {
    return null;
  }
  const diagramId = opened.id;
  const { errors: previousErrors, warnings: previousWarnings } = deps.run;
  const signal = deps.run.start(diagramId);
  deps.run.setPlannedStages(stages);
  for (const stage of aiStageSchema.options) {
    const message = previousErrors[stage];
    if (!stages.includes(stage) && message !== undefined) {
      deps.run.setError(stage, message);
    }
  }
  if (!stages.includes("components")) {
    deps.run.addWarnings(previousWarnings);
  }

  const current = (): LiveDiagram | null => {
    if (signal.aborted) {
      return null;
    }
    const diagram = deps.diagram();
    if (diagram.id !== diagramId || diagram.brief === null) {
      return null;
    }
    return { ...diagram, brief: diagram.brief };
  };

  return {
    current,
    request: async (stage, input) => {
      try {
        return { ok: true, value: await deps.api.run(stage, input, signal) };
      } catch (error) {
        return { ok: false, message: current() ? errorMessage(error) : null };
      }
    },
    fail: (stage, message) => {
      if (message !== null && current()) {
        deps.run.setError(stage, message);
      }
    },
    // A newer run aborts this one's signal and owns the run state; cancel has already finished.
    end: () => {
      if (!signal.aborted) {
        deps.run.finish();
      }
    },
  };
}

/** Runs `worker` over `items` with at most `limit` in flight. Workers must not throw. */
async function forEachLimited<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  const lane = async () => {
    for (let item = items[next++]; item !== undefined; item = items[next++]) {
      await worker(item);
    }
  };
  // Anything but a positive count (0, negative, NaN) means no limit, so every item still runs.
  const bounded = Number.isFinite(limit) && limit >= 1 ? Math.floor(limit) : Infinity;
  const lanes = Math.max(1, Math.min(bounded, items.length));
  await Promise.all(Array.from({ length: lanes }, lane));
}

async function runDecisions(
  deps: PipelineDeps,
  session: Session,
  base: LiveDiagram,
  ranFrom: string,
  concurrency: number,
): Promise<void> {
  const inputs = base.nodes.flatMap((node) => {
    const input = decisionInput(base, node);
    return input ? [input] : [];
  });
  let done = 0;
  let failed = 0;
  deps.run.setDecisionProgress(0, inputs.length);
  await forEachLimited(inputs, concurrency, async (input) => {
    if (!session.current()) {
      return;
    }
    const result = await session.request("decisions", input);
    const latest = session.current();
    if (!latest) {
      return;
    }
    if (!result.ok) {
      failed += 1;
      return;
    }
    deps.apply({
      nodes: applyDecision(latest.nodes, input.node.key, result.value),
      brief: latest.brief,
    });
    done += 1;
    deps.run.setDecisionProgress(done, inputs.length);
  });
  const latest = session.current();
  if (!latest) {
    return;
  }
  if (failed > 0) {
    deps.run.setError("decisions", `Reasoning failed for ${failed} components`);
    return;
  }
  deps.apply({
    brief: { ...latest.brief, ranFrom: { ...latest.brief.ranFrom, decisions: ranFrom } },
  });
}

async function runApi(
  deps: PipelineDeps,
  session: Session,
  base: LiveDiagram,
  ranFrom: string,
): Promise<void> {
  const result = await session.request("api", {
    context: buildDesignContext(base.brief),
    summary: base.brief.summary ?? "",
    graph: graphSummary(base.nodes, base.edges),
  });
  if (!result.ok) {
    session.fail("api", result.message);
    return;
  }
  const latest = session.current();
  if (latest) {
    deps.apply({ brief: applyApi(latest.brief, result.value, ranFrom) });
  }
}

function summarizeChange(deps: PipelineDeps, before: DiagramSide, after: DiagramSide) {
  const { added, modified, removed } = diffDiagrams(before, after).counts;
  deps.run.setLastChange({ added, changed: modified, removed });
  // A run is one history entry. Once the current entry is anything else (an edit, an undo or a
  // redo), Undo would revert something other than this run, so it does nothing.
  const runEntry = deps.historyEntry();
  notify.success({
    title: "Design updated",
    message: `+${added} added · ${modified} changed · ${removed} removed`,
    button: {
      title: "Undo",
      onClick: () => {
        if (deps.historyEntry() === runEntry) {
          deps.undo();
        }
      },
    },
  });
}

/** Stages 1 and 2. Returns the pre-stage-2 snapshot when stage 2 applied, false to stop. */
async function runDesignStages(
  deps: PipelineDeps,
  session: Session,
  stages: readonly AiStage[],
): Promise<{ snapshot: DiagramSide | null } | false> {
  if (stages.includes("requirements")) {
    const opened = session.current();
    if (!opened) {
      return false;
    }
    deps.run.setStage("requirements");
    const result = await session.request("requirements", requirementsInput(opened.brief));
    if (!result.ok) {
      session.fail("requirements", result.message);
      return false;
    }
    const latest = session.current();
    if (!latest) {
      return false;
    }
    const brief = applyRequirements(latest.brief, result.value);
    deps.apply({ brief });
    if (brief.questions.length > 0) {
      return false;
    }
  }
  if (!stages.includes("components")) {
    return { snapshot: null };
  }

  const before = session.current();
  if (!before) {
    return false;
  }
  deps.run.setStage("components");
  if (before.nodes.some((node) => node.type === "architecture")) {
    try {
      await deps.createVersion(VERSION_LABEL);
    } catch (error) {
      // Never replace a design whose previous version could not be saved.
      session.fail("components", errorMessage(error));
      return false;
    }
  }
  const opened = session.current();
  if (!opened) {
    return false;
  }
  const snapshot = { nodes: opened.nodes, edges: opened.edges };
  const result = await session.request("components", {
    context: buildDesignContext(opened.brief),
    previousKeys: opened.nodes.filter(isGenerated).map((node) => node.id),
  });
  if (!result.ok) {
    session.fail("components", result.message);
    return false;
  }
  const latest = session.current();
  if (!latest) {
    return false;
  }
  const applied = applyComponents(latest, result.value, deps.now());
  deps.run.addWarnings(applied.warnings);
  if (!applied.ok) {
    deps.run.setError("components", NO_COMPONENTS_ERROR);
    return false;
  }
  deps.apply({
    nodes: applied.nodes,
    edges: applied.edges,
    flows: applied.flows,
    brief: applied.brief,
  });
  return { snapshot };
}

/** Runs the first out-of-date stage and every stage after it (spec 3.2). */
export async function runPipeline(
  deps: PipelineDeps,
  options: { decisionConcurrency?: number } = {},
): Promise<void> {
  const opened = deps.diagram();
  if (!opened.brief) {
    return;
  }
  const stages = nextStages(opened.brief, opened.nodes, opened.edges);
  if (stages.length === 0) {
    return;
  }
  const session = beginRun(deps, stages);
  if (!session) {
    return;
  }
  try {
    const designed = await runDesignStages(deps, session, stages);
    if (!designed) {
      return;
    }
    const runDecisionsStage = stages.includes("decisions");
    const runApiStage = stages.includes("api");
    const base = session.current();
    if (!base) {
      return;
    }
    if (runDecisionsStage || runApiStage) {
      // Both stages record the graph they ran against.
      const ranFrom = resultFingerprint(base.brief, base.nodes, base.edges);
      deps.run.setStage(runDecisionsStage ? "decisions" : "api");
      await Promise.all([
        runDecisionsStage
          ? runDecisions(deps, session, base, ranFrom, options.decisionConcurrency ?? Infinity)
          : undefined,
        runApiStage ? runApi(deps, session, base, ranFrom) : undefined,
      ]);
    }
    const finished = session.current();
    if (designed.snapshot && finished) {
      summarizeChange(deps, designed.snapshot, finished);
    }
  } finally {
    session.end();
  }
}

/** "Regenerate reasoning" for one node. Leaves `ranFrom.decisions` alone. */
export async function runDecision(deps: PipelineDeps, nodeId: string): Promise<void> {
  const opened = deps.diagram();
  const node = opened.nodes.find((entry) => entry.id === nodeId);
  if (!node || !opened.brief || !decisionInput({ ...opened, brief: opened.brief }, node)) {
    return;
  }
  const session = beginRun(deps, ["decisions"]);
  if (!session) {
    return;
  }
  try {
    const base = session.current();
    const input = base ? decisionInput(base, node) : undefined;
    if (!input) {
      return;
    }
    deps.run.setStage("decisions");
    deps.run.setDecisionProgress(0, 1);
    const result = await session.request("decisions", input);
    if (!result.ok) {
      session.fail("decisions", result.message);
      return;
    }
    const latest = session.current();
    if (!latest) {
      return;
    }
    deps.apply({ nodes: applyDecision(latest.nodes, nodeId, result.value), brief: latest.brief });
    deps.run.setDecisionProgress(1, 1);
  } finally {
    session.end();
  }
}

/** Stage 5, which only runs on request. */
export async function runDataModel(deps: PipelineDeps): Promise<void> {
  const session = beginRun(deps, ["data-model"]);
  if (!session) {
    return;
  }
  try {
    const base = session.current();
    if (!base) {
      return;
    }
    deps.run.setStage("data-model");
    const ranFrom = resultFingerprint(base.brief, base.nodes, base.edges);
    const result = await session.request("data-model", {
      context: buildDesignContext(base.brief),
      graph: graphSummary(base.nodes, base.edges),
      endpoints:
        base.brief.api?.endpoints.map(({ service, method, path }) => ({ service, method, path })) ??
        [],
    });
    if (!result.ok) {
      session.fail("data-model", result.message);
      return;
    }
    const latest = session.current();
    if (latest) {
      deps.apply({ brief: applyDataModel(latest.brief, result.value, ranFrom) });
    }
  } finally {
    session.end();
  }
}

// --- Hook ---

function storeDeps(): PipelineDeps {
  return {
    api: aiApi,
    diagram: () => {
      const { nodes, edges, flows, brief } = useDiagramStore.getState();
      return { id: cloudWorkspace.getState().diagram?.id ?? null, nodes, edges, flows, brief };
    },
    apply: (next) => useDiagramStore.getState().applyAiResult(next),
    createVersion: (label) => cloudWorkspace.createVersion(label),
    run: useAiDesignStore.getState(),
    now: () => new Date().toISOString(),
    historyEntry: () => {
      const { history, historyIndex } = useDiagramStore.getState();
      return history[historyIndex];
    },
    undo: () => useDiagramStore.getState().undo(),
  };
}

const pipeline = {
  update: () => runPipeline(storeDeps()),
  regenerateDecision: (nodeId: string) => runDecision(storeDeps(), nodeId),
  generateDataModel: () => runDataModel(storeDeps()),
  /**
   * Clears the stage's error and runs again. `nextStages` already starts at the first out-of-date
   * stage; the data model is never part of an update, so its retry runs it directly.
   */
  retry: (stage: AiStage) => {
    useAiDesignStore.getState().setError(stage, null);
    return stage === "data-model" ? runDataModel(storeDeps()) : runPipeline(storeDeps());
  },
  cancel: () => useAiDesignStore.getState().cancel(),
};

/** Cancels the run when the user is no longer on the diagram it belongs to. */
export function cancelIfDiagramChanged(activeDiagramId: string | null): void {
  const run = useAiDesignStore.getState();
  if (run.running && run.diagramId !== activeDiagramId) {
    run.cancel();
  }
}

export function useDesignPipeline(): {
  update(): Promise<void>;
  regenerateDecision(nodeId: string): Promise<void>;
  generateDataModel(): Promise<void>;
  retry(stage: AiStage): Promise<void>;
  cancel(): void;
} {
  useEffect(
    () =>
      cloudWorkspace.subscribe(() =>
        cancelIfDiagramChanged(cloudWorkspace.getState().diagram?.id ?? null),
      ),
    [],
  );
  return pipeline;
}
