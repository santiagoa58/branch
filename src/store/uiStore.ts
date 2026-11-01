import { create } from "zustand";
import type { EdgeProtocol } from "@/types";
import type { PaletteNodeType } from "@/schemas/ui";
import type { DesignBrief } from "@/schemas/aiDesign";

export type DesignTabId = "brief" | "design" | "api" | "dataModel";

/** An answer being chosen for a stage 1 question: an option label, or a written answer (`custom`). */
export interface QuestionDraft {
  custom: boolean;
  text: string;
}

/**
 * Below Tailwind's lg breakpoint the side panels slide over the canvas instead of sitting beside
 * it; two inline panels on a tablet would leave the canvas too narrow to use.
 */
export const COMPACT_LAYOUT_QUERY = "(max-width: 1023px)";

function isCompactLayout(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(COMPACT_LAYOUT_QUERY).matches
  );
}

interface UIState {
  leftPanelVisible: boolean;
  rightPanelVisible: boolean;
  /** On a compact screen, opening one panel closes the other so the canvas stays usable. */
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  closePanels: () => void;

  /**
   * The AI design panel shares the right-hand slot with the inspector, which takes precedence
   * while something is selected.
   */
  designPanelOpen: boolean;
  /** Shows the right-hand slot with the design panel; a compact screen closes the palette. */
  openDesignPanel: () => void;
  /** On a compact screen this also hides the right-hand slot instead of revealing the inspector. */
  closeDesignPanel: () => void;
  /** Kept here, not in the panel, so the tab survives the inspector taking the slot. */
  designTab: DesignTabId;
  setDesignTab: (tab: DesignTabId) => void;
  /**
   * Answers chosen but not yet submitted, by question text, for one set of stage 1 questions.
   * A new questions array (a new stage 1 result) starts empty. Ephemeral: never persisted.
   */
  questionDrafts: {
    questions: DesignBrief["questions"] | null;
    drafts: Record<string, QuestionDraft>;
  };
  setQuestionDraft: (
    questions: DesignBrief["questions"],
    question: string,
    draft: QuestionDraft,
  ) => void;

  /** A component chosen in the palette by click or tap, added by the editor at the view center. */
  pendingPaletteAdd: PaletteNodeType | null;
  requestPaletteAdd: (type: PaletteNodeType) => void;
  /** Clears the request; on a compact screen it also closes the palette to reveal the result. */
  completePaletteAdd: () => void;

  // Legend filtering — protocols whose edges should render dimmed.
  hiddenProtocols: ReadonlySet<EdgeProtocol>;
  toggleHiddenProtocol: (p: EdgeProtocol) => void;
  /** Hide every protocol except the given one. Call again with the same protocol to clear. */
  isolateProtocol: (p: EdgeProtocol, allProtocols: EdgeProtocol[]) => void;
  clearHiddenProtocols: () => void;

  // Spotlight search (Cmd+K)
  spotlightOpen: boolean;
  setSpotlightOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  leftPanelVisible: !isCompactLayout(),
  rightPanelVisible: !isCompactLayout(),
  toggleLeftPanel: () =>
    set((state) => {
      const leftPanelVisible = !state.leftPanelVisible;
      return leftPanelVisible && isCompactLayout()
        ? { leftPanelVisible, rightPanelVisible: false }
        : { leftPanelVisible };
    }),
  toggleRightPanel: () =>
    set((state) => {
      const rightPanelVisible = !state.rightPanelVisible;
      return rightPanelVisible && isCompactLayout()
        ? { rightPanelVisible, leftPanelVisible: false }
        : { rightPanelVisible };
    }),
  closePanels: () =>
    set({ leftPanelVisible: false, rightPanelVisible: false, designPanelOpen: false }),

  designPanelOpen: false,
  openDesignPanel: () =>
    set(
      isCompactLayout()
        ? { designPanelOpen: true, rightPanelVisible: true, leftPanelVisible: false }
        : { designPanelOpen: true, rightPanelVisible: true },
    ),
  closeDesignPanel: () =>
    set(
      isCompactLayout()
        ? { designPanelOpen: false, rightPanelVisible: false }
        : { designPanelOpen: false },
    ),
  designTab: "brief",
  setDesignTab: (designTab) => set({ designTab }),
  questionDrafts: { questions: null, drafts: {} },
  setQuestionDraft: (questions, question, draft) =>
    set((state) => ({
      questionDrafts: {
        questions,
        drafts: {
          ...(state.questionDrafts.questions === questions ? state.questionDrafts.drafts : {}),
          [question]: draft,
        },
      },
    })),

  pendingPaletteAdd: null,
  requestPaletteAdd: (type) => set({ pendingPaletteAdd: type }),
  completePaletteAdd: () =>
    set(
      isCompactLayout()
        ? { pendingPaletteAdd: null, leftPanelVisible: false }
        : { pendingPaletteAdd: null },
    ),

  // Legend filtering
  hiddenProtocols: new Set<EdgeProtocol>(),
  toggleHiddenProtocol: (p) =>
    set((state) => {
      const next = new Set(state.hiddenProtocols);
      if (next.has(p)) {
        next.delete(p);
      } else {
        next.add(p);
      }
      return { hiddenProtocols: next };
    }),
  isolateProtocol: (p, allProtocols) =>
    set((state) => {
      const others = allProtocols.filter((q) => q !== p);
      // Toggle: if already isolated to p, clear instead.
      const alreadyIsolated =
        !state.hiddenProtocols.has(p) && others.every((q) => state.hiddenProtocols.has(q));
      return { hiddenProtocols: alreadyIsolated ? new Set() : new Set(others) };
    }),
  clearHiddenProtocols: () => set({ hiddenProtocols: new Set() }),

  // Spotlight
  spotlightOpen: false,
  setSpotlightOpen: (open) => set({ spotlightOpen: open }),
}));
