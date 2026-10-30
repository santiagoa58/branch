import { create } from "zustand";
import type { EdgeProtocol } from "@/types";

interface UIState {
  leftPanelVisible: boolean;
  rightPanelVisible: boolean;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;

  // Legend filtering — protocols whose edges should render dimmed.
  hiddenProtocols: ReadonlySet<EdgeProtocol>;
  toggleHiddenProtocol: (p: EdgeProtocol) => void;
  /** Hide every protocol except the given one. Call again with the same protocol to clear. */
  isolateProtocol: (p: EdgeProtocol, allProtocols: EdgeProtocol[]) => void;
  clearHiddenProtocols: () => void;

  // Tag filtering — nodes/edges carrying any hidden tag render dimmed.
  hiddenTags: ReadonlySet<string>;
  toggleHiddenTag: (tag: string) => void;
  /** Hide every tag except the given one. Call again with the same tag to clear. */
  isolateTag: (tag: string, allTags: string[]) => void;
  clearHiddenTags: () => void;

  // Spotlight search (Cmd+K)
  spotlightOpen: boolean;
  setSpotlightOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  leftPanelVisible: true,
  rightPanelVisible: true,
  toggleLeftPanel: () => set((state) => ({ leftPanelVisible: !state.leftPanelVisible })),
  toggleRightPanel: () => set((state) => ({ rightPanelVisible: !state.rightPanelVisible })),

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

  // Tag filtering
  hiddenTags: new Set<string>(),
  toggleHiddenTag: (tag) =>
    set((state) => {
      const next = new Set(state.hiddenTags);
      const key = tag.toLowerCase();
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return { hiddenTags: next };
    }),
  isolateTag: (tag, allTags) =>
    set((state) => {
      const key = tag.toLowerCase();
      const others = allTags.filter((t) => t.toLowerCase() !== key).map((t) => t.toLowerCase());
      const alreadyIsolated =
        !state.hiddenTags.has(key) && others.every((t) => state.hiddenTags.has(t));
      return { hiddenTags: alreadyIsolated ? new Set() : new Set(others) };
    }),
  clearHiddenTags: () => set({ hiddenTags: new Set() }),

  // Spotlight
  spotlightOpen: false,
  setSpotlightOpen: (open) => set({ spotlightOpen: open }),
}));
