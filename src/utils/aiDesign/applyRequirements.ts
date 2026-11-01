import type { DesignBrief, RequirementsOutput } from "@/schemas/aiDesign";
import { inputsFingerprint } from "./fingerprint";

const normalize = (text: string) => text.trim().toLowerCase();

/**
 * Stage 1: replace the derived fields with the model output, dropping items that exactly
 * repeat a line the user wrote. Other stages' fingerprints are left alone.
 */
export function applyRequirements(brief: DesignBrief, output: RequirementsOutput): DesignBrief {
  const userRequirements = new Set(brief.inputs.requirements.map((r) => normalize(r.text)));
  const userOutOfScope = new Set(brief.inputs.outOfScope.map((o) => normalize(o.text)));
  return {
    ...brief,
    questions: output.questions,
    requirements: output.requirements.filter((r) => !userRequirements.has(normalize(r.text))),
    assumptions: output.assumptions,
    outOfScope: output.outOfScope.filter((text) => !userOutOfScope.has(normalize(text))),
    ranFrom: { ...brief.ranFrom, requirements: inputsFingerprint(brief.inputs) },
  };
}
