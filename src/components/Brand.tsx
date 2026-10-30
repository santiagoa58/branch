import { cn } from "@/lib/utils";

export const BRANCH_MARK_SRC = "/branch-mark.svg";

interface BrandMarkProps {
  className?: string;
  decorative?: boolean;
}

export function BrandMark({ className, decorative = false }: BrandMarkProps) {
  return (
    <img
      src={BRANCH_MARK_SRC}
      alt={decorative ? "" : "Branch"}
      aria-hidden={decorative || undefined}
      width={32}
      height={32}
      className={cn("size-8 shrink-0 object-contain", className)}
    />
  );
}

interface BrandProps {
  className?: string;
  markClassName?: string;
  decorative?: boolean;
}

/** The wordmark supplies the name, so the adjacent mark is always decorative. */
export function Brand({ className, markClassName, decorative = false }: BrandProps) {
  return (
    <span
      aria-hidden={decorative || undefined}
      className={cn(
        "inline-flex items-center gap-3 text-sm font-semibold tracking-tight text-foreground",
        className,
      )}
    >
      <BrandMark decorative className={cn(markClassName)} />
      <span>Branch</span>
    </span>
  );
}
