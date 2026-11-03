import { useDiagramStore } from "@/store/diagramStore";
import { makeRequirement, normalizeText } from "@/utils/aiDesign/inputs";
import { editBrief, newId } from "./design/briefEdits";

/**
 * Props that let a decision editor show its items as the assumptions the choice rests on and turn
 * one into a brief requirement. Empty without a brief, so hand-made diagrams keep the plain editor.
 */
export function useMakeRequirement() {
  const brief = useDiagramStore((state) => state.brief);
  if (!brief) {
    return {};
  }
  const requirements = new Set(brief.inputs.requirements.map((line) => normalizeText(line.text)));
  return {
    onMakeRequirement: (text: string) =>
      editBrief((current) => makeRequirement(current, text, newId)),
    isRequirement: (text: string) => requirements.has(normalizeText(text)),
  };
}
