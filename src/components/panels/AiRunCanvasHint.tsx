import { Sparkles } from "lucide-react";
import { useAiDesignStore } from "@/store/aiDesignStore";

/**
 * Tells the viewer, on the canvas, that an AI run is editing the diagram and the canvas is
 * view-only until it ends. A full-width row under the toolbar, so it never covers a control, and
 * a live region that stays mounted so the message is announced when a run starts. The run's
 * progress and Cancel live in the design panel.
 */
export function AiRunCanvasHint() {
  const running = useAiDesignStore((state) => state.running);
  return (
    <output className="basis-full flex justify-center">
      {running && (
        <span className="flex items-center gap-1.5 rounded-full border border-border bg-popover/90 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
          <Sparkles className="size-3.5" aria-hidden="true" />
          AI is updating the design. Viewing only.
        </span>
      )}
    </output>
  );
}
