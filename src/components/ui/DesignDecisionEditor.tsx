import type { DesignDecision } from "@/types";

interface Props {
  value: DesignDecision | undefined;
  onChange: (value: DesignDecision) => void;
}

const fields = [
  { key: "reason", label: "Why this approach?", hint: "What problem does it solve? Why this choice?" },
  { key: "alternatives", label: "Alternatives considered", hint: "Other designs and why they were not selected" },
  { key: "tradeoffs", label: "Tradeoffs and risks", hint: "Costs, latency, complexity, reliability, limitations" },
  { key: "assumptions", label: "Assumptions", hint: "Load, constraints, requirements, and what could change" },
] as const;

export function DesignDecisionEditor({ value, onChange }: Props) {
  const hasDecision = Object.values(value ?? {}).some((item) => item?.trim());
  return (
    <details
      className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-3"
      open={undefined}
    >
      <summary className="cursor-pointer text-xs font-semibold text-foreground">
        Design reasoning & tradeoffs {hasDecision ? "• Documented" : "• Add"}
      </summary>
      <p className="mt-2 mb-3 text-[10px] text-muted-foreground">
        Explain decisions in context. These notes stay attached to this element.
      </p>
      <div className="space-y-3">
        {fields.map(({ key, label, hint }) => (
          <label key={key} className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-muted-foreground">{label}</span>
            <textarea
              aria-label={label}
              rows={2}
              placeholder={hint}
              value={value?.[key] ?? ""}
              onChange={(event) => onChange({ ...value, [key]: event.target.value })}
              onKeyDown={(event) => event.stopPropagation()}
              className="w-full resize-y rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground"
            />
          </label>
        ))}
      </div>
    </details>
  );
}
