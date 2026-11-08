import { useEffect, useState } from "react";
import { TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/ui/loading";
import { useDesignPipeline } from "@/hooks/useDesignPipeline";
import { cn } from "@/lib/utils";
import type { AiStage } from "@/schemas/aiDesign";
import { useAiDesignStore } from "@/store/aiDesignStore";

/**
 * How long a stage may go without progress before the run is flagged as taking longer than usual.
 * A stage is one request (reasoning is one per component, and each one that lands counts as
 * progress), and the server makes at most two model calls per request, so a healthy stage
 * reports back well within this. 45 s is long enough not to flag a slow but working model, and
 * short enough that a hung request is flagged long before the request timeout gives up.
 */
export const STALL_THRESHOLD_MS = 45_000;

/** How often the elapsed time and the stall check update. */
const TICK_MS = 1000;

const STALLED_NOTE = "Taking longer than usual…";

/** What the run is doing during each stage, in plain words. */
const STAGE_ACTIVITY: Record<AiStage, string> = {
  requirements: "Clarifying requirements",
  components: "Choosing components",
  decisions: "Explaining decisions",
  api: "Designing the API",
  "data-model": "Designing the data model",
};

function activity(stage: AiStage | null, decisions: { done: number; total: number }): string {
  if (!stage) {
    return "Starting the AI design";
  }
  return stage === "decisions" && decisions.total > 0
    ? `${STAGE_ACTIVITY[stage]} ${decisions.done}/${decisions.total}`
    : STAGE_ACTIVITY[stage];
}

/** "0:07", "1:05". */
function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The current run's activity, the time spent on its stage, and whether that stage has gone
 * {@link STALL_THRESHOLD_MS} without progress. Mount it only during a run: its clock starts when
 * it mounts and stops when it unmounts.
 */
function useRunStatus() {
  const stage = useAiDesignStore((state) => state.stage);
  const decisions = useAiDesignStore((state) => state.decisions);
  const stageStartedAt = useAiDesignStore((state) => state.stageStartedAt);
  const progressAt = useAiDesignStore((state) => state.progressAt);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return {
    activity: activity(stage, decisions),
    elapsed: formatElapsed(now - (stageStartedAt ?? now)),
    stalled: progressAt !== null && now - progressAt >= STALL_THRESHOLD_MS,
  };
}

/** Decorative: pulsing dots while working (static under reduced motion), a warning once stalled. */
function ActivityMark({ stalled, className }: { stalled: boolean; className?: string }) {
  return stalled ? (
    <TriangleAlert aria-hidden="true" className={cn("size-4 shrink-0 text-attention", className)} />
  ) : (
    <LoadingIndicator className={cn("text-primary", className)} />
  );
}

/** The elapsed time, outside any live region so its ticks are not announced. */
function Elapsed({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn("shrink-0 text-xs tabular-nums text-muted-foreground", className)}>
      <span>{value}</span>
      <span className="sr-only"> on this stage</span>
    </span>
  );
}

function PanelStatus() {
  const pipeline = useDesignPipeline();
  const { activity: doing, elapsed, stalled } = useRunStatus();
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border px-3 py-2.5",
        stalled
          ? "border-attention/40 bg-attention/10"
          : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60",
      )}
    >
      <div className="flex items-start gap-2.5">
        <ActivityMark stalled={stalled} className="mt-0.5" />
        {/* `output` is a status region (role="status"); it announces stage changes politely. */}
        <output aria-live="polite" className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold text-foreground">{doing}</span>
          {stalled && <span className="text-xs text-muted-foreground">{STALLED_NOTE}</span>}
        </output>
        <Elapsed value={elapsed} className="mt-0.5" />
      </div>
      <div className="flex items-center gap-2">
        {stalled && (
          <Button size="sm" onClick={() => void pipeline.restart()}>
            Retry
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => pipeline.cancel()}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/**
 * The design panel's run indicator: what the run is doing, for how long, and Cancel; once a stage
 * stalls, it says so and offers Retry. Its live region announces stage changes.
 */
export function RunStatus() {
  const running = useAiDesignStore((state) => state.running);
  return running ? <PanelStatus /> : null;
}

function ToolbarStatus() {
  const pipeline = useDesignPipeline();
  const { activity: doing, elapsed, stalled } = useRunStatus();
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-md border py-1 pr-1 pl-2 text-xs",
        stalled
          ? "border-attention/40 bg-attention/10"
          : "border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900",
      )}
    >
      <ActivityMark stalled={stalled} className="size-3.5" />
      {/* The panel's status announces stage changes; this copy stays quiet to avoid repeats. */}
      <span className="hidden min-w-0 flex-col leading-tight md:flex">
        <span className="truncate font-medium text-foreground">{doing}</span>
        {stalled && <span className="truncate text-muted-foreground">{STALLED_NOTE}</span>}
      </span>
      <Elapsed value={elapsed} />
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label="Cancel AI design run"
        title="Cancel AI design run"
        onClick={() => pipeline.cancel()}
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}

/** The toolbar's compact run indicator, visible whether or not the design panel is open. */
export function AiRunIndicator() {
  const running = useAiDesignStore((state) => state.running);
  return running ? <ToolbarStatus /> : null;
}
