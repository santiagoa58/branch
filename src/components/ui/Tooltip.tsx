import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  /** Tooltip placement relative to the trigger. Defaults to 'bottom'. */
  placement?: "top" | "bottom";
  /** Horizontal alignment; use "end" for triggers at the right edge so the tooltip opens inward. */
  align?: "center" | "end";
}

export function Tooltip({
  content,
  children,
  className,
  placement = "bottom",
  align = "center",
}: TooltipProps) {
  const isTop = placement === "top";
  return (
    <div className={cn("relative group/tooltip inline-flex", className)}>
      {children}
      <div
        className={cn(
          "pointer-events-none absolute z-200",
          align === "end" ? "right-0" : "left-1/2 -translate-x-1/2",
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
            "absolute border-4 border-transparent",
            align === "end" ? "right-3" : "left-1/2 -translate-x-1/2",
            isTop
              ? "top-full border-t-zinc-900 dark:border-t-zinc-100"
              : "bottom-full border-b-zinc-900 dark:border-b-zinc-100",
          )}
        />
      </div>
    </div>
  );
}
