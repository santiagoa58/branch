import type { RequirementsInput } from "../../../src/schemas/aiDesign";
import { joinSections, scopeLine, section, SYSTEM_PREAMBLE, type StagePrompt } from "./shared";

// The design is generated in one run (`askQuestions: false`): stage 1 settles the requirements
// itself, and the user reviews and edits its assumptions afterwards.
const SYSTEM = joinSections(
  SYSTEM_PREAMBLE,
  `Your task: settle the requirements before anything is designed, in one pass, without asking the user anything.
The user's requirement and out-of-scope lines are fixed. Never restate or reword them; add only derived items around them.
- questions: "questions" is always an empty list. Ask nothing: the user is not asked in this flow.
- requirements: requirements derived from the prompt and the answers. Each has a "kind" (functional, nonFunctional or constraint) and its "text"; give nonFunctional ones a "category" too.
- assumptions: every decision you made for the user, each with a "kind" and its "text". The user reviews them after the design is generated.
- outOfScope: things you are deliberately leaving out, one string each.`,
  `Rules:
- Ask nothing. Decide everything that is open yourself, as a strong candidate would, and list each decision as an assumption. That includes anything that changes which components exist or a major technology choice, such as scale, latency, consistency or platforms.
- Each assumption is one short statement of what you decided, such as "About 1M households" or "Members see each other's changes instantly".
- Answered questions: never re-ask them. Turn each answer into derived requirements. An answer marked (assumed) becomes an assumption instead.
- Conflicts: when the user's lines conflict with an earlier assumption, drop the assumption.
- Ambiguous inputs: when two user lines conflict with each other, choose the reading that fits the rest of the brief and list that choice as an assumption.`,
);

export function buildRequirementsPrompt(input: RequirementsInput): StagePrompt {
  return {
    system: SYSTEM,
    prompt: joinSections(
      `System to design: ${input.prompt}`,
      scopeLine(input.scope),
      section(
        "Requirements (user lines):",
        input.requirements.map(
          (line) => `[${line.kind}${line.category ? `, ${line.category}` : ""}] ${line.text}`,
        ),
      ),
      section("Out of scope (user lines):", input.outOfScope),
      section(
        "Answers:",
        input.answers.map(
          ({ question, answer, assumed }) =>
            `Q: ${question}\n  A: ${answer}${assumed ? " (assumed)" : ""}`,
        ),
      ),
      // `askQuestions` is always false, so the request repeats the rule next to the inputs.
      "Ask nothing: assume what is open and list it as assumptions.",
    ),
  };
}
