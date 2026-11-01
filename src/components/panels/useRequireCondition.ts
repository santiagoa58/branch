import { useDiagramStore } from "@/store/diagramStore";
import { normalizeText, requireCondition } from "@/utils/aiDesign/inputs";
import { editBrief, newId } from "./design/briefEdits";

/**
 * Props that let a decision editor turn "Revisit when" items into brief requirements. Empty
 * without a brief, so hand-made diagrams keep the plain editor.
 */
export function useRequireCondition() {
  const brief = useDiagramStore((state) => state.brief);
  if (!brief) {
    return {};
  }
  const required = new Set(brief.inputs.requirements.map((line) => normalizeText(line.text)));
  return {
    onRequireCondition: (text: string) =>
      editBrief((current) => requireCondition(current, text, newId)),
    isConditionRequired: (text: string) => required.has(normalizeText(text)),
  };
}
