import { useState } from "react";
import { createPortal } from "react-dom";
import { LoadingIndicator } from "@/components/ui/loading";
import { XMarkIcon, BookmarkIcon } from "@heroicons/react/24/outline";

interface SaveVersionDialogProps {
  isOpen: boolean;
  isSaving: boolean;
  onSave: (label: string) => void;
  onClose: () => void;
}

export function SaveVersionDialog({ isOpen, isSaving, onSave, onClose }: SaveVersionDialogProps) {
  const [label, setLabel] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(label.trim());
    setLabel("");
  };

  const handleClose = () => {
    setLabel("");
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close save version dialog"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-sm mx-4 border border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <BookmarkIcon className="w-4 h-4 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Save Version</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="version-label"
              className="text-xs font-medium text-zinc-700 dark:text-zinc-300"
            >
              Label <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input
              id="version-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Before refactor, v1.2, Sprint 3 baseline…"
              maxLength={255}

              className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent transition"
            />
            <p className="text-xs text-muted-foreground">
              A snapshot of the current diagram state will be saved.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 rounded-md hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving && <LoadingIndicator className="size-3" />}
              {isSaving ? "Saving…" : "Save Version"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
