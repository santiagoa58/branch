import { useDesignPipeline } from "@/hooks/useDesignPipeline";
import { useDiagramStore } from "@/store/diagramStore";
import { briefFromDraft } from "@/utils/aiDesign/inputs";
import { BriefForm, emptyDraft } from "./BriefForm";
import { newId } from "./briefEdits";

/** Shown while the diagram has no brief: the brief form, then Generate design runs every stage. */
export function Composer() {
  const pipeline = useDesignPipeline();
  // A design started on a hand-made diagram replaces its components.
  const replaces = useDiagramStore((state) =>
    state.nodes.some((node) => node.type === "architecture"),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      <BriefForm
        initial={emptyDraft()}
        action="Generate design"
        verb="generate"
        replaces={replaces}
        onSubmit={(draft) => {
          useDiagramStore.getState().updateBrief(() => briefFromDraft(draft, newId));
          void pipeline.update();
        }}
      />
    </div>
  );
}
