import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { projectsApi } from "@/services/api";

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
] as const;
const DEFAULT_COLOR = COLORS[0];

interface Props {
  onClose: () => void;
}

export function CreateProjectDialog({ onClose }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<(typeof COLORS)[number]>(DEFAULT_COLOR);

  const mutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void navigate(`/projects/${project.id}`);
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        aria-label="Close new project dialog"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <dialog
        open
        aria-modal="true"
        aria-labelledby="new-project-title"
        className="relative bg-popover text-popover-foreground rounded-lg shadow-xl border border-border w-full max-w-md p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="new-project-title" className="text-lg font-semibold">
            New Project
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
              ...(color ? { color } : {}),
            });
          }}
        >
          <label htmlFor="project-name" className="block text-sm font-medium mb-1">
            Name
          </label>
          <input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Project"
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring mb-3"
          />

          <label htmlFor="project-description" className="block text-sm font-medium mb-1">
            Description
          </label>
          <textarea
            id="project-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            rows={2}
            className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring mb-3 resize-none"
          />

          <fieldset className="mb-5">
            <legend className="block text-sm font-medium mb-2">Color</legend>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Use ${c} as the project color`}
                  aria-pressed={color === c}
                  className={`w-7 h-7 rounded-full ring-2 ring-offset-2 ring-offset-popover focus-visible:outline-none focus-visible:ring-ring transition-all ${
                    color === c ? "ring-ring scale-110" : "ring-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </fieldset>

          {mutation.isError && (
            <p role="alert" className="mb-3 text-sm text-muted-foreground">
              Could not create this project. Please try again.
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
              className="px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 transition-colors shadow-sm"
            >
              {mutation.isPending ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
