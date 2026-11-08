import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { inputClass } from "./briefEdits";

interface InlineEditProps {
  /** Accessible name of the text field. */
  label: string;
  initial?: string;
  placeholder?: string;
  onSave: (text: string) => void;
  onCancel: () => void;
}

/** A one-line editor with Save and Cancel; Enter saves, Escape cancels, blank text never saves. */
export function InlineEdit({
  label,
  initial = "",
  placeholder,
  onSave,
  onCancel,
}: InlineEditProps) {
  const [text, setText] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  // The field opens in response to the user's own click, so focus follows it.
  useEffect(() => input.current?.focus(), []);
  const trimmed = text.trim();

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Keep typing away from the editor's canvas shortcuts (Escape clears the selection there).
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <form
      className="flex w-full flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed) {
          onSave(trimmed);
        }
      }}
    >
      <input
        type="text"
        aria-label={label}
        value={text}
        placeholder={placeholder}
        ref={input}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        className={inputClass}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!trimmed}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
