import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useDesignPipeline } from "@/hooks/useDesignPipeline";
import { cn } from "@/lib/utils";
import { useDiagramStore } from "@/store/diagramStore";
import { outdatedStages } from "@/utils/aiDesign/fingerprint";
import { tagClass } from "./briefEdits";
import { labelLookup } from "./nodeLabels";

/** The Data model tab: an empty state with Generate data model, then the entities. */
export function DataModelTab() {
  const pipeline = useDesignPipeline();
  const brief = useDiagramStore((state) => state.brief);
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const labelOf = useMemo(() => labelLookup(nodes), [nodes]);
  const outdated = useMemo(
    () => (brief ? outdatedStages(brief, nodes, edges).dataModel : false),
    [brief, nodes, edges],
  );
  const dataModel = brief?.dataModel;

  if (!dataModel) {
    return (
      <div className="flex flex-col items-start gap-2.5 rounded-lg border border-dashed border-border p-4">
        <p className="text-sm font-semibold">No data model yet</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Generate entities, keys and relations for this design when you need them.
        </p>
        <Button size="sm" onClick={() => void pipeline.generateDataModel()}>
          Generate data model
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {outdated && (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-attention/40 bg-attention/10 px-3 py-2">
          <p className="flex items-center gap-2 text-xs text-foreground">
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-attention" />
            This data model is out of date: the design changed after it was generated.
          </p>
          <Button variant="outline" size="sm" onClick={() => void pipeline.generateDataModel()}>
            Regenerate data model
          </Button>
        </div>
      )}
      {dataModel.entities.length === 0 && (
        <p className="text-xs text-muted-foreground">The data model has no entities.</p>
      )}
      {dataModel.entities.map((entity) => (
        <article
          key={entity.name}
          aria-label={entity.name}
          className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-card px-3 py-2.5 text-card-foreground"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="min-w-0 wrap-anywhere text-sm font-semibold">{entity.name}</h3>
            <span className="shrink-0 text-[11.5px] text-muted-foreground">
              in {labelOf(entity.store)}
            </span>
          </div>
          <ul className="flex flex-col gap-0.5">
            {entity.fields.map((field) => (
              <li
                key={field.name}
                className="flex min-w-0 items-center gap-1.5 font-mono text-[11.5px]"
              >
                <span className="wrap-anywhere">
                  {field.name}: {field.type}
                </span>
                {field.key && <span className={cn(tagClass, "font-sans")}>{field.key}</span>}
              </li>
            ))}
          </ul>
          {entity.relations.length > 0 && (
            <ul
              aria-label="Relations"
              className="flex flex-col gap-0.5 text-[11.5px] text-muted-foreground"
            >
              {entity.relations.map((relation) => (
                <li key={`${relation.kind}:${relation.to}`}>
                  {relation.kind} → {relation.to}
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </div>
  );
}
