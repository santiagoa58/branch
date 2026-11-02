import type { DecisionsInput } from "../../../src/schemas/aiDesign";
import {
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

const SYSTEM = joinSections(
  DESIGN_PREAMBLE,
  `Your task: explain the design decision behind this one component, as you would to an interviewer. Explain only this component; the others get their own explanation.
- choice: the concrete technology or approach, in a few words.
- reason: one sentence tying the choice to the requirements.
- gains and costs: short phrases. Include only the most significant, usually one or two each.
- considered: the main alternatives. Every option has a whyNot, a short phrase.
- revisitWhen: the assumptions this choice rests on, which the user sees as "Assumes: ..." and can make requirements. Each is a short statement that holds today, such as "Links are only looked up by their short code"; if one stopped holding, you would change this choice. State what you assume, not the change that would break it.`,
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
