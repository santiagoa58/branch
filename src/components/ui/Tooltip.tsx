import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  /** Tooltip placement relative to the trigger. Defaults to 'top'. */
  placement?: "top" | "bottom";
}

export function Tooltip({ content, children, className, placement = "bottom" }: TooltipProps) {
  const isTop = placement === "top";
  return (
    <div className={cn("relative group/tooltip inline-flex", className)}>
      {children}
      <div
        className={cn(
          "pointer-events-none absolute left-1/2 -translate-x-1/2 z-[200]",
          "px-2 py-1 text-[11px] font-medium leading-tight whitespace-nowrap rounded-md shadow-md",
          "bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900",
          "opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-150",
          isTop ? "bottom-full mb-2" : "top-full mt-2",
        )}
      >
        {content}
        {/* Arrow */}
        <span
          className={cn(
            "absolute left-1/2 -translate-x-1/2 border-4 border-transparent",
            isTop
              ? "top-full border-t-zinc-900 dark:border-t-zinc-100"
              : "bottom-full border-b-zinc-900 dark:border-b-zinc-100",
          )}
        />
      </div>
    </div>
  );
}
