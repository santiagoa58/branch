import { cn } from "@/lib/utils";

/** Decorative activity mark; the surrounding control supplies its accessible label. */
export function LoadingIndicator({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex size-4 shrink-0 items-center justify-center gap-0.5", className)}
    >
      {[0, 1, 2].map((step) => (
        <span
          key={step}
          className="branch-loading-dot h-1/4 w-1/4 rounded-sm bg-current"
          style={{ animationDelay: `${step * 160}ms` }}
        />
      ))}
    </span>
  );
}

interface LoadingStateProps {
  label?: string;
  description?: string;
  variant?: "screen" | "panel";
  className?: string;
}

export function LoadingState({
  label = "Loading Branch…",
  description,
  variant = "panel",
  className,
}: LoadingStateProps) {
  const screen = variant === "screen";

  return (
    <output
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex flex-col items-center justify-center gap-6 text-center text-foreground",
        screen ? "min-h-svh w-full bg-background p-8" : "p-6",
        className,
      )}
    >
      <div aria-hidden="true" className="relative flex h-24 w-40 items-center justify-center">
        <div className="absolute inset-0 rounded-2xl bg-muted/50 bg-grid-pattern opacity-40" />
        <svg viewBox="0 0 160 96" fill="none" className="relative h-full w-full">
          <path
            d="M52 48h16c16 0 12-24 28-24h12M68 48c16 0 12 24 28 24h12"
            className="stroke-border"
            strokeWidth="2"
          />
          <g className="fill-card stroke-border" strokeWidth="1.5">
            <rect x="24" y="34" width="28" height="28" rx="8" />
            <rect x="108" y="12" width="24" height="24" rx="6" />
            <rect x="108" y="60" width="24" height="24" rx="6" />
          </g>
          {[
            { cx: 38, cy: 48 },
            { cx: 120, cy: 24 },
            { cx: 120, cy: 72 },
          ].map(({ cx, cy }, step) => (
            <circle
              key={cy}
              cx={cx}
              cy={cy}
              r="3"
              className="branch-loading-dot fill-primary"
              style={{ animationDelay: `${step * 160}ms` }}
            />
          ))}
        </svg>
      </div>
      <div className="flex max-w-sm flex-col items-center gap-2">
        {screen && (
          <span aria-hidden="true" className="text-base font-semibold tracking-tight">
            Branch
          </span>
        )}
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoadingIndicator />
          {label}
        </span>
        {description && (
          <span className="text-pretty text-xs text-muted-foreground">{description}</span>
        )}
      </div>
    </output>
  );
}
