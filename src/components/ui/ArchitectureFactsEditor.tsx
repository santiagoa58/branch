import { useState } from "react";

interface ArchitectureFactsEditorProps {
  metadata: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}

/** Editable architecture decisions shared by frontend, backend and infrastructure nodes. */
export function ArchitectureFactsEditor({ metadata, onChange }: ArchitectureFactsEditorProps) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const add = () => {
    const name = key.trim();
    if (!name) {
      setError("Enter an attribute name.");
      return;
    }
    if (Object.keys(metadata).some((existing) => existing.toLowerCase() === name.toLowerCase())) {
      setError("An attribute with that name already exists.");
      return;
    }
    onChange({ ...metadata, [name]: value.trim() });
    setKey("");
    setValue("");
    setError("");
  };

  return (
    <section className="flex flex-col gap-2">
      <div>
        <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Architecture attributes
        </h3>
        <p className="text-[10px] text-muted-foreground mt-1">
          TTLs, partitions, consistency, retries, state, capacity, or design decisions.
          The first three attributes appear on the node.
        </p>
      </div>
      {Object.entries(metadata).map(([name, current]) => (
        <div className="flex items-center gap-1.5" key={name}>
          <span title={name} className="text-[10px] flex-1 min-w-0 truncate text-foreground">
            {name}
          </span>
          <input
            aria-label={`Value for ${name}`}
            value={current}
            onChange={(event) => onChange({ ...metadata, [name]: event.target.value })}
            onKeyDown={(event) => event.stopPropagation()}
            className="w-24 min-w-0 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-2 py-1 text-xs text-foreground"
          />
          <button
            type="button"
            aria-label={`Remove ${name}`}
            onClick={() => onChange(Object.fromEntries(Object.entries(metadata).filter(([k]) => k !== name)))}
            className="px-1 text-xs text-muted-foreground hover:text-red-600"
          >
            ×
          </button>
        </div>
      ))}
      <div className="flex gap-1.5">
        <input
          aria-label="Attribute key"
          value={key}
          placeholder="Key"
          onChange={(event) => { setKey(event.target.value); setError(""); }}
          onKeyDown={(event) => event.stopPropagation()}
          className="min-w-0 flex-1 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-2 py-1 text-xs text-foreground"
        />
        <input
          aria-label="Attribute value"
          value={value}
          placeholder="Value"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Enter") {
              add();
            } }}
          className="w-20 min-w-0 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-2 py-1 text-xs text-foreground"
        />
      </div>
      {error && <p role="alert" className="text-[10px] text-red-600">{error}</p>}
      <button type="button" onClick={add} className="self-start rounded border border-zinc-200 dark:border-zinc-800 px-2 py-1 text-xs text-foreground">
        Add attribute
      </button>
    </section>
  );
}
