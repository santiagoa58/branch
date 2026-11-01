import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** One choice in a list of options: a toggle button that shows a ring while it is selected. */
export function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "flex min-h-11 flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        selected
          ? "border-primary ring-1 ring-primary"
          : "border-border hover:border-zinc-400 dark:hover:border-zinc-600",
      )}
    >
      {children}
    </button>
  );
}
