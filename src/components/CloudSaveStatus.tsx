import { useEffect, useState } from "react";
import { LoadingState } from "@/components/ui/loading";
import { SaveConflictDialog } from "@/components/SaveConflictDialog";
import { useAnimationStore } from "@/store/animationStore";
import { useBlocker } from "react-router-dom";
import { cloudWorkspace, useCloudWorkspace } from "@/services/cloudWorkspace";
import { getEditorShortcut } from "@/utils/editorShortcuts";
import { isTextEditingEvent } from "@/utils/keyboardContext";

export function CloudNavigationGuard() {
  const cloud = useCloudWorkspace();
  const pendingDeletes = useAnimationStore((state) => state.pendingDeletions.size);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      currentLocation.pathname !== nextLocation.pathname &&
      (cloudWorkspace.isBusy() || useAnimationStore.getState().pendingDeletions.size > 0),
  );
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const lockShortcuts = (event: KeyboardEvent) => {
      const command = getEditorShortcut(event);
      if (
        cloudWorkspace.getState().locked &&
        command &&
        command.type !== "escape" &&
        !(command.type === "copy-selection" && window.getSelection()?.toString()) &&
        !isTextEditingEvent(event)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("keydown", lockShortcuts, true);
    return () => {
      window.removeEventListener("keydown", lockShortcuts, true);
    };
  }, []);
  useEffect(() => {
    if (blocker.state !== "blocked" || cloud.locked || pendingDeletes > 0) {
      return;
    }
    let active = true;
    void cloudWorkspace
      .flush()
      .then(() => {
        if (active) {
          blocker.proceed();
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Save failed.");
        }
      });
    return () => {
      active = false;
    };
  }, [blocker, cloud.locked, pendingDeletes]);
  if (blocker.state !== "blocked") {
    return null;
  }
  return (
    <div className="fixed inset-0 z-100 grid place-content-center bg-black/40 p-6">
      <dialog
        open
        aria-modal="true"
        aria-label="Unsaved edits"
        className="max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 text-zinc-900 dark:text-zinc-100 shadow-xl"
      >
        {error ? (
          <>
            <p className="font-semibold">Your edits have not been saved</p>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          </>
        ) : (
          <LoadingState
            label="Saving before leaving…"
            description="Please wait for the cloud operation to finish."
            className="p-0"
          />
        )}
        <div className="mt-4 flex gap-4 text-sm">
          <button
            type="button"
            className="underline"
            onClick={() => {
              setError(null);
              blocker.reset();
            }}
          >
            Stay in editor
          </button>
          {error && cloud.status !== "saving" && (
            <button
              type="button"
              className="underline"
              onClick={() => {
                cloudWorkspace.reset();
                blocker.proceed();
              }}
            >
              Discard edits and leave
            </button>
          )}
        </div>
      </dialog>
    </div>
  );
}

export function CloudSaveError() {
  const cloud = useCloudWorkspace();
  const conflicted = cloud.status === "conflict";
  const [reviewing, setReviewing] = useState(conflicted);
  const [wasConflicted, setWasConflicted] = useState(conflicted);
  // Open the comparison as soon as a conflict happens; closing it leaves this banner to reopen it.
  if (conflicted !== wasConflicted) {
    setWasConflicted(conflicted);
    setReviewing(conflicted);
  }
  if (cloud.status !== "error" && !conflicted) {
    return null;
  }
  return (
    <div
      role="alert"
      className="flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 px-4 py-2 text-xs text-zinc-700 dark:text-zinc-300"
    >
      <span className="min-w-0 flex-1">
        {cloud.message}{" "}
        {cloud.dirty &&
          (conflicted
            ? "Your edits in this tab aren't saved yet."
            : "Your edits are kept in this tab until they save.")}
      </span>
      {cloud.status === "error" && cloud.dirty && (
        <button
          type="button"
          className="underline shrink-0 whitespace-nowrap"
          onClick={() => {
            void cloudWorkspace.flush().catch(() => {});
          }}
        >
          Retry save
        </button>
      )}
      {conflicted && (
        <>
          <button
            type="button"
            className="underline shrink-0 whitespace-nowrap"
            onClick={() => setReviewing(true)}
          >
            Review changes
          </button>
          <SaveConflictDialog open={reviewing} onOpenChange={setReviewing} />
        </>
      )}
    </div>
  );
}
