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

const TRUNK = "M52 48h16";
const FORKS = ["M68 48c16 0 12-24 28-24h12", "M68 48c16 0 12 24 28 24h12"];

/** A request signal travelling from one service through a fork to two others. */
function BranchSignalArtwork() {
  return (
    <svg aria-hidden="true" viewBox="0 0 160 96" fill="none" className="h-24 w-40">
      <g className="stroke-border" strokeWidth="2" strokeLinecap="round">
        <path d={TRUNK} />
        {FORKS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <g className="stroke-primary" strokeWidth="2.5" strokeLinecap="round">
        <path d={TRUNK} pathLength={1} className="branch-signal branch-signal-trunk" />
        {FORKS.map((d) => (
          <path key={d} d={d} pathLength={1} className="branch-signal branch-signal-fork" />
        ))}
      </g>
      <g className="fill-card" strokeWidth="1.5">
        <rect
          x="24"
          y="34"
          width="28"
          height="28"
          rx="8"
          className="branch-node branch-node-source"
        />
        <rect
          x="108"
          y="12"
          width="24"
          height="24"
          rx="6"
          className="branch-node branch-node-target"
        />
        <rect
          x="108"
          y="60"
          width="24"
          height="24"
          rx="6"
          className="branch-node branch-node-target"
        />
      </g>
    </svg>
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
      <BranchSignalArtwork />
      <div className="flex max-w-sm flex-col items-center gap-1">
        <span className="text-sm text-muted-foreground">{label}</span>
        {description && (
          <span className="text-pretty text-xs text-muted-foreground">{description}</span>
        )}
      </div>
    </output>
  );
}
