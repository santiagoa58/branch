import { cn } from "@/lib/utils";
import type { DesignDecision } from "@/types";
import { consideredKey, getDocumentedDecision, hasDesignDecision } from "@/utils/designDecision";

interface Props {
  value: DesignDecision | undefined;
  compact?: boolean;
}

const textClassName = "whitespace-pre-wrap wrap-anywhere text-pretty";

function ItemColumn({ label, items }: { label: string; items: string[] }) {
  return (
    <section
      aria-label={label}
      className="min-w-0 rounded-md border border-border bg-muted/40 px-3 py-2"
    >
      <h4 className="mb-1 text-xs font-semibold text-muted-foreground">{label}</h4>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item} className={cn(textClassName, "text-sm")}>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DesignDecisionSummary({ value, compact = false }: Props) {
  if (!hasDesignDecision(value)) {
    return <p className="text-sm text-muted-foreground">No decision documented yet.</p>;
  }
  const { choice, reason, benefits, drawbacks, considered, revisitWhen } =
    getDocumentedDecision(value);
  const columns = [
    { label: "Benefits", items: benefits },
    { label: "Drawbacks", items: drawbacks },
  ].filter((column) => column.items.length > 0);

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
      {columns.length > 0 && (
        <div className={cn("grid min-w-0 gap-2", columns.length === 2 && "@xs:grid-cols-2")}>
          {columns.map((column) => (
            <ItemColumn key={column.label} {...column} />
          ))}
        </div>
      )}
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
