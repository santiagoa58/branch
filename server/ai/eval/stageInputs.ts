import type {
  ApiInput,
  ApiOutput,
  ComponentsInput,
  ComponentsOutput,
  DataModelInput,
  DecisionsInput,
  DesignContext,
  RequirementsOutput,
} from "../../../src/schemas/aiDesign";
import { applyComponents } from "../../../src/utils/aiDesign/applyComponents";
import { applyRequirements } from "../../../src/utils/aiDesign/applyRequirements";
import {
  buildDesignContext,
  createBrief,
  decisionInput,
  graphSummary,
  type StageDesign,
} from "../../../src/utils/aiDesign/inputs";
import type { EvalCase } from "./fixtures";

// Builds the inputs of stages 2 to 5 with the browser pipeline's own code: the stage outputs are
// applied as src/hooks/useDesignPipeline.ts applies them, and the inputs come from the diagram that
// results. Those modules are pure; none touches the browser, a store or React.

const EVAL_NOW = "2026-01-01T00:00:00.000Z";

function evalIds() {
  let n = 0;
  return () => `eval-${++n}`;
}

/** The settled problem statement: the user's lines, then stage 1's derived items and assumptions. */
export function contextFrom(c: EvalCase, out?: RequirementsOutput): DesignContext {
  const { prompt, scope, requirements, outOfScope } = c.input;
  const brief = createBrief(prompt, scope, requirements, outOfScope, evalIds());
  return buildDesignContext(out ? applyRequirements(brief, out) : brief);
}

export function componentsInput(context: DesignContext): ComponentsInput {
  return { context, previousKeys: [] };
}

/** Applies stage 2's output to an empty canvas, as the pipeline does, and reads the design back. */
function designFrom(context: DesignContext, components: ComponentsOutput): StageDesign {
  // applyComponents only carries the brief through; the context is passed on separately.
  const brief = createBrief(context.prompt, context.scope, [], [], evalIds());
  const applied = applyComponents({ nodes: [], edges: [], flows: [], brief }, components, EVAL_NOW);
  if (!applied.ok) {
    throw new Error(`The design has no usable components: ${applied.warnings.join(" ")}`);
  }
  return {
    context,
    summary: applied.brief.summary ?? "",
    nodes: applied.nodes,
    edges: applied.edges,
  };
}

/** One input per component and group, as the pipeline sends one decisions call per node. */
export function decisionsInputs(
  context: DesignContext,
  components: ComponentsOutput,
): DecisionsInput[] {
  const design = designFrom(context, components);
  return design.nodes.flatMap((node) => {
    const input = decisionInput(design, node);
    return input ? [input] : [];
  });
}

export function apiInput(context: DesignContext, components: ComponentsOutput): ApiInput {
  const { summary, nodes, edges } = designFrom(context, components);
  return { context, summary, graph: graphSummary(nodes, edges) };
}

export function dataModelInput(
  context: DesignContext,
  components: ComponentsOutput,
  api: ApiOutput,
): DataModelInput {
  const { nodes, edges } = designFrom(context, components);
  return {
    context,
    graph: graphSummary(nodes, edges),
    endpoints: api.endpoints.map(({ service, method, path }) => ({ service, method, path })),
  };
}
