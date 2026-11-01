import { cn } from "@/lib/utils";

interface Props {
  gains: string[];
  costs: string[];
}

const textClassName = "whitespace-pre-wrap wrap-anywhere text-pretty";

// Side colours come from the --tradeoff-* tokens. Headings mix the token toward the foreground
// so they stay readable as text in both themes.
const sides = {
  gain: {
    label: "Gains",
    glyph: "+",
    marker: "text-tradeoff-gain",
    rule: "border-tradeoff-gain",
    heading: "text-[color-mix(in_oklab,var(--tradeoff-gain)_75%,var(--foreground))]",
  },
  cost: {
    label: "Costs",
    glyph: "−",
    marker: "text-tradeoff-cost",
    rule: "border-tradeoff-cost",
    heading: "text-[color-mix(in_oklab,var(--tradeoff-cost)_75%,var(--foreground))]",
  },
} as const;

function Side({ side, items }: { side: keyof typeof sides; items: string[] }) {
  const { label, glyph, marker, rule, heading } = sides[side];
  return (
    <section aria-label={label} className="min-w-0">
      <h4 className={cn("mb-1.5 text-xs font-semibold", heading)}>{label}</h4>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item}
            className={cn("flex min-w-0 items-start gap-2 border-l-2 pl-2 text-foreground", rule)}
          >
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-current text-xs leading-none font-semibold",
                marker,
              )}
            >
              <span className="text-card">{glyph}</span>
            </span>
            <span className={cn(textClassName, "min-w-0 text-sm")}>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** What a decision gains and what it costs, side by side when there is room. */
export function TradeoffList({ gains, costs }: Props) {
  if (gains.length === 0 && costs.length === 0) {
    return null;
  }
  const both = gains.length > 0 && costs.length > 0;
  return (
    <div className={cn("grid min-w-0 gap-3", both && "@xs:grid-cols-2")}>
      {gains.length > 0 && <Side side="gain" items={gains} />}
      {costs.length > 0 && <Side side="cost" items={costs} />}
    </div>
  );
}
