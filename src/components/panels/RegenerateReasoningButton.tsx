import { Button } from "@/components/ui/button";
import { useDesignPipeline } from "@/hooks/useDesignPipeline";
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
    <Button
      variant="secondary"
      size="lg"
      className="w-full"
      disabled={running}
      onClick={() => void pipeline.regenerateDecision(nodeId)}
    >
      Regenerate reasoning
    </Button>
  );
}
