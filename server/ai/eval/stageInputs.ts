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
import type { EvalCase } from "./fixtures";

// Builds the inputs of stages 2 to 5 the way the browser pipeline does (src/utils/aiDesign/inputs.ts
// and src/hooks/useDesignPipeline.ts), without importing browser code into the server.

/** The settled problem statement: the user's lines, then stage 1's derived items and assumptions. */
export function contextFrom(c: EvalCase, out?: RequirementsOutput): DesignContext {
  const { prompt, scope, requirements, outOfScope } = c.input;
  return {
    prompt,
    scope,
    requirements: [
      ...requirements.map(({ kind, text }) => ({ kind, text, assumed: false })),
      ...(out?.requirements ?? []).map((requirement) => ({ ...requirement, assumed: false })),
      ...(out?.assumptions ?? []).map(({ kind, text }) => ({ kind, text, assumed: true })),
    ],
    outOfScope: [...outOfScope, ...(out?.outOfScope ?? [])],
  };
}

export function componentsInput(context: DesignContext): ComponentsInput {
  return { context, previousKeys: [] };
}

function graphOf(components: ComponentsOutput): ApiInput["graph"] {
  return {
    nodes: components.components.map(({ key, type, label }) => ({ key, type, label })),
    edges: components.connections.map(({ from, to, protocol, async }) => ({
      from,
      to,
      protocol,
      async,
    })),
  };
}

/** One input per component, as the pipeline sends one decisions call per node. */
export function decisionsInputs(
  context: DesignContext,
  components: ComponentsOutput,
): DecisionsInput[] {
  const byKey = new Map(components.components.map((component) => [component.key, component]));
  return components.components.map((node) => ({
    context,
    summary: components.summary,
    node: {
      key: node.key,
      type: node.type,
      label: node.label,
      responsibility: node.responsibility,
    },
    neighbours: components.connections.flatMap((edge): DecisionsInput["neighbours"] => {
      const direction = edge.from === node.key ? "out" : edge.to === node.key ? "in" : undefined;
      const other = byKey.get(direction === "out" ? edge.to : edge.from);
      return direction && other
        ? [
            {
              key: other.key,
              type: other.type,
              label: other.label,
              protocol: edge.protocol,
              direction,
            },
          ]
        : [];
    }),
  }));
}

export function apiInput(context: DesignContext, components: ComponentsOutput): ApiInput {
  return { context, summary: components.summary, graph: graphOf(components) };
}

export function dataModelInput(
  context: DesignContext,
  components: ComponentsOutput,
  api: ApiOutput,
): DataModelInput {
  return {
    context,
    graph: graphOf(components),
    endpoints: api.endpoints.map(({ service, method, path }) => ({ service, method, path })),
  };
}
