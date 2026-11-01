import type { DesignBrief, RequirementsOutput } from "@/schemas/aiDesign";
import { inputsFingerprint } from "./fingerprint";
import { normalizeText } from "./inputs";

/**
 * Stage 1: replace the derived fields with the model output, dropping items that exactly
 * repeat a line the user wrote. Other stages' fingerprints are left alone.
 */
export function applyRequirements(brief: DesignBrief, output: RequirementsOutput): DesignBrief {
  const userRequirements = new Set(brief.inputs.requirements.map((r) => normalizeText(r.text)));
  const userOutOfScope = new Set(brief.inputs.outOfScope.map((o) => normalizeText(o.text)));
  return {
    ...brief,
    questions: output.questions,
    requirements: output.requirements.filter((r) => !userRequirements.has(normalizeText(r.text))),
    assumptions: output.assumptions,
    outOfScope: output.outOfScope.filter((text) => !userOutOfScope.has(normalizeText(text))),
    ranFrom: { ...brief.ranFrom, requirements: inputsFingerprint(brief.inputs) },
  };
}
