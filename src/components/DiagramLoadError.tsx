import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { LoadFailure } from "@/services/cloudPersistence";

const TITLES: Record<LoadFailure, string> = {
  unreadable: "This diagram can't be opened",
  missing: "Diagram not found",
  unavailable: "Couldn't load this diagram",
};

interface DiagramLoadErrorProps {
  failure: LoadFailure | undefined;
  message: string | null;
  onRetry: () => void;
}

/** Explains why a diagram didn't open and offers only the actions that can help. */
export function DiagramLoadError({
  failure = "unavailable",
  message,
  onRetry,
}: DiagramLoadErrorProps) {
  return (
    <div role="alert" className="flex-1 grid place-content-center p-6">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <h2 className="text-base font-semibold text-foreground text-balance">{TITLES[failure]}</h2>
        {message && <p className="text-sm text-muted-foreground text-pretty">{message}</p>}
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          {failure === "unavailable" && (
            <button type="button" onClick={onRetry} className={buttonVariants()}>
              Retry
            </button>
          )}
          <Link
            to="/"
            className={cn(
              buttonVariants({ variant: failure === "unavailable" ? "outline" : "default" }),
            )}
          >
            Back to projects
          </Link>
        </div>
      </div>
    </div>
  );
}
