import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { diagramsApi } from "@/services/api";
import { LoadingIndicator } from "@/components/ui/loading";

interface Props {
  projectId: string;
  onClose: () => void;
}

export function CreateDiagramDialog({ projectId, onClose }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const mutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      diagramsApi.create(projectId, data),
    onSuccess: (diagram) => {
      void queryClient.invalidateQueries({ queryKey: ["projects", projectId, "diagrams"] });
      void navigate(`/projects/${projectId}/diagrams/${diagram.id}`);
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        aria-label="Close new diagram dialog"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <dialog
        open
        aria-modal="true"
        aria-labelledby="new-diagram-title"
        className="relative bg-popover text-popover-foreground rounded-lg shadow-xl border border-border w-full max-w-md p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="new-diagram-title" className="text-lg font-semibold">
            New Diagram
          </h2>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="p-1 rounded hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) {
              return;
            }
            const trimmedDescription = description.trim();
            mutation.mutate({
              name: name.trim(),
              ...(trimmedDescription ? { description: trimmedDescription } : {}),
            });
          }}
        >
          <label htmlFor="diagram-name" className="block text-sm font-medium mb-1">
            Name
          </label>
          <input
            id="diagram-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Diagram"
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring mb-3"
          />

          <label htmlFor="diagram-description" className="block text-sm font-medium mb-1">
            Description
          </label>
          <textarea
            id="diagram-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            rows={2}
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring mb-3 resize-none"
          />

          {mutation.isError && (
            <p role="alert" className="mb-3 text-sm text-muted-foreground">
              Could not create this diagram. Please try again.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs rounded-md hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || mutation.isPending}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 transition-colors shadow-sm"
            >
              {mutation.isPending && <LoadingIndicator className="size-3" />}
              {mutation.isPending ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
