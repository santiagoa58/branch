import { useMemo, useRef, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** Other tags in the diagram, used to suggest as the user types. */
  suggestions?: string[];
  placeholder?: string;
}

/**
 * Chip-style tag input. Enter / comma / Tab adds the typed token; Backspace
 * on an empty input removes the last chip. Suggestions filter by prefix
 * (case-insensitive) and appear in a popover below the input.
 */
export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "Add tag…",
}: TagInputProps) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const lowerExisting = useMemo(() => new Set(value.map((t) => t.toLowerCase())), [value]);

  const filteredSuggestions = useMemo(() => {
    const q = draft.trim().toLowerCase();
    if (!q) {
      return [];
    }
    return suggestions
      .filter((s) => !lowerExisting.has(s.toLowerCase()) && s.toLowerCase().startsWith(q))
      .slice(0, 6);
  }, [draft, suggestions, lowerExisting]);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return;
    }
    if (lowerExisting.has(trimmed.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, trimmed]);
    setDraft("");
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="relative">
      <div
        className={cn(
          "flex flex-wrap items-center gap-1 px-2 py-1.5 min-h-[34px]",
          "bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded",
          "cursor-text transition-colors",
          focused && "border-zinc-400 dark:border-zinc-600",
        )}
      >
        {value.map((tag, idx) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(idx);
              }}
              className="opacity-50 hover:opacity-100 transition-opacity"
              aria-label={`Remove ${tag}`}
            >
              <XMarkIcon className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commit(draft);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
              if (draft.trim()) {
                e.preventDefault();
                commit(draft);
              }
            } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
              e.preventDefault();
              remove(value.length - 1);
            }
          }}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[60px] bg-transparent outline-none text-xs text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-600"
        />
      </div>

      {focused && filteredSuggestions.length > 0 && (
        <div
          className={cn(
            "absolute top-full left-0 right-0 mt-1 z-30",
            "bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-md",
            "shadow-lg shadow-black/10 dark:shadow-black/40 overflow-hidden",
          )}
        >
          {filteredSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => {
                // mousedown beats blur so the suggestion lands before the input clears.
                e.preventDefault();
                commit(s);
                inputRef.current?.focus();
              }}
              className="w-full text-left px-3 py-1.5 text-[11px] font-mono text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
