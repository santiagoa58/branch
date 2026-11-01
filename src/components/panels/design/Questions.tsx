import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useDesignPipeline } from "@/hooks/useDesignPipeline";
import { cn } from "@/lib/utils";
import type { DesignBrief } from "@/schemas/aiDesign";
import { answerQuestion, assumeRemaining } from "@/utils/aiDesign/inputs";
import { editBrief, inputClass, newId, tagClass } from "./briefEdits";

type Question = DesignBrief["questions"][number];

/** A chosen option, or a written answer (`custom`). */
interface Draft {
  custom: boolean;
  text: string;
}

/** Selected answers stay local until Continue or Assume; a new round of questions starts empty. */
function useDrafts(questions: Question[]) {
  const [state, setState] = useState<{ questions: Question[]; drafts: Record<string, Draft> }>({
    questions,
    drafts: {},
  });
  const drafts = state.questions === questions ? state.drafts : {};
  const setDraft = (id: string, draft: Draft) =>
    setState({ questions, drafts: { ...drafts, [id]: draft } });
  return { drafts, setDraft };
}

function QuestionCard({
  question,
  draft,
  onChange,
}: {
  question: Question;
  draft: Draft | undefined;
  onChange: (draft: Draft) => void;
}) {
  const freeText = question.options.length === 0;
  const writing = freeText || draft?.custom === true;
  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
      <legend className="sr-only">{question.question}</legend>
      <p aria-hidden="true" className="text-sm font-semibold leading-snug text-foreground">
        {question.question}
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">{question.why}</p>
      <div className="flex flex-col gap-1.5">
        {question.options.map((option) => {
          const selected = draft?.custom === false && draft.text === option.label;
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange({ custom: false, text: option.label })}
              className={cn(
                "flex min-h-11 flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                selected
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:border-zinc-400 dark:hover:border-zinc-600",
              )}
            >
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-medium text-foreground">{option.label}</span>
                {option.label === question.recommended && (
                  <span className={tagClass}>Recommended</span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">{option.impact}</span>
            </button>
          );
        })}
        {writing ? (
          <input
            type="text"
            aria-label={question.question}
            value={draft?.custom ? draft.text : ""}
            placeholder={freeText ? question.recommended : "Your answer"}
            onChange={(event) => onChange({ custom: true, text: event.target.value })}
            className={inputClass}
          />
        ) : (
          question.allowsCustom && (
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => onChange({ custom: true, text: "" })}
            >
              Write my own answer
            </Button>
          )
        )}
      </div>
    </fieldset>
  );
}

/** Stage 1's open questions. Continue and Assume the rest both record answers and run the update. */
export function Questions({ brief }: { brief: DesignBrief }) {
  const pipeline = useDesignPipeline();
  const { questions } = brief;
  const { drafts, setDraft } = useDrafts(questions);
  const answerOf = (question: Question) => drafts[question.id]?.text.trim() ?? "";
  const allAnswered = questions.every((question) => answerOf(question) !== "");
  const updating = brief.ranFrom.components !== undefined;

  const record = (current: DesignBrief) =>
    questions.reduce((next, question) => {
      const answer = answerOf(question);
      return answer ? answerQuestion(next, question.question, answer, newId) : next;
    }, current);

  const submit = (assumeRest: boolean) => {
    editBrief((current) =>
      assumeRest ? assumeRemaining(record(current), newId) : record(current),
    );
    void pipeline.update();
  };

  const one = questions.length === 1;
  const title = updating
    ? one
      ? "One question before updating"
      : "A few questions before updating"
    : one
      ? "One question first"
      : "A few questions first";

  return (
    <section aria-label="Questions" className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          These change which components the design needs. Anything smaller is assumed and listed for
          you to check.
        </p>
      </div>
      {questions.map((question) => (
        <QuestionCard
          key={question.id}
          question={question}
          draft={drafts[question.id]}
          onChange={(draft) => setDraft(question.id, draft)}
        />
      ))}
      <div className="flex flex-wrap gap-2">
        <Button disabled={!allAnswered} onClick={() => submit(false)}>
          Continue
        </Button>
        <Button variant="outline" onClick={() => submit(true)}>
          Assume the rest for me
        </Button>
      </div>
    </section>
  );
}
