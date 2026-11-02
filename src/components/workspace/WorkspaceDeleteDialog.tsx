import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export type WorkspaceDeleteTarget =
  | { kind: "project"; id: string; name: string; diagramCount: number }
  | { kind: "diagram"; id: string; name: string };

interface WorkspaceDeleteDialogProps {
  target: WorkspaceDeleteTarget | null;
  onCancel: () => void;
  onDelete: (target: WorkspaceDeleteTarget) => void;
  pending?: boolean;
  errorMessage?: string;
}

/** Explicit confirmation before a project or diagram is removed. Dismissal does nothing. */
export function WorkspaceDeleteDialog({
  target,
  onCancel,
  onDelete,
  pending = false,
  errorMessage,
}: WorkspaceDeleteDialogProps) {
  const isProject = target?.kind === "project";
  const description = isProject
    ? `Delete project "${target.name}" and all ${target.diagramCount} of its diagrams? This cannot be undone.`
    : `Delete diagram "${target?.name ?? ""}"? This cannot be undone.`;
  const confirm = () => {
    if (target) {
      onDelete(target);
    }
  };

  return (
    <ConfirmDialog
      open={target !== null}
      title={isProject ? "Delete project?" : "Delete diagram?"}
      description={description}
      confirmLabel={isProject ? "Delete project" : "Delete diagram"}
      onOpenChange={onCancel}
      onConfirm={confirm}
      pending={pending}
      {...(errorMessage ? { errorMessage } : {})}
    />
  );
}
