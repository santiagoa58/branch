import { useId, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ConsideredOption, DesignDecision } from "@/types";
import { getDesignDecision, toDesignDecision } from "@/utils/designDecision";
import type { DesignDecisionView } from "@/utils/designDecision";

interface Props {
  value: DesignDecision | undefined;
  onChange: (value: DesignDecision) => void;
}

// Short limits keep each entry scannable instead of growing into paragraphs.
export const DECISION_LIMITS = { choice: 80, reason: 200, item: 120 } as const;

type ListKey = "benefits" | "drawbacks" | "revisitWhen";

const listFields: Record<
  ListKey,
  { label: string; item: string; hint: string; placeholder: string }
> = {
  benefits: {
    label: "Gains",
    item: "gain",
    hint: "What this choice gives you.",
    placeholder: "Schema changes ship without client releases",
  },
  drawbacks: {
    label: "Costs",
    item: "cost",
    hint: "What this choice costs or risks.",
    placeholder: "Adds a network hop to every request",
  },
  revisitWhen: {
    label: "Revisit when",
    item: "revisit trigger",
    hint: "Changes that would make you reconsider.",
    placeholder: "Writes outgrow a single primary",
  },
};

const inputClassName =
  "w-full min-w-0 rounded border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const keyboardSafety = {
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
    event.stopPropagation();
    if (
      event.key === "Enter" &&
      !event.nativeEvent.isComposing &&
      event.target instanceof HTMLInputElement
    ) {
      event.preventDefault();
    }
  },
  onKeyUp: (event: KeyboardEvent<HTMLElement>) => event.stopPropagation(),
};

/**
 * Stable keys for rows that have no identity of their own, so removing a row keeps focus and
 * input state on the rows that remain. Counts changed from outside (undo, a new selection)
 * resync by trimming or appending keys during render.
 */
function useRowKeys(count: number) {
  const [state, setState] = useState(() => ({
    keys: Array.from({ length: count }, (_, i) => i),
    next: count,
  }));
  let { keys, next } = state;
  if (keys.length !== count) {
    const added = Math.max(0, count - keys.length);
    keys = [...keys.slice(0, count), ...Array.from({ length: added }, (_, i) => next + i)];
    next += added;
    setState({ keys, next });
  }
  const remove = (index: number) =>
    setState((current) => ({ ...current, keys: current.keys.filter((_, i) => i !== index) }));
  return { keys, remove };
}

function ListFieldset({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <fieldset aria-describedby={`${id}-hint`} className="flex min-w-0 flex-col gap-2">
      <legend className="text-sm font-semibold text-foreground">{label}</legend>
      <p id={`${id}-hint`} className="-mt-1 text-xs text-muted-foreground text-pretty">
        {hint}
      </p>
      {children}
    </fieldset>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      onClick={onClick}
      {...keyboardSafety}
    >
      <X aria-hidden="true" />
    </Button>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="self-start"
      onClick={onClick}
      {...keyboardSafety}
    >
      <Plus aria-hidden="true" />
      {label}
    </Button>
  );
}

function ItemList({
  id,
  label,
  item,
  hint,
  placeholder,
  items,
  onChange,
}: {
  id: string;
  label: string;
  item: string;
  hint: string;
  placeholder: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const { keys, remove } = useRowKeys(items.length);
  const rows = items.map((value, index) => ({ key: keys[index], value }));
  return (
    <ListFieldset id={id} label={label} hint={hint}>
      {rows.map(({ key, value }, index) => (
        <div key={key} className="flex min-w-0 items-center gap-1">
          <input
            {...keyboardSafety}
            aria-label={`${label} ${index + 1}`}
            maxLength={DECISION_LIMITS.item}
            placeholder={index === 0 ? placeholder : undefined}
            value={value}
            onChange={(event) =>
              onChange(items.map((current, i) => (i === index ? event.target.value : current)))
            }
            className={inputClassName}
          />
          <RemoveButton
            label={`Remove ${item} ${index + 1}`}
            onClick={() => {
              remove(index);
              onChange(items.filter((_, i) => i !== index));
            }}
          />
        </div>
      ))}
      <AddButton label={`Add ${item}`} onClick={() => onChange([...items, ""])} />
    </ListFieldset>
  );
}

function ConsideredList({
  id,
  items,
  onChange,
}: {
  id: string;
  items: ConsideredOption[];
  onChange: (items: ConsideredOption[]) => void;
}) {
  const { keys, remove } = useRowKeys(items.length);
  const rows = items.map((considered, index) => ({ key: keys[index], considered }));
  const update = (index: number, next: ConsideredOption) =>
    onChange(items.map((current, i) => (i === index ? next : current)));

  return (
    <ListFieldset
      id={id}
      label="Considered instead"
      hint="Other options and why you didn't pick them."
    >
      {rows.map(({ key, considered }, index) => (
        <div key={key} className="flex min-w-0 items-start gap-1">
          <div className="grid min-w-0 flex-1 gap-1">
            <input
              {...keyboardSafety}
              aria-label={`Option ${index + 1}`}
              maxLength={DECISION_LIMITS.item}
              placeholder={index === 0 ? "Clients query the database directly" : "Option"}
              value={considered.option}
              onChange={(event) => update(index, { ...considered, option: event.target.value })}
              className={cn(inputClassName, "font-medium")}
            />
            <input
              {...keyboardSafety}
              aria-label={`Why not option ${index + 1}`}
              maxLength={DECISION_LIMITS.item}
              placeholder={index === 0 ? "Auth logic would leak into every app" : "Why not"}
              value={considered.whyNot ?? ""}
              onChange={(event) => update(index, { ...considered, whyNot: event.target.value })}
              className={inputClassName}
            />
          </div>
          <RemoveButton
            label={`Remove option ${index + 1}`}
            onClick={() => {
              remove(index);
              onChange(items.filter((_, i) => i !== index));
            }}
          />
        </div>
      ))}
      <AddButton label="Add option" onClick={() => onChange([...items, { option: "" }])} />
    </ListFieldset>
  );
}

export function DesignDecisionEditor({ value, onChange }: Props) {
  const id = useId();
  const view = getDesignDecision(value);
  const update = (patch: Partial<DesignDecisionView>) =>
    onChange(toDesignDecision({ ...view, ...patch }));
  const renderList = (key: ListKey) => (
    <ItemList
      id={`${id}-${key}`}
      {...listFields[key]}
      items={view[key]}
      onChange={(items) => update({ [key]: items })}
    />
  );

  return (
    <section aria-labelledby={`${id}-heading`} className="min-w-0 space-y-5">
      <div>
        <h3 id={`${id}-heading`} className="text-sm font-semibold text-foreground text-balance">
          Decision
        </h3>
        <p className="mt-1 text-xs text-muted-foreground text-pretty">
          Name the approach, say why in a sentence, then list what it gives and costs.
        </p>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={`${id}-choice`} className="text-sm font-semibold text-foreground">
          Chosen approach
        </label>
        <input
          {...keyboardSafety}
          id={`${id}-choice`}
          maxLength={DECISION_LIMITS.choice}
          placeholder="Postgres as the system of record"
          value={view.choice}
          onChange={(event) => update({ choice: event.target.value })}
          className={cn(inputClassName, "font-medium")}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={`${id}-reason`} className="text-sm font-semibold text-foreground">
          Why
        </label>
        <p id={`${id}-reason-hint`} className="text-xs text-muted-foreground text-pretty">
          One sentence on why this fits.
        </p>
        <textarea
          {...keyboardSafety}
          id={`${id}-reason`}
          aria-describedby={`${id}-reason-hint`}
          rows={2}
          maxLength={DECISION_LIMITS.reason}
          value={view.reason}
          onChange={(event) => update({ reason: event.target.value })}
          className={cn(inputClassName, "resize-y")}
        />
      </div>
      {renderList("benefits")}
      {renderList("drawbacks")}
      <ConsideredList
        id={`${id}-considered`}
        items={view.considered}
        onChange={(considered) => update({ considered })}
      />
      {renderList("revisitWhen")}
    </section>
  );
}
