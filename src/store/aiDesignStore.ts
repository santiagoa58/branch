/**
 * AI design store — state of the current staged AI design run.
 * This state is ephemeral: NOT persisted, NOT included in undo/redo.
 */
import { create } from "zustand";
import type { AiStage } from "@/schemas/aiDesign";

interface AiDesignState {
  running: boolean;
  stage: AiStage | null;
  decisions: { done: number; total: number };
  warnings: string[];
  errors: Partial<Record<AiStage, string>>;
  controller: AbortController | null;
  /** Diagram the current run belongs to. */
  diagramId: string | null;
  lastChange: { added: number; changed: number; removed: number } | null;
  /** Incremented by every `start()`; lets the diagram store group a run's applies into one undo step. */
  runId: number;

  start: (diagramId: string) => AbortSignal;
  setStage: (stage: AiStage | null) => void;
  setDecisionProgress: (done: number, total: number) => void;
  addWarnings: (warnings: string[]) => void;
  setError: (stage: AiStage, message: string | null) => void;
  setLastChange: (change: AiDesignState["lastChange"]) => void;
  /** running=false, controller=null, stage=null. */
  finish: () => void;
  /** Abort the controller, then finish. */
  cancel: () => void;
}

export const useAiDesignStore = create<AiDesignState>((set, get) => ({
  running: false,
  stage: null,
  decisions: { done: 0, total: 0 },
  warnings: [],
  errors: {},
  controller: null,
  diagramId: null,
  lastChange: null,
  runId: 0,

  start: (diagramId) => {
    // A new run replaces any run still in flight.
    get().controller?.abort();
    const controller = new AbortController();
    set((state) => ({
      running: true,
      stage: null,
      decisions: { done: 0, total: 0 },
      warnings: [],
      errors: {},
      controller,
      diagramId,
      lastChange: null,
      runId: state.runId + 1,
    }));
    return controller.signal;
  },

  setStage: (stage) => set({ stage }),

  setDecisionProgress: (done, total) => set({ decisions: { done, total } }),

  addWarnings: (warnings) => {
    if (warnings.length > 0) {
      set((state) => ({ warnings: [...state.warnings, ...warnings] }));
    }
  },

  setError: (stage, message) =>
    set((state) => {
      const { [stage]: _removed, ...rest } = state.errors;
      return { errors: message === null ? rest : { ...rest, [stage]: message } };
    }),

  setLastChange: (lastChange) => set({ lastChange }),

  finish: () => set({ running: false, controller: null, stage: null }),

  cancel: () => {
    get().controller?.abort();
    get().finish();
  },
}));
