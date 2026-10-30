/**
 * Animation store — lightweight orchestration for animated deletion effects.
 * Manages the lifecycle of "pending deletions" where nodes are visually
 * destroyed (shatter/explode) before being removed from diagram state.
 */
import { create } from "zustand";
import { cloudWorkspace } from "@/services/cloudWorkspace";

interface AnimationState {
  /** Node IDs currently undergoing destruction animation */
  pendingDeletions: Set<string>;

  /**
   * Request animated deletion of a node.
   * The node remains in React Flow state during animation,
   * but is visually hidden and replaced by a clone overlay.
   */
  requestDelete: (id: string) => void;

  /**
   * Request animated deletion of multiple nodes (with stagger).
   */
  requestDeleteMultiple: (ids: string[]) => void;

  /**
   * Called when the destruction animation completes.
   * Removes the node from pending set.
   * The actual diagramStore.deleteNode() call happens in the hook.
   */
  confirmDelete: (id: string) => void;

  /** Check if a node is currently being destroyed */
  isPendingDeletion: (id: string) => boolean;
}

export const useAnimationStore = create<AnimationState>((set, get) => ({
  pendingDeletions: new Set(),

  requestDelete: (id) =>
    set((state) => {
      if (cloudWorkspace.getState().locked) {
        return state;
      }
      const next = new Set(state.pendingDeletions);
      next.add(id);
      return { pendingDeletions: next };
    }),

  requestDeleteMultiple: (ids) =>
    set((state) => {
      if (cloudWorkspace.getState().locked) {
        return state;
      }
      const next = new Set(state.pendingDeletions);
      ids.forEach((id) => next.add(id));
      return { pendingDeletions: next };
    }),

  confirmDelete: (id) =>
    set((state) => {
      const next = new Set(state.pendingDeletions);
      next.delete(id);
      return { pendingDeletions: next };
    }),

  isPendingDeletion: (id) => get().pendingDeletions.has(id),
}));
