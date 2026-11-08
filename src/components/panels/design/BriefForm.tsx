import { useId, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Scope } from "@/schemas/aiDesign";
import { draftMissing, type BriefDraft } from "@/utils/aiDesign/inputs";
import { inputClass } from "./briefEdits";
import { ChoiceButton } from "./ChoiceButton";
import { LINE_SECTIONS, LinesField } from "./LinesField";
import { REPLACEMENT_NOTICE } from "./UpdateBar";

const SCOPES: readonly { value: Scope; label: string; help: string }[] = [
  { value: "frontend", label: "Frontend", help: "Client side in detail; the backend is one box." },
  {
    value: "backend",
    label: "Backend",
    help: "Services, data and infrastructure in detail; clients are one box each.",
  },
  { value: "fullstack", label: "Full stack", help: "Both in detail." },
];

export const emptyDraft = (): BriefDraft => ({
  prompt: "",
  scope: "fullstack",
  lines: { functional: "", nonFunctional: "", constraint: "", outOfScope: "" },
});

/** Why the action is disabled, or null once the draft has a prompt and a functional line. */
function missingMessage(draft: BriefDraft, verb: string): string | null {
  const missing = draftMissing(draft);
  if (missing.prompt && missing.functional) {
    return `Describe the system and add at least one functional requirement to ${verb} the design.`;
  }
  if (missing.prompt) {
    return `Describe the system to ${verb} the design.`;
  }
  if (missing.functional) {
    return `Add at least one functional requirement to ${verb} the design.`;
  }
  return null;
}

const stopShortcuts = (event: KeyboardEvent<HTMLTextAreaElement>) => event.stopPropagation();

interface BriefFormProps {
  initial: BriefDraft;
  /** The action's label, such as "Generate design"; `verb` ("generate") explains why it waits. */
  action: string;
  verb: string;
  /** Whether running the design replaces components already on the canvas. */
  replaces: boolean;
  onSubmit: (draft: BriefDraft) => void;
  onCancel?: () => void;
}

/**
 * The user's inputs as one form: the prompt, the scope and a multi-line box per section. The
 * prompt and at least one functional line are required.
 */
export function BriefForm({ initial, action, verb, replaces, onSubmit, onCancel }: BriefFormProps) {
  const id = useId();
  const [draft, setDraft] = useState(initial);
  const missing = missingMessage(draft, verb);
  const describedBy = [missing ? `${id}-missing` : "", replaces ? `${id}-notice` : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!missing) {
          onSubmit(draft);
        }
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-prompt`} className="text-sm font-medium text-foreground">
          What should we design?<span aria-hidden="true"> *</span>
        </label>
        <textarea
          id={`${id}-prompt`}
          rows={4}
          required
          value={draft.prompt}
          onChange={(event) => setDraft({ ...draft, prompt: event.target.value })}
          onKeyDown={stopShortcuts}
          placeholder="A shared grocery list app for households. Members add items and check them off while shopping."
          className={cn(inputClass, "resize-y font-normal")}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-foreground">How much detail?</legend>
        {SCOPES.map((option) => (
          <ChoiceButton
            key={option.value}
            selected={draft.scope === option.value}
            onClick={() => setDraft({ ...draft, scope: option.value })}
          >
            <span className="text-sm font-semibold text-foreground">{option.label}</span>
            <span className="text-xs text-muted-foreground">{option.help}</span>
          </ChoiceButton>
        ))}
      </fieldset>

      {LINE_SECTIONS.map((section) => (
        <LinesField
          key={section.kind}
          section={section}
          value={draft.lines[section.kind]}
          onChange={(text) =>
            setDraft({ ...draft, lines: { ...draft.lines, [section.kind]: text } })
          }
        />
      ))}

      {missing && (
        <p id={`${id}-missing`} className="text-xs leading-relaxed text-muted-foreground">
          {missing}
        </p>
      )}
      {replaces && (
        <p id={`${id}-notice`} className="text-xs leading-relaxed text-muted-foreground">
          {REPLACEMENT_NOTICE}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          type="submit"
          size="lg"
          className="flex-1"
          disabled={missing !== null}
          aria-describedby={describedBy || undefined}
        >
          {action}
        </Button>
        {onCancel && (
          <Button type="button" size="lg" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
