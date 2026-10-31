import { useId, useState } from "react";
import type { KeyboardEvent } from "react";
import type { ArchitectureAttribute } from "@/types";
import { architectureAttributeInputSchema } from "@/schemas/diagram";
import { cn } from "@/lib/utils";

interface ArchitectureFactsEditorProps {
  attributes: ArchitectureAttribute[];
  onChange: (next: ArchitectureAttribute[]) => void;
}

const inputClassName =
  "w-full min-w-0 rounded border border-input bg-background px-2 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const buttonClassName =
  "rounded border border-border px-2 py-1 text-sm font-semibold text-foreground hover:bg-accent active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const suggestedUnits = [
  "ms",
  "s",
  "min",
  "h",
  "days",
  "B",
  "KB",
  "MB",
  "GB",
  "MiB",
  "GiB",
  "%",
  "requests/s",
  "messages/s",
  "count",
  "replicas",
  "partitions",
  "connections",
];

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

function AttributeRow({
  attribute,
  unitsId,
  onChange,
  onRemove,
}: {
  attribute: ArchitectureAttribute;
  unitsId: string;
  onChange: (next: ArchitectureAttribute) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState({
    source: attribute,
    value: attribute.value,
    unit: attribute.unit ?? "",
    error: "",
  });
  const errorId = useId();

  if (
    draft.source.name !== attribute.name ||
    draft.source.value !== attribute.value ||
    draft.source.unit !== attribute.unit
  ) {
    setDraft({ source: attribute, value: attribute.value, unit: attribute.unit ?? "", error: "" });
  }
  const { value, unit, error } = draft;

  const update = (nextValue: string, nextUnit: string) => {
    const result = architectureAttributeInputSchema.safeParse({
      name: attribute.name,
      value: nextValue,
      ...(nextUnit.trim() ? { unit: nextUnit.trim() } : {}),
    });
    setDraft({
      source: attribute,
      value: nextValue,
      unit: nextUnit,
      error: result.success
        ? ""
        : (result.error.issues[0]?.message ?? "Check the attribute fields."),
    });
    if (result.success) {
      onChange(result.data);
    }
  };

  return (
    <fieldset className="min-w-0 rounded border border-border p-2">
      <legend className="max-w-full truncate px-1 text-xs font-semibold text-foreground">
        {attribute.name}
      </legend>
      <div className="grid grid-cols-2 gap-2">
        <label className="min-w-0 text-xs text-muted-foreground">
          Value
          <input
            {...keyboardSafety}
            aria-label={`Value for ${attribute.name}`}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            value={value}
            onChange={(event) => update(event.target.value, unit)}
            className={inputClassName}
          />
        </label>
        <label className="min-w-0 text-xs text-muted-foreground">
          Unit
          <input
            {...keyboardSafety}
            aria-label={`Unit for ${attribute.name}`}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            value={unit}
            list={unitsId}
            placeholder="None for text"
            onChange={(event) => update(value, event.target.value)}
            className={inputClassName}
          />
        </label>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
      <button
        type="button"
        {...keyboardSafety}
        aria-label={`Remove ${attribute.name}`}
        onClick={onRemove}
        className={cn(buttonClassName, "mt-2")}
      >
        Remove
      </button>
    </fieldset>
  );
}

/** Unit-aware facts shared by frontend, backend and infrastructure nodes. */
export function ArchitectureFactsEditor({ attributes, onChange }: ArchitectureFactsEditorProps) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [error, setError] = useState("");
  const id = useId();
  const unitsId = `${id}-units`;
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;

  const add = () => {
    const result = architectureAttributeInputSchema.safeParse({
      name: name.trim(),
      value: value.trim(),
      ...(unit.trim() ? { unit: unit.trim() } : {}),
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Check the attribute fields.");
      return;
    }
    if (
      attributes.some(
        (attribute) => attribute.name.trim().toLowerCase() === result.data.name.toLowerCase(),
      )
    ) {
      setError("An attribute with that name already exists.");
      return;
    }
    onChange([...attributes, result.data]);
    setName("");
    setValue("");
    setUnit("");
    setError("");
  };

  const addOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
      add();
    }
  };

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-2">
      <div>
        <h3 id={`${id}-heading`} className="text-xs font-semibold text-muted-foreground">
          Architecture attributes
        </h3>
        <p id={helpId} className="mt-1 text-xs text-muted-foreground">
          Give numeric values a unit, including count or replicas. Leave units empty for textual
          policies. The first three attributes appear on the node.
        </p>
      </div>
      <datalist id={unitsId}>
        {suggestedUnits.map((suggestion) => (
          <option key={suggestion} value={suggestion}>
            {suggestion}
          </option>
        ))}
      </datalist>
      {attributes.map((attribute, index) => (
        <AttributeRow
          key={attribute.name}
          attribute={attribute}
          unitsId={unitsId}
          onChange={(next) =>
            onChange(
              attributes.map((current, currentIndex) => (currentIndex === index ? next : current)),
            )
          }
          onRemove={() => onChange(attributes.filter((_, currentIndex) => currentIndex !== index))}
        />
      ))}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Name", value: name, setValue: setName },
          { label: "Value", value, setValue },
          { label: "Unit", value: unit, setValue: setUnit },
        ].map((field) => (
          <label
            key={field.label}
            className={cn(
              "min-w-0 text-xs text-muted-foreground",
              field.label === "Name" && "col-span-2",
            )}
          >
            {field.label}
            <input
              {...keyboardSafety}
              aria-label={`Attribute ${field.label.toLowerCase()}`}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${helpId} ${errorId}` : helpId}
              value={field.value}
              list={field.label === "Unit" ? unitsId : undefined}
              onChange={(event) => {
                field.setValue(event.target.value);
                setError("");
              }}
              onKeyDown={(event) => {
                keyboardSafety.onKeyDown(event);
                addOnEnter(event);
              }}
              className={inputClassName}
            />
          </label>
        ))}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <button
        {...keyboardSafety}
        type="button"
        onClick={add}
        className={cn(buttonClassName, "self-start")}
      >
        Add attribute
      </button>
    </section>
  );
}
