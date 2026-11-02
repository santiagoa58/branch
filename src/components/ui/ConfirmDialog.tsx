import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending?: boolean;
  errorMessage?: string;
}

/** Reusable in-app confirmation for destructive actions; dismissal always cancels. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onOpenChange,
  onConfirm,
  pending = false,
  errorMessage,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent showCloseButton={false} data-editor-shortcuts="blocked">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {errorMessage && (
          <p role="status" className="text-sm text-destructive">
            {errorMessage}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? "Deleting…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
