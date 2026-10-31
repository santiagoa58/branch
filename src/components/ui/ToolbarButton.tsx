import type { ReactNode } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";

export interface ToolbarButtonProps {
  /** Accessible name and tooltip text. */
  label: string;
  /** Visible text next to the icon, for actions an icon alone can't explain. */
  showLabel?: string;
  shortcut?: string;
  active?: boolean;
  className?: string;
  onClick: () => void;
  children: ReactNode;
}

export function ToolbarButton({
  label,
  showLabel,
  shortcut,
  active = false,
  className,
  onClick,
  children,
}: ToolbarButtonProps) {
  return (
    <Tooltip content={shortcut ? `${label} (${shortcut})` : label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          "flex items-center gap-1.5 p-2 rounded-full text-xs font-medium transition-colors",
          showLabel && "@2xl:px-3",
          active
            ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
            : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100",
          className,
        )}
      >
        {children}
        {/* In a narrow top bar the text collapses; the accessible name already says the same. */}
        {showLabel && <span className="@max-2xl:sr-only">{showLabel}</span>}
      </button>
    </Tooltip>
  );
}

export function ToolbarDivider() {
  return <div aria-hidden="true" className="w-px h-4 bg-zinc-200 dark:bg-zinc-800 mx-1" />;
}
