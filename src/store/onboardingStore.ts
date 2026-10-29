/**
 * Onboarding store — tracks the user's progress through the getting-started
 * checklist. Independent of `diagramStore` (never in undo/redo or the diagram
 * persistence blob) and ephemeral simulation state.
 *
 * Persisted to localStorage (per browser profile) via the zustand `persist`
 * middleware, mirroring `themeStore`. Completion latches one-way: once a step is
 * done it stays done, even if the user later deletes their nodes/edges.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type OnboardingStepId, emptyCompletedSteps } from "@/utils/onboarding";
import { onboardingStateSchema } from "@/schemas/persistence";

interface OnboardingState {
  completedSteps: Record<OnboardingStepId, boolean>;
  dismissed: boolean;
  /** False until `initialize()` has run once in this browser profile. */
  initialized: boolean;
  /**
   * The step the checklist is currently guiding toward, or null when the card
   * isn't visible. Ephemeral (not persisted) — components read it to pulse the
   * relevant UI element. Set by the checklist component, which owns visibility.
   */
  activeStep: OnboardingStepId | null;
  setActiveStep: (id: OnboardingStepId | null) => void;

  /** Latch a step complete. No-op if already complete (avoids redundant writes). */
  completeStep: (id: OnboardingStepId) => void;
  /** Hide the checklist for good (until reset). */
  dismiss: () => void;
  /**
   * First-run gate, called once by `useOnboardingProgress`. If this is a brand
   * new record (not yet initialized) AND the diagram already has content, the
   * user is an established one — auto-dismiss so the card never surfaces.
   */
  initialize: (hasExistingContent: boolean) => void;
  /** Clear progress and re-show the card (dev/testing + optional reopen). */
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      completedSteps: emptyCompletedSteps(),
      dismissed: false,
      initialized: false,
      activeStep: null,

      setActiveStep: (id) => {
        if (get().activeStep === id) {
          return;
        }
        set({ activeStep: id });
      },

      completeStep: (id) => {
        if (get().completedSteps[id]) {
          return;
        }
        set((state) => ({
          completedSteps: { ...state.completedSteps, [id]: true },
        }));
      },

      dismiss: () => set({ dismissed: true }),

      initialize: (hasExistingContent) => {
        if (get().initialized) {
          return;
        }
        set({ initialized: true, dismissed: hasExistingContent || get().dismissed });
      },

      // `initialized: true` so the first-run gate won't immediately re-dismiss
      // on a populated diagram — reset always brings the card back.
      reset: () =>
        set({ completedSteps: emptyCompletedSteps(), dismissed: false, initialized: true }),
    }),
    {
      name: "architecture-diagram-onboarding",
      partialize: (state) => ({
        completedSteps: state.completedSteps,
        dismissed: state.dismissed,
        initialized: state.initialized,
      }),
      merge: (persistedState, currentState) => {
        const result = onboardingStateSchema.safeParse(persistedState);
        return result.success ? { ...currentState, ...result.data } : currentState;
      },
    },
  ),
);
