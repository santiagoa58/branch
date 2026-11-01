import { useDesignPipeline } from "@/hooks/useDesignPipeline";
import { cn } from "@/lib/utils";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useDiagramStore } from "@/store/diagramStore";

/** Re-runs the decision stage for one node. Only offered for diagrams that have an AI design brief. */
export function RegenerateReasoningButton({ nodeId }: { nodeId: string }) {
  const hasBrief = useDiagramStore((state) => state.brief !== null);
  const running = useAiDesignStore((state) => state.running);
  const pipeline = useDesignPipeline();
  if (!hasBrief) {
    return null;
  }
  return (
    <button
      type="button"
      disabled={running}
      onClick={() => void pipeline.regenerateDecision(nodeId)}
      className={cn(
        "w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm font-semibold text-secondary-foreground hover:bg-accent active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
    >
      Regenerate reasoning
    </button>
  );
}
