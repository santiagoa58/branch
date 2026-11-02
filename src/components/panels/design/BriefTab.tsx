import { useDiagramStore } from "@/store/diagramStore";
import { BriefSections } from "./BriefSections";
import { Composer } from "./Composer";
import { Questions } from "./Questions";

/**
 * The Brief tab: the composer while the diagram has no brief; otherwise stage 1's open questions
 * (the next step when there are any) above the requirements, assumptions and out-of-scope lines.
 */
export function BriefTab() {
  const brief = useDiagramStore((state) => state.brief);
  if (!brief) {
    return <Composer />;
  }
  return (
    <div className="flex flex-col gap-6">
      {brief.questions.length > 0 && <Questions brief={brief} />}
      <BriefSections brief={brief} />
    </div>
  );
}
