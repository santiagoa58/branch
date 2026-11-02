import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ChevronDownIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { CreateDiagramDialog } from "@/components/workspace/CreateDiagramDialog";
import { WorkspaceDeleteDialog } from "@/components/workspace/WorkspaceDeleteDialog";
import { diagramsApi } from "@/services/api";
import { cloudWorkspace, useCloudWorkspace } from "@/services/cloudWorkspace";
import { workspaceQuery } from "@/services/workspaceQuery";
import { deleteDiagramFromWorkspace } from "@/services/workspaceDeletion";
import { notify } from "@/services/notify";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useAnimationStore } from "@/store/animationStore";

interface Props {
  projectId: string;
  diagramId: string;
  diagramName: string;
}

/** Workspace actions are available from the current diagram, without visiting the dashboard. */
export function EditorDiagramMenu({ projectId, diagramId, diagramName }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cloud = useCloudWorkspace();
  const aiRunning = useAiDesignStore((state) => state.running);
  const pendingDeletions = useAnimationStore((state) => state.pendingDeletions.size > 0);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const { data: diagrams = [] } = useQuery({
    ...workspaceQuery.diagrams(projectId),
    enabled: Boolean(projectId),
  });

  const blocked = cloud.locked || cloud.status === "loading" || aiRunning || pendingDeletions;

  const deleteMutation = useMutation({
    mutationFn: () =>
      deleteDiagramFromWorkspace(queryClient, projectId, diagramId, () =>
        cloudWorkspace.deleteCurrent(() => diagramsApi.delete(diagramId)),
      ),
    onSuccess: () => {
      setConfirmDelete(false);
      const next = diagrams.find((item) => item.id !== diagramId);
      void navigate(
        next ? `/projects/${projectId}/diagrams/${next.id}` : `/projects/${projectId}`,
        { replace: true },
      );
      notify.success({ title: "Diagram deleted", message: `"${diagramName}" was deleted.` });
    },
    onError: (error: Error) => {
      notify.error({
        title: "Could not delete diagram",
        message: error.message || "Your diagram is unchanged. Try again.",
      });
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    const closeOutside = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const chooseCreate = () => {
    setOpen(false);
    setCreating(true);
  };
  const chooseDelete = () => {
    setOpen(false);
    setConfirmDelete(true);
  };

  return (
    <>
      <div className="relative min-w-0" ref={container}>
        <button
          type="button"
          aria-label={`Diagram actions for ${diagramName}`}
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 max-w-48 items-center gap-1 rounded-md px-1.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className="min-w-0 truncate">{diagramName}</span>
          <ChevronDownIcon className="size-3.5 shrink-0" aria-hidden="true" />
        </button>
        {open && (
          <div
            role="menu"
            aria-label="Diagram actions"
            className="absolute top-full left-0 z-60 mt-1 w-52 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-xl"
          >
            <button
              type="button"
              role="menuitem"
              disabled={blocked || deleteMutation.isPending}
              onClick={chooseCreate}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
            >
              <PlusIcon className="size-4" aria-hidden="true" />
              New diagram
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={blocked || deleteMutation.isPending}
              onClick={chooseDelete}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-accent disabled:opacity-50"
            >
              <TrashIcon className="size-4" aria-hidden="true" />
              Delete diagram
            </button>
          </div>
        )}
      </div>
      {creating && (
        <CreateDiagramDialog
          projectId={projectId}
          beforeCreate={() => cloudWorkspace.flush()}
          onClose={() => setCreating(false)}
        />
      )}
      <WorkspaceDeleteDialog
        target={confirmDelete ? { kind: "diagram", id: diagramId, name: diagramName } : null}
        onCancel={() => setConfirmDelete(false)}
        pending={deleteMutation.isPending}
        errorMessage={deleteMutation.isError ? "Could not delete this diagram. Please retry." : undefined}
        onDelete={(target) => {
          if (target.kind === "diagram" && target.id === diagramId) {
            deleteMutation.mutate();
          }
        }}
      />
    </>
  );
}
