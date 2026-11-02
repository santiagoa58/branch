import { useId, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDesignPipeline } from "@/hooks/useDesignPipeline";
import { cn } from "@/lib/utils";
import type { RequirementKind, Scope } from "@/schemas/aiDesign";
import { useDiagramStore } from "@/store/diagramStore";
import { createBrief } from "@/utils/aiDesign/inputs";
import { inputClass, newId, sectionLabelClass } from "./briefEdits";
import { ChoiceButton } from "./ChoiceButton";
import { REPLACEMENT_NOTICE } from "./UpdateBar";

export const SCOPES: readonly { value: Scope; label: string; help: string }[] = [
  { value: "frontend", label: "Frontend", help: "Client side in detail; the backend is one box." },
  {
    value: "backend",
    label: "Backend",
    help: "Services, data and infrastructure in detail; clients are one box each.",
  },
  { value: "fullstack", label: "Full stack", help: "Both in detail." },
];

type LineKind = RequirementKind | "outOfScope";

const LINE_SECTIONS: readonly { kind: LineKind; title: string; item: string; addFor: string }[] = [
  {
    kind: "functional",
    title: "Functional",
    item: "Functional requirement",
    addFor: "functional requirements",
  },
  {
    kind: "nonFunctional",
    title: "Non-functional",
    item: "Non-functional requirement",
    addFor: "non-functional requirements",
  },
  { kind: "constraint", title: "Constraints", item: "Constraint", addFor: "constraints" },
  { kind: "outOfScope", title: "Out of scope", item: "Out of scope", addFor: "out of scope" },
];

const REQUIREMENT_KINDS: readonly RequirementKind[] = ["functional", "nonFunctional", "constraint"];

interface Line {
  key: number;
  text: string;
}

type Lines = Record<LineKind, Line[]>;

const noLines: Lines = { functional: [], nonFunctional: [], constraint: [], outOfScope: [] };

const filled = (lines: Line[]) => lines.map((line) => line.text.trim()).filter(Boolean);

/** Shown while the diagram has no brief: the prompt, the scope and optional starting lines. */
export function Composer() {
  const pipeline = useDesignPipeline();
  const [prompt, setPrompt] = useState("");
  const [scope, setScope] = useState<Scope>("fullstack");
  const [expanded, setExpanded] = useState(false);
  const [lines, setLines] = useState<Lines>(noLines);
  const [nextKey, setNextKey] = useState(0);
  const moreId = useId();
  const noticeId = useId();
  // A design started on a hand-made diagram replaces its components.
  const replaces = useDiagramStore((state) =>
    state.nodes.some((node) => node.type === "architecture"),
  );

  const addLine = (kind: LineKind) => {
    setLines((current) => ({ ...current, [kind]: [...current[kind], { key: nextKey, text: "" }] }));
    setNextKey((key) => key + 1);
  };
  const editLine = (kind: LineKind, key: number, text: string) =>
    setLines((current) => ({
      ...current,
      [kind]: current[kind].map((line) => (line.key === key ? { ...line, text } : line)),
    }));
  const removeLine = (kind: LineKind, key: number) =>
    setLines((current) => ({
      ...current,
      [kind]: current[kind].filter((line) => line.key !== key),
    }));

  const start = () => {
    const text = prompt.trim();
    if (!text) {
      return;
    }
    const requirements = REQUIREMENT_KINDS.flatMap((kind) =>
      filled(lines[kind]).map((line) => ({ kind, text: line })),
    );
    useDiagramStore
      .getState()
      .updateBrief(() => createBrief(text, scope, requirements, filled(lines.outOfScope), newId));
    void pipeline.update();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-foreground">
        What should we design?
        <textarea
          rows={4}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="A shared grocery list app for households. Members add items and check them off while shopping."
          className={cn(inputClass, "resize-y font-normal")}
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium text-foreground">How much detail?</legend>
        {SCOPES.map((option) => (
          <ChoiceButton
            key={option.value}
            selected={scope === option.value}
            onClick={() => setScope(option.value)}
          >
            <span className="text-sm font-semibold text-foreground">{option.label}</span>
            <span className="text-xs text-muted-foreground">{option.help}</span>
          </ChoiceButton>
        ))}
      </fieldset>

      <div className="rounded-lg border border-border">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={moreId}
          onClick={() => setExpanded((open) => !open)}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-muted"
        >
          Add requirements (optional)
          <ChevronDown
            aria-hidden="true"
            className={cn("size-4 transition-transform", expanded && "rotate-180")}
          />
        </button>
        {expanded && (
          <div id={moreId} className="flex flex-col gap-2 px-3 pb-3">
            {LINE_SECTIONS.map((section, sectionIndex) => (
              <div
                key={section.kind}
                className={cn("flex flex-col gap-2", sectionIndex > 0 && "mt-1.5")}
              >
                <p className={sectionLabelClass}>{section.title}</p>
                {lines[section.kind].map((line, index) => (
                  <div key={line.key} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      aria-label={`${section.item} ${index + 1}`}
                      value={line.text}
                      onChange={(event) => editLine(section.kind, line.key, event.target.value)}
                      className={inputClass}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${section.item.toLowerCase()} ${index + 1}`}
                      onClick={() => removeLine(section.kind, line.key)}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => addLine(section.kind)}
                >
                  <Plus aria-hidden="true" />
                  Add line<span className="sr-only"> for {section.addFor}</span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {replaces && (
        <p id={noticeId} className="text-xs leading-relaxed text-muted-foreground">
          {REPLACEMENT_NOTICE}
        </p>
      )}
      <Button
        size="lg"
        disabled={!prompt.trim()}
        aria-describedby={replaces ? noticeId : undefined}
        onClick={start}
      >
        Start design
      </Button>
    </div>
  );
}
