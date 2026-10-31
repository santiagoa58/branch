import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DiagramDiffCanvas, DiffCounts, type DiffView } from "@/components/ui/DiagramDiffCanvas";
import { LoadingState } from "@/components/ui/loading";
import { cn } from "@/lib/utils";
import { cloudWorkspace, useCloudWorkspace } from "@/services/cloudWorkspace";
import { useDiagramStore } from "@/store/diagramStore";

const VIEWS: { view: DiffView; label: string }[] = [
  { view: "diff", label: "Compare" },
  { view: "after", label: "Your version" },
  { view: "before", label: "Other copy" },
];

interface SaveConflictDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Shown when this tab's save was rejected because the diagram was saved somewhere else first.
 * The person compares both versions and keeps one; nothing is overwritten without that choice.
 */
export function SaveConflictDialog({ open, onOpenChange }: SaveConflictDialogProps) {
  const cloud = useCloudWorkspace();
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const [view, setView] = useState<DiffView>("diff");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remote = cloud.conflict?.remote ?? null;
  const mine = useMemo(() => ({ nodes, edges }), [nodes, edges]);
  const other = useMemo(
    () => (remote ? { nodes: remote.data.nodes, edges: remote.data.edges } : null),
    [remote],
  );

  const keepMine = () => {
    setSaving(true);
    setError(null);
    cloudWorkspace
      .keepLocal()
      .then(() => onOpenChange(false))
      .catch((cause: unknown) => {
        // A newer save elsewhere puts the workspace back into a conflict with a fresh copy.
        if (cloudWorkspace.getState().status !== "conflict") {
          setError(cause instanceof Error ? cause.message : "Couldn't save your version.");
        }
      })
      .finally(() => setSaving(false));
  };
  const useOther = () => {
    cloudWorkspace.useRemote();
    onOpenChange(false);
  };

  return (
    <Dialog open={open && cloud.status === "conflict"} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-5/6 flex-col gap-0 p-0 sm:max-w-4xl" showCloseButton>
        <DialogHeader className="border-b border-zinc-200 dark:border-zinc-800 px-5 py-4 pr-12">
          <DialogTitle>This diagram was changed somewhere else</DialogTitle>
          <DialogDescription>
            {cloud.dirty
              ? "Another tab or window saved this diagram after you opened it, so your latest edits haven't been saved. Compare the two and choose which one to keep."
              : "Another tab or window saved this diagram after you opened it. Load that copy to keep working."}
          </DialogDescription>
        </DialogHeader>

        {other ? (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 px-5 py-2.5">
              <fieldset className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 p-0.5">
                <legend className="sr-only">View</legend>
                {VIEWS.map((option) => (
                  <button
                    key={option.view}
                    type="button"
                    aria-pressed={view === option.view}
                    onClick={() => setView(option.view)}
                    className={cn(
                      "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      view === option.view
                        ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                        : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </fieldset>
              {view === "diff" && <DiffCounts before={other} after={mine} />}
            </div>
            <DiagramDiffCanvas
              before={other}
              after={mine}
              view={view}
              legend={{
                added: "Only in your version",
                removed: "Only in the other copy",
                modified: "Different in each",
              }}
            />
          </>
        ) : cloud.conflict?.failed ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Couldn't load the other copy to compare. Your edits are safe in this tab.
            </p>
            <Button variant="outline" onClick={() => void cloudWorkspace.retryConflict()}>
              Try again
            </Button>
          </div>
        ) : (
          <LoadingState label="Loading the other copy…" className="flex-1" />
        )}

        <DialogFooter className="mx-0 mb-0 items-center">
          {error && (
            <p role="alert" className="mr-auto text-xs text-destructive">
              {error}
            </p>
          )}
          <Button variant="outline" disabled={!other || saving} onClick={useOther}>
            {cloud.dirty ? "Discard mine, use other copy" : "Load the other copy"}
          </Button>
          {cloud.dirty && (
            <Button disabled={!other || saving} onClick={keepMine}>
              {saving ? "Saving…" : "Keep my version"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
