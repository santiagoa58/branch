import { useDiagramStore } from "@/store/diagramStore";
import { requireCondition } from "@/utils/aiDesign/inputs";

const normalise = (text: string) => text.trim().toLowerCase();
const newId = () => crypto.randomUUID();

/**
 * Props that let a decision editor turn "Revisit when" items into brief requirements. Empty
 * without a brief, so hand-made diagrams keep the plain editor.
 */
export function useRequireCondition() {
  const brief = useDiagramStore((state) => state.brief);
  const updateBrief = useDiagramStore((state) => state.updateBrief);
  if (!brief) {
    return {};
  }
  const required = new Set(brief.inputs.requirements.map((line) => normalise(line.text)));
  return {
    onRequireCondition: (text: string) =>
      updateBrief((current) => (current ? requireCondition(current, text, newId) : current)),
    isConditionRequired: (text: string) => required.has(normalise(text)),
  };
}
