import { useState } from "react";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import type { ArchitectureAttribute, DesignDecision } from "@/types";
import { useDiagramStore } from "@/store/diagramStore";
import { formatArchitectureAttribute } from "@/utils/architectureAttributes";
import { DesignDecisionSummary } from "@/components/ui/DesignDecisionSummary";
import { DesignDecisionEditor } from "@/components/ui/DesignDecisionEditor";
import { ArchitectureFactsEditor } from "@/components/ui/ArchitectureFactsEditor";
import { RegenerateReasoningButton } from "./RegenerateReasoningButton";
import { useMakeRequirement } from "./useMakeRequirement";

interface Props {
  value: DesignDecision | undefined;
  onChange: (decision: DesignDecision) => void;
  /** Component attributes can be read or edited alongside the decision. */
  attributes?: ArchitectureAttribute[];
  onAttributesChange?: (attributes: ArchitectureAttribute[]) => void;
  nodeId?: string;
}

/**
 * The right inspector is the only decision surface. Reading is the default; editing continues
 * through the existing store actions (and therefore the normal persistence/history workflow).
 * The parent keys this component by selection so edits never follow a different node or edge.
 */
export function DecisionInspector({
  value,
  onChange,
  attributes,
  onAttributesChange,
  nodeId,
}: Props) {
  const [editing, setEditing] = useState(false);
  const aiDesign = useDiagramStore((state) => state.brief !== null);
  const requireProps = useMakeRequirement();

  return (
    <section aria-label="Decision details" className="min-w-0 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          {editing ? "Edit decision" : "Decision & tradeoffs"}
        </h3>
        <button
          type="button"
          aria-label={editing ? "Done editing decision" : "Edit decision"}
          onClick={() => setEditing((current) => !current)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
        >
          {!editing && <PencilSquareIcon aria-hidden="true" className="size-4" />}
          {editing ? "Done" : "Edit"}
        </button>
      </div>

      {editing ? (
        <div className="min-w-0 space-y-6">
          <DesignDecisionEditor value={value} onChange={onChange} {...requireProps} />
          {nodeId && <RegenerateReasoningButton nodeId={nodeId} />}
          {attributes && onAttributesChange && (
            <ArchitectureFactsEditor attributes={attributes} onChange={onAttributesChange} />
          )}
        </div>
      ) : (
        <div className="min-w-0 space-y-5">
          <DesignDecisionSummary value={value} compact stacked assumptions={aiDesign} />
          {attributes && attributes.length > 0 && (
            <section aria-label="Architecture attributes" className="min-w-0 space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground">
                Architecture attributes
              </h4>
              <dl className="divide-y divide-border rounded-lg border border-border px-3">
                {attributes.map((attribute) => (
                  <div key={attribute.name} className="grid min-w-0 grid-cols-2 gap-3 py-2 text-xs">
                    <dt className="wrap-anywhere text-muted-foreground">{attribute.name}</dt>
                    <dd className="wrap-anywhere text-right font-mono text-foreground">
                      {formatArchitectureAttribute(attribute)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      )}
    </section>
  );
}
