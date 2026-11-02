import type { Edge, Node } from "@xyflow/react";
import type { DesignBrief } from "@/schemas/aiDesign";
import { normalizeText } from "./inputs";

export type PipelineStage = "requirements" | "components" | "decisions" | "api";

const PIPELINE: readonly PipelineStage[] = ["requirements", "components", "decisions", "api"];

/** cyrb53: a synchronous, stable 53-bit string hash. Collisions are irrelevant at this scale. */
function cyrb53(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/** Sorts rows by their serialized form so list order never changes the hash. */
function sortRows<T>(rows: T[]): T[] {
  return rows
    .map((row) => ({ key: JSON.stringify(row), row }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((entry) => entry.row);
}

export function inputsFingerprint(inputs: DesignBrief["inputs"]): string {
  return cyrb53(
    JSON.stringify({
      prompt: normalizeText(inputs.prompt),
      scope: inputs.scope,
      requirements: sortRows(inputs.requirements.map((r) => [r.kind, normalizeText(r.text)])),
      outOfScope: inputs.outOfScope.map((o) => normalizeText(o.text)).sort(),
      answers: sortRows(
        inputs.answers.map((a) => [normalizeText(a.question), normalizeText(a.answer), a.assumed]),
      ),
    }),
  );
}

function nodeRow(node: Node): [string, string, string] | undefined {
  const data = (node.data ?? {}) as { type?: unknown; groupType?: unknown };
  if (node.type === "architecture") {
    return [node.id, typeof data.type === "string" ? data.type : "", node.parentId ?? ""];
  }
  if (node.type === "group") {
    return [node.id, typeof data.groupType === "string" ? data.groupType : "", node.parentId ?? ""];
  }
  return undefined;
}

export function graphFingerprint(nodes: Node[], edges: Edge[]): string {
  const nodeRows = nodes.flatMap((node) => {
    const row = nodeRow(node);
    return row ? [row] : [];
  });
  const edgeRows = edges.map((edge) => {
    const data = (edge.data ?? {}) as { protocol?: unknown; async?: unknown };
    return [
      edge.source,
      edge.target,
      typeof data.protocol === "string" ? data.protocol : "",
      data.async === true,
    ];
  });
  return cyrb53(JSON.stringify({ nodes: sortRows(nodeRows), edges: sortRows(edgeRows) }));
}

/** Recorded by stages 3 to 5: `${inputs}:${graph}`. */
export function resultFingerprint(brief: DesignBrief, nodes: Node[], edges: Edge[]): string {
  return `${inputsFingerprint(brief.inputs)}:${graphFingerprint(nodes, edges)}`;
}

export interface OutdatedStages {
  stages: PipelineStage[];
  dataModel: boolean;
}

/** `outdatedStages` against a precomputed `graphFingerprint`, so one graph hash serves any brief. */
export function outdatedAgainst(brief: DesignBrief, graph: string): OutdatedStages {
  const inputs = inputsFingerprint(brief.inputs);
  const result = `${inputs}:${graph}`;
  const expected: Record<PipelineStage, string> = {
    requirements: inputs,
    components: inputs,
    decisions: result,
    api: result,
  };
  return {
    stages: PIPELINE.filter((stage) => brief.ranFrom[stage] !== expected[stage]),
    dataModel: brief.dataModel !== undefined && brief.ranFrom.dataModel !== result,
  };
}

export function outdatedStages(brief: DesignBrief, nodes: Node[], edges: Edge[]): OutdatedStages {
  return outdatedAgainst(brief, graphFingerprint(nodes, edges));
}

/**
 * The stages an update should run, given the brief's outdated stages: the first outdated stage
 * and every stage after it. Stage 1 open questions stop the pipeline while requirements is fresh.
 */
export function stagesToRun(brief: DesignBrief, outdated: PipelineStage[]): PipelineStage[] {
  if (outdated.includes("requirements")) {
    return [...PIPELINE];
  }
  if (brief.questions.length > 0) {
    return [];
  }
  const first = outdated[0];
  return first ? PIPELINE.slice(PIPELINE.indexOf(first)) : [];
}

/** The stages an update should run for the brief against the graph. */
export function nextStages(brief: DesignBrief, nodes: Node[], edges: Edge[]): PipelineStage[] {
  return stagesToRun(brief, outdatedStages(brief, nodes, edges).stages);
}
