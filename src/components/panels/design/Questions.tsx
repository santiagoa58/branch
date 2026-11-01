import { useId } from "react";
import { Button } from "@/components/ui/button";
import { useDesignPipeline } from "@/hooks/useDesignPipeline";
import { cn } from "@/lib/utils";
import type { DesignBrief } from "@/schemas/aiDesign";
import { useUIStore, type QuestionDraft } from "@/store/uiStore";
import { answerQuestion, assumeRemaining } from "@/utils/aiDesign/inputs";
import { editBrief, inputClass, newId, tagClass } from "./briefEdits";

type Question = DesignBrief["questions"][number];

type Draft = QuestionDraft;

/**
 * Selected answers are kept in the UI store until Continue or Assume, by question text, so they
 * survive the inspector taking the panel's slot. A new round of questions starts empty.
 */
function useDrafts(questions: Question[]) {
  const stored = useUIStore((state) => state.questionDrafts);
  const setQuestionDraft = useUIStore((state) => state.setQuestionDraft);
  const drafts = stored.questions === questions ? stored.drafts : {};
  const setDraft = (question: string, draft: Draft) => setQuestionDraft(questions, question, draft);
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
  const hintId = useId();
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
            placeholder="Your answer"
            aria-describedby={freeText ? hintId : undefined}
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
        {freeText && (
          <p id={hintId} className="text-xs text-muted-foreground">
            Recommended: <span className="text-foreground">{question.recommended}</span>
          </p>
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
  const answerOf = (question: Question) => drafts[question.question]?.text.trim() ?? "";
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
          draft={drafts[question.question]}
          onChange={(draft) => setDraft(question.question, draft)}
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
