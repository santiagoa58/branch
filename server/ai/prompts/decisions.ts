import type { DecisionsInput } from "../../../src/schemas/aiDesign";
import { urlShortenerExample } from "../examples/urlShortener";
import {
  example,
  formatContext,
  joinSections,
  section,
  DESIGN_PREAMBLE,
  type StagePrompt,
} from "./shared";

type Neighbours = DecisionsInput["neighbours"];

function nodeSections(
  summary: string,
  node: DecisionsInput["node"],
  neighbours: Neighbours,
): string {
  return joinSections(
    `Design summary: ${summary}`,
    section("Component to explain:", [
      `key: ${node.key}`,
      `type: ${node.type}`,
      `label: ${node.label}`,
      ...(node.responsibility ? [`responsibility: ${node.responsibility}`] : []),
    ]),
    section(
      "Its connections:",
      neighbours.map(
        ({ key, label, type, protocol, direction }) =>
          `${direction === "in" ? "from" : "to"} ${key} (${label}, ${type}) over ${protocol}`,
      ),
    ),
  );
}

// The example decision's input: the example node and its neighbours in the example graph.
function exampleInput(): string {
  const { context, components, decision } = urlShortenerExample;
  const byKey = new Map(components.components.map((component) => [component.key, component]));
  const node = byKey.get(decision.key);
  if (!node) {
    throw new Error(`The example has no component "${decision.key}"`);
  }
  const neighbours = components.connections.flatMap(({ from, to, protocol }): Neighbours => {
    const direction = to === node.key ? "in" : from === node.key ? "out" : undefined;
    const other = byKey.get(direction === "in" ? from : to);
    return direction && other
      ? [{ key: other.key, type: other.type, label: other.label, protocol, direction }]
      : [];
  });
  return joinSections(formatContext(context), nodeSections(components.summary, node, neighbours));
}

const SYSTEM = joinSections(
  DESIGN_PREAMBLE,
  `Your task: explain the design decision behind this one component, as you would to an interviewer. Explain only this component; the others get their own explanation.
- choice: the concrete technology or approach, in a few words.
- reason: one sentence tying the choice to the requirements.
- gains and costs: short phrases. Include only the most significant, usually one or two each.
- considered: the main alternatives. Every option has a whyNot, a short phrase.
- revisitWhen: conditions under which you would change this choice. Short phrases.`,
  example(exampleInput(), urlShortenerExample.decision.output),
);

export function buildDecisionsPrompt(input: DecisionsInput): StagePrompt {
  return {
    system: SYSTEM,
    prompt: joinSections(
      formatContext(input.context),
      nodeSections(input.summary, input.node, input.neighbours),
    ),
  };
}
