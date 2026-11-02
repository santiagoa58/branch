import type { NamedFlow } from "@/types/simulation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface FlowDeleteDialogProps {
  target: Pick<NamedFlow, "id" | "name"> | null;
  onCancel: () => void;
  onDelete: (id: string) => void;
}

/** Keep the destructive action isolated from the flow list's other controls. */
export function FlowDeleteDialog({ target, onCancel, onDelete }: FlowDeleteDialogProps) {
  const confirm = () => {
    if (target) {
      onDelete(target.id);
    }
    onCancel();
  };

  return (
    <ConfirmDialog
      open={target !== null}
      title="Delete saved flow?"
      description={`Delete "${target?.name ?? ""}"? This removes the saved replay scenario and cannot be undone.`}
      confirmLabel="Delete flow"
      onOpenChange={onCancel}
      onConfirm={confirm}
    />
  );
}
