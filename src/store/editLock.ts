import { useSyncExternalStore } from "react";
import { cloudWorkspace } from "@/services/cloudWorkspace";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useAnimationStore } from "@/store/animationStore";

/** Why the open document cannot be edited right now. */
export type EditBlockReason = "locked" | "loading" | "ai-running" | "deletions-pending";

/** Every condition, in the order a blocked edit reports them. */
const EDIT_BLOCK_REASONS = [
  "locked",
  "loading",
  "ai-running",
  "deletions-pending",
] as const satisfies readonly EditBlockReason[];

/**
 * Store actions (`diagramStore`) block on the cloud lock and AI runs only; UI entry points add
 * loading and pending deletions. An animated delete calls `deleteNode` while still pending, so
 * the store must not block on pending deletions.
 */
export const STORE_EDIT_CHECKS = [
  "locked",
  "ai-running",
] as const satisfies readonly EditBlockReason[];

/**
 * Saving and restoring versions block on AI runs and pending deletions. The cloud workspace
 * rejects a version operation itself while it is locked.
 */
export const VERSION_EDIT_CHECKS = [
  "ai-running",
  "deletions-pending",
] as const satisfies readonly EditBlockReason[];

type EditLockState = Record<EditBlockReason, boolean>;

function firstReason<R extends EditBlockReason>(
  state: EditLockState,
  checks: readonly R[],
): R | null {
  return checks.find((reason) => state[reason]) ?? null;
}

/**
 * The first reason the document is not editable, or null. Pass `checks` to test only some
 * conditions; they are reported in the order given.
 */
export function editBlockReason(): EditBlockReason | null;
export function editBlockReason<R extends EditBlockReason>(checks: readonly R[]): R | null;
export function editBlockReason(
  checks: readonly EditBlockReason[] = EDIT_BLOCK_REASONS,
): EditBlockReason | null {
  const cloud = cloudWorkspace.getState();
  return firstReason(
    {
      locked: cloud.locked,
      loading: cloud.status === "loading",
      "ai-running": useAiDesignStore.getState().running,
      "deletions-pending": useAnimationStore.getState().pendingDeletions.size > 0,
    },
    checks,
  );
}

const isCloudLocked = () => cloudWorkspace.getState().locked;
const isCloudLoading = () => cloudWorkspace.getState().status === "loading";

/** Reactive `editBlockReason() !== null`; each selector returns a boolean, so unrelated store changes do not re-render. */
export function useEditBlocked(): boolean {
  const locked = useSyncExternalStore(cloudWorkspace.subscribe, isCloudLocked);
  const loading = useSyncExternalStore(cloudWorkspace.subscribe, isCloudLoading);
  const aiRunning = useAiDesignStore((state) => state.running);
  const deletionsPending = useAnimationStore((state) => state.pendingDeletions.size > 0);
  return (
    firstReason(
      { locked, loading, "ai-running": aiRunning, "deletions-pending": deletionsPending },
      EDIT_BLOCK_REASONS,
    ) !== null
  );
}
