import { create } from "zustand";
import type { EdgeProtocol } from "@/types";
import type { PaletteNodeType } from "@/schemas/ui";

/**
 * Below Tailwind's lg breakpoint the side panels slide over the canvas instead of sitting beside
 * it; two inline panels on a tablet would leave the canvas too narrow to use.
 */
export const COMPACT_LAYOUT_QUERY = "(max-width: 1023px)";

export function isCompactLayout(): boolean {
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
  closePanels: () => set({ leftPanelVisible: false, rightPanelVisible: false }),

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
