import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDesignPipeline } from "@/hooks/useDesignPipeline";
import { cn } from "@/lib/utils";
import { aiStageSchema, type AiStage } from "@/schemas/aiDesign";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useDiagramStore } from "@/store/diagramStore";
import { nextStages, type PipelineStage } from "@/utils/aiDesign/fingerprint";
import { keyedByText } from "./briefEdits";

/** How each stage is named in the panel. */
const STAGE_LABELS: Record<AiStage, string> = {
  requirements: "Requirements",
  components: "Components",
  decisions: "Reasoning",
  api: "API",
  "data-model": "Data model",
};

// Mid-sentence names: "API" keeps its capitals.
const SENTENCE_NAMES: Record<PipelineStage, string> = {
  requirements: "requirements",
  components: "components",
  decisions: "reasoning",
  api: "API",
};

export const REPLACEMENT_NOTICE = "The current design is replaced; a version is saved first.";

/** "Requirements, components, reasoning and API will update", built from the stages that run. */
export function updateMessage(stages: readonly PipelineStage[]): string {
  const names = stages.map((stage) => SENTENCE_NAMES[stage]);
  const last = names.pop();
  const list = names.length > 0 ? `${names.join(", ")} and ${last}` : (last ?? "");
  return `${list.charAt(0).toUpperCase()}${list.slice(1)} will update`;
}

/**
 * Pinned to the bottom of the panel while anything is out of date. Hidden during a run and while
 * stage 1 has open questions: answering them is the next step then.
 */
export function UpdateBar() {
  const pipeline = useDesignPipeline();
  const running = useAiDesignStore((state) => state.running);
  const brief = useDiagramStore((state) => state.brief);
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);

  // Fingerprinting hashes the graph; redo it only when the brief or the graph changes.
  const stages = useMemo(
    () => (brief ? nextStages(brief, nodes, edges) : []),
    [brief, nodes, edges],
  );
  if (!brief || running || brief.questions.length > 0 || stages.length === 0) {
    return null;
  }
  const replaces =
    stages.includes("components") && nodes.some((node) => node.type === "architecture");

  return (
    <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 px-4 py-3 flex flex-col gap-2">
      <p className="text-xs font-semibold text-foreground">{updateMessage(stages)}</p>
      {replaces && (
        <p className="text-xs leading-relaxed text-muted-foreground">{REPLACEMENT_NOTICE}</p>
      )}
      <Button onClick={() => void pipeline.update()}>Update design</Button>
    </div>
  );
}

/** The stepper shown while a run is in progress, with Cancel. */
export function RunProgress() {
  const pipeline = useDesignPipeline();
  const stage = useAiDesignStore((state) => state.stage);
  const planned = useAiDesignStore((state) => state.plannedStages);
  const decisions = useAiDesignStore((state) => state.decisions);

  // Only the stages this run goes through: an update after a graph edit starts at reasoning.
  const steps: readonly AiStage[] = planned.length > 0 ? planned : stage ? [stage] : [];
  // Before the first stage is set, the run is starting on its first step.
  const current = stage ? Math.max(0, steps.indexOf(stage)) : 0;
  const label = (step: AiStage) =>
    step === "decisions" && decisions.total > 0
      ? `${STAGE_LABELS[step]} ${decisions.done}/${decisions.total}`
      : STAGE_LABELS[step];

  return (
    <div className="flex flex-col gap-4 p-4">
      <ol aria-label="Design progress" className="flex flex-col gap-2.5">
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li
              key={step}
              aria-current={active ? "step" : undefined}
              className="flex items-center gap-2 text-sm"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-2 border-primary",
                  !done && !active && "border-zinc-300 dark:border-zinc-700",
                )}
              >
                {done && <Check className="size-3" />}
                {active && <span className="size-1.5 rounded-full bg-primary" />}
              </span>
              <span
                className={cn(
                  done && "text-foreground",
                  active && "font-semibold text-foreground",
                  !done && !active && "text-muted-foreground",
                )}
              >
                {label(step)}
              </span>
              {done && <span className="sr-only">(done)</span>}
              {active && <span className="sr-only">(in progress)</span>}
            </li>
          );
        })}
      </ol>
      <Button variant="outline" className="self-start" onClick={() => pipeline.cancel()}>
        Cancel
      </Button>
    </div>
  );
}

/** Stage errors with Retry, and the warnings of the last run until dismissed. */
export function RunNotes() {
  const pipeline = useDesignPipeline();
  const errors = useAiDesignStore((state) => state.errors);
  const warnings = useAiDesignStore((state) => state.warnings);
  // Dismissal belongs to one list of warnings; the next run brings a new list.
  const [dismissed, setDismissed] = useState<readonly string[] | null>(null);

  const failed = aiStageSchema.options.flatMap((stage) => {
    const message = errors[stage];
    return message === undefined ? [] : [{ stage, message }];
  });
  const showWarnings = warnings.length > 0 && dismissed !== warnings;
  if (failed.length === 0 && !showWarnings) {
    return null;
  }

  return (
    <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 flex flex-col gap-2">
      {failed.map(({ stage, message }) => (
        <div
          key={stage}
          role="alert"
          className="flex items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2"
        >
          <p className="min-w-0 text-xs leading-relaxed text-foreground">
            <span className="font-semibold">{STAGE_LABELS[stage]}</span>
            <span className="sr-only">:</span> <span className="wrap-anywhere">{message}</span>
          </p>
          <Button
            variant="outline"
            size="sm"
            aria-label={`Retry ${STAGE_LABELS[stage]}`}
            onClick={() => void pipeline.retry(stage)}
          >
            Retry
          </Button>
        </div>
      ))}
      {showWarnings && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-attention/40 bg-attention/10 px-3 py-2">
          <ul className="min-w-0 flex flex-col gap-1 text-xs leading-relaxed text-foreground">
            {keyedByText(warnings, (warning) => warning).map(({ key, item: warning }) => (
              <li key={key} className="wrap-anywhere">
                {warning}
              </li>
            ))}
          </ul>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Dismiss warnings"
            onClick={() => setDismissed(warnings)}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}
