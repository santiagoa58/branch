import { useId, useLayoutEffect, useRef, type KeyboardEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NfrCategory } from "@/schemas/aiDesign";
import type { LineKind } from "@/utils/aiDesign/inputs";
import { inputClass } from "./briefEdits";

/** The brief's line sections, in the order the form shows them. */
export const LINE_SECTIONS: readonly {
  kind: LineKind;
  label: string;
  help: string;
  placeholder: string;
}[] = [
  {
    kind: "functional",
    label: "Functional requirements",
    help: "Required: at least one. What users can do, one per line.",
    placeholder: "Members add, edit and check off items\nMembers share a list with their household",
  },
  {
    kind: "nonFunctional",
    label: "Non-functional requirements",
    help: 'How well it must work, one per line. Start a line with a category such as "Latency:", or add one below.',
    placeholder: "Scale: 1M households\nLatency: a check-off shows for others within a second",
  },
  {
    kind: "constraint",
    label: "Constraints",
    help: "Fixed choices the design must work within, one per line.",
    placeholder: "Runs on AWS\nUses the existing Postgres database",
  },
  {
    kind: "outOfScope",
    label: "Out of scope",
    help: "What the design leaves out, one per line.",
    placeholder: "Payments\nRecipe suggestions",
  },
];

/**
 * Quick non-functional lines, one per category the stages know ("other" has no preset). Each adds
 * "<label>: <example>" with the example selected, ready to type over.
 */
const NFR_PRESETS: Record<Exclude<NfrCategory, "other">, { label: string; example: string }> = {
  scale: { label: "Scale", example: "1M daily active users" },
  latency: { label: "Latency", example: "p99 under 200 ms for reads" },
  availability: { label: "Availability", example: "99.9% uptime" },
  consistency: { label: "Consistency", example: "Reads see the latest write" },
  durability: { label: "Durability", example: "No acknowledged write is lost" },
  security: { label: "Security", example: "Only members can see a list" },
  cost: { label: "Cost", example: "Under $500 a month at launch" },
};

const SHARED_HELP = "Paste or type several at once; blank lines and repeats are ignored.";

// Keep typing away from the editor's canvas shortcuts (Escape clears the selection there).
const stopShortcuts = (event: KeyboardEvent<HTMLTextAreaElement>) => event.stopPropagation();

interface LinesFieldProps {
  section: (typeof LINE_SECTIONS)[number];
  value: string;
  onChange: (value: string) => void;
}

/** One section of the brief: a labelled multi-line box, one item per line. */
export function LinesField({ section, value, onChange }: LinesFieldProps) {
  const id = useId();
  const box = useRef<HTMLTextAreaElement>(null);
  // The example a preset just added, selected once the new value renders.
  const pendingSelection = useRef<[number, number] | null>(null);
  useLayoutEffect(() => {
    const range = pendingSelection.current;
    if (range && box.current) {
      pendingSelection.current = null;
      box.current.focus();
      box.current.setSelectionRange(...range);
    }
  }, [value]);

  const addPreset = ({ label, example }: { label: string; example: string }) => {
    const lead = value === "" || value.endsWith("\n") ? value : `${value}\n`;
    const start = lead.length + label.length + 2;
    pendingSelection.current = [start, start + example.length];
    onChange(`${lead}${label}: ${example}`);
  };
  const required = section.kind === "functional";

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${id}-box`} className="text-sm font-medium text-foreground">
        {section.label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <p id={`${id}-help`} className="text-xs leading-relaxed text-muted-foreground">
        {section.help} {SHARED_HELP}
      </p>
      <textarea
        ref={box}
        id={`${id}-box`}
        rows={3}
        value={value}
        required={required}
        aria-describedby={`${id}-help`}
        placeholder={section.placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={stopShortcuts}
        className={cn(inputClass, "resize-y font-normal leading-relaxed")}
      />
      {section.kind === "nonFunctional" && (
        <fieldset className="flex flex-wrap items-center gap-1.5">
          <legend className="mb-1 text-xs text-muted-foreground">
            Add a non-functional requirement
          </legend>
          {Object.values(NFR_PRESETS).map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="outline"
              size="xs"
              aria-label={`Add a ${preset.label.toLowerCase()} requirement`}
              onClick={() => addPreset(preset)}
            >
              <Plus aria-hidden="true" />
              {preset.label}
            </Button>
          ))}
        </fieldset>
      )}
    </div>
  );
}
