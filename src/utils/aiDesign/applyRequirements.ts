import type { DesignBrief, RequirementsOutput } from "@/schemas/aiDesign";
import { inputsFingerprint } from "./fingerprint";
import { normalizeText } from "./inputs";

type Question = RequirementsOutput["questions"][number];
type Assumption = RequirementsOutput["assumptions"][number];

/** "Scale: About 1M households": a question settled with its recommended answer. */
function assumedAnswer(question: Question): Assumption | undefined {
  const answer = question.recommended.trim();
  if (!answer) {
    return undefined;
  }
  const topic = question.topic.trim();
  return { kind: "constraint", text: topic ? `${topic}: ${answer}` : answer };
}

/**
 * The design runs in one go, so stage 1 is told to ask nothing. A question it returns anyway never
 * blocks the run: code assumes its recommended answer and lists it with the other assumptions,
 * where the user confirms or changes it. The inputs stay the user's own, so stage 1 stays fresh.
 */
function withAssumedQuestions(output: RequirementsOutput): Assumption[] {
  const seen = new Set(output.assumptions.map((entry) => normalizeText(entry.text)));
  const assumed = output.questions.flatMap((question) => {
    const assumption = assumedAnswer(question);
    if (!assumption || seen.has(normalizeText(assumption.text))) {
      return [];
    }
    seen.add(normalizeText(assumption.text));
    return [assumption];
  });
  return [...output.assumptions, ...assumed];
}

/**
 * Stage 1: replace the derived fields with the model output, dropping items that exactly repeat a
 * line the user wrote and assuming any question. Other stages' fingerprints are left alone.
 */
export function applyRequirements(brief: DesignBrief, output: RequirementsOutput): DesignBrief {
  const userRequirements = new Set(brief.inputs.requirements.map((r) => normalizeText(r.text)));
  const userOutOfScope = new Set(brief.inputs.outOfScope.map((o) => normalizeText(o.text)));
  return {
    ...brief,
    questions: [],
    requirements: output.requirements.filter((r) => !userRequirements.has(normalizeText(r.text))),
    assumptions: withAssumedQuestions(output),
    outOfScope: output.outOfScope.filter((text) => !userOutOfScope.has(normalizeText(text))),
    ranFrom: { ...brief.ranFrom, requirements: inputsFingerprint(brief.inputs) },
  };
}
