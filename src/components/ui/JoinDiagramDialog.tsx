import { useState, useEffect, useRef } from "react";
import { UserIcon } from "@heroicons/react/24/outline";
import { collaboratorNameSchema } from "@/schemas/collaboration";
import {
  COLLABORATOR_NAME_STORAGE_KEY,
  loadCollaboratorName,
} from "@/services/collaborationIdentity";

interface JoinDiagramDialogProps {
  open: boolean;
  onJoin: (name: string) => void;
}

export function JoinDiagramDialog({ open, onJoin }: JoinDiagramDialogProps) {
  const [name, setName] = useState(() => loadCollaboratorName() ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = collaboratorNameSchema.safeParse(name);
    if (!result.success) {
      return;
    }

    localStorage.setItem(COLLABORATOR_NAME_STORAGE_KEY, result.data);
    onJoin(result.data);
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-2xl w-full max-w-sm mx-4">
        <form onSubmit={handleSubmit} className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 bg-zinc-100 dark:bg-zinc-900 rounded-lg flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Join Diagram
              </h2>
              <p className="text-xs text-zinc-500">Enter your name to collaborate</p>
            </div>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name..."
            maxLength={30}
            className="w-full px-3 py-2 rounded-md text-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 placeholder:text-zinc-400"
          />

          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full mt-4 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-zinc-100 dark:text-zinc-900 text-sm font-semibold px-4 py-2 rounded-md transition-colors shadow-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Join
          </button>
        </form>
      </div>
    </div>
  );
}
