import { useDiagramStore } from "@/store/diagramStore";
import { BriefSections } from "./BriefSections";
import { Composer } from "./Composer";

/**
 * The Brief tab: the composer while the diagram has no brief; otherwise the requirements, the
 * assumptions the AI made and the out-of-scope lines, all editable.
 */
export function BriefTab() {
  const brief = useDiagramStore((state) => state.brief);
  if (!brief) {
    return <Composer />;
  }
  return <BriefSections brief={brief} />;
}
