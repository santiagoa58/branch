import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDesignPipeline } from "@/hooks/useDesignPipeline";
import type { DesignBrief } from "@/schemas/aiDesign";
import { useDiagramStore } from "@/store/diagramStore";
import { applyBriefDraft, draftOf, type BriefDraft } from "@/utils/aiDesign/inputs";
import { BriefForm } from "./BriefForm";
import { BriefSections } from "./BriefSections";
import { editBrief, newId } from "./briefEdits";
import { Composer } from "./Composer";

const sameInputs = (a: DesignBrief, b: DesignBrief) =>
  JSON.stringify(a.inputs) === JSON.stringify(b.inputs);

/**
 * "Edit all": the user's inputs as the same form the composer uses, so many lines change at once.
 * Update design records the whole change as one edit, then runs the stages it outdated.
 */
function EditAll({ brief, onClose }: { brief: DesignBrief; onClose: () => void }) {
  const pipeline = useDesignPipeline();
  const replaces = useDiagramStore((state) =>
    state.nodes.some((node) => node.type === "architecture"),
  );
  const save = (draft: BriefDraft) => {
    // One history entry for the whole change, and none for an unchanged form.
    const current = useDiagramStore.getState().brief;
    const next = current ? applyBriefDraft(current, draft, newId) : null;
    if (current && next && !sameInputs(next, current)) {
      editBrief(() => next);
    }
    onClose();
    void pipeline.update();
  };
  return (
    <section aria-label="Edit the brief" className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Edit any section, one item per line. The AI&apos;s own requirements and assumptions update
        with the design.
      </p>
      <BriefForm
        initial={draftOf(brief)}
        action="Update design"
        verb="update"
        replaces={replaces}
        onSubmit={save}
        onCancel={onClose}
      />
    </section>
  );
}

/**
 * The Brief tab: the composer while the diagram has no brief; otherwise the requirements, the
 * assumptions the AI made and the out-of-scope lines, each editable, or all at once in Edit all.
 */
export function BriefTab() {
  const brief = useDiagramStore((state) => state.brief);
  const [editingAll, setEditingAll] = useState(false);
  if (!brief) {
    return <Composer />;
  }
  if (editingAll) {
    return <EditAll brief={brief} onClose={() => setEditingAll(false)} />;
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setEditingAll(true)}>
          <Pencil aria-hidden="true" />
          Edit all
        </Button>
      </div>
      <BriefSections brief={brief} />
    </div>
  );
}
