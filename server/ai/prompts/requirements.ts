import type { RequirementsInput } from "../../../src/schemas/aiDesign";
import {
  joinSections,
  kindLabel,
  scopeLine,
  section,
  SYSTEM_PREAMBLE,
  type StagePrompt,
} from "./shared";

const SYSTEM = joinSections(
  SYSTEM_PREAMBLE,
  `Your task: clarify the requirements before anything is designed.
The user's requirement and out-of-scope lines are fixed. Never restate or reword them; add only derived items around them.
- questions: what you still need to know.
- requirements: requirements derived from the prompt and the answers. Give non-functional ones a category.
- assumptions: decisions you made for the user instead of asking.
- outOfScope: things you are deliberately leaving out.`,
  `Rules:
- When to ask: ask only when the answer changes which components exist or a major technology choice. Assume anything smaller and list it as an assumption.
- Answered questions: never re-ask them. Turn each answer into derived requirements. An answer marked (assumed) becomes an assumption instead.
- Conflicts: when the user's lines conflict with an earlier assumption, drop the assumption.
- Ambiguous inputs: when two user lines conflict with each other, ask a question about it.`,
  `Questions:
- Keep them few and short; "why" says what the answer changes in the design.
- Give two to four options, each with its impact, or no options for a free-text answer. Never give exactly one option.
- "recommended" is the answer you would assume if the user asks you to; it must be filled in.`,
);

export function buildRequirementsPrompt(input: RequirementsInput): StagePrompt {
  return {
    system: SYSTEM,
    prompt: joinSections(
      `System to design: ${input.prompt}`,
      scopeLine(input.scope),
      section(
        "Requirements (user lines):",
        input.requirements.map((line) => `[${kindLabel(line.kind)}] ${line.text}`),
      ),
      section("Out of scope (user lines):", input.outOfScope),
      section(
        "Answers:",
        input.answers.map(
          ({ question, answer, assumed }) =>
            `Q: ${question}\n  A: ${answer}${assumed ? " (assumed)" : ""}`,
        ),
      ),
    ),
  };
}
