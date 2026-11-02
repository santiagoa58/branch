import { TradeoffList } from "@/components/ui/TradeoffList";
import { cn } from "@/lib/utils";
import type { DesignDecision } from "@/types";
import { consideredKey, getDocumentedDecision, hasDesignDecision } from "@/utils/designDecision";

interface Props {
  value: DesignDecision | undefined;
  compact?: boolean;
}

const textClassName = "whitespace-pre-wrap wrap-anywhere text-pretty";

export function DesignDecisionSummary({ value, compact = false }: Props) {
  if (!hasDesignDecision(value)) {
    return <p className="text-sm text-muted-foreground">No decision documented yet.</p>;
  }
  const { choice, reason, benefits, drawbacks, considered, revisitWhen } =
    getDocumentedDecision(value);

  return (
    <section
      aria-label="Decision"
      className={cn(
        "@container flex min-w-0 flex-col text-foreground",
        compact ? "gap-3" : "gap-4",
      )}
    >
      {(choice || reason) && (
        <div className="min-w-0 space-y-1">
          {choice && (
            <p className={cn(textClassName, "text-base font-semibold")}>
              <span className="sr-only">Chose </span>
              {choice}
            </p>
          )}
          {reason && <p className={cn(textClassName, "text-sm text-muted-foreground")}>{reason}</p>}
        </div>
      )}
      <TradeoffList gains={benefits} costs={drawbacks} />
      {considered.length > 0 && (
        <section aria-label="Considered instead" className="min-w-0">
          <h4 className="mb-1 text-xs font-semibold text-muted-foreground">Considered instead</h4>
          <ul className="divide-y divide-border rounded-md border border-border">
            {considered.map((item) => (
              <li key={consideredKey(item)} className={cn(textClassName, "px-3 py-2 text-sm")}>
                <span className="font-medium">{item.option}</span>
                {item.whyNot && (
                  <span className="text-muted-foreground">
                    {item.option ? " — " : ""}
                    {item.whyNot}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {revisitWhen.length > 0 && (
        <section aria-label="Revisit when" className="min-w-0">
          <h4 className="mb-1 text-xs font-semibold text-muted-foreground">Revisit when</h4>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {revisitWhen.map((item) => (
              <li key={item} className={cn(textClassName, "text-sm")}>
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
