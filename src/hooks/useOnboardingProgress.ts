/**
 * Wires the onboarding checklist to live app state. The only integration point:
 * it subscribes to diagramStore + simulationStore, runs the pure
 * `evaluateCompletedSteps`, and latches any newly-satisfied step. Existing stores
 * and action sites stay untouched.
 *
 * Mount once (in DiagramEditor).
 */
import { useEffect, useRef } from "react";
import { useDiagramStore } from "@/store/diagramStore";
import { useSimulationStore } from "@/store/simulationStore";
import { useOnboardingStore } from "@/store/onboardingStore";
import { evaluateCompletedSteps } from "@/utils/onboarding";

export function useOnboardingProgress() {
  const nodes = useDiagramStore((s) => s.nodes);
  const edges = useDiagramStore((s) => s.edges);
  const mode = useSimulationStore((s) => s.mode);
  const flowPath = useSimulationStore((s) => s.flowPath);
  const initialize = useOnboardingStore((s) => s.initialize);
  const completeStep = useOnboardingStore((s) => s.completeStep);

  const didInit = useRef(false);

  // First-run gate. The diagram is loaded in an App effect that runs *after*
  // this component's effects on first mount, so defer one tick and read the
  // settled node state — otherwise an established user's populated diagram looks
  // empty here and the card would wrongly surface.
  useEffect(() => {
    const t = setTimeout(() => {
      if (didInit.current) {
        return;
      }
      didInit.current = true;
      const current = useDiagramStore.getState().nodes;
      initialize(current.some((n) => n.type === "architecture"));
    }, 0);
    return () => clearTimeout(t);
  }, [initialize]);

  // Latch any newly-satisfied step as the user works. Latching itself lives in
  // the store (completeStep is a one-way no-op once set).
  useEffect(() => {
    const done = evaluateCompletedSteps(nodes, edges, { mode, flowPath });
    for (const id of done) {
      completeStep(id);
    }
  }, [nodes, edges, mode, flowPath, completeStep]);
}
