import { useId, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useDesignPipeline } from "@/hooks/useDesignPipeline";
import { cn } from "@/lib/utils";
import type { DesignBrief } from "@/schemas/aiDesign";
import { useDiagramStore } from "@/store/diagramStore";
import { useUIStore, type QuestionDraft } from "@/store/uiStore";
import { nextStages } from "@/utils/aiDesign/fingerprint";
import { answerQuestion, assumeRemaining } from "@/utils/aiDesign/inputs";
import { keyedByText } from "@/lib/keyedByText";
import { editBrief, inputClass, newId, tagClass } from "./briefEdits";
import { REPLACEMENT_NOTICE } from "./UpdateBar";

type Question = DesignBrief["questions"][number];

/**
 * Selected answers are kept in the UI store until Continue or Assume, by question text, so they
 * survive the inspector taking the panel's slot. A new round of questions starts empty.
 */
function useDrafts(questions: Question[]) {
  const stored = useUIStore((state) => state.questionDrafts);
  const setQuestionDraft = useUIStore((state) => state.setQuestionDraft);
  const drafts = stored.questions === questions ? stored.drafts : {};
  const setDraft = (question: string, draft: QuestionDraft) =>
    setQuestionDraft(questions, question, draft);
  return { drafts, setDraft };
}

const answerIn = (drafts: Record<string, QuestionDraft>, question: Question) =>
  drafts[question.question]?.text.trim() ?? "";

/** Records the chosen answers to the open questions in the brief's inputs. */
function recordAnswers(
  current: DesignBrief,
  drafts: Record<string, QuestionDraft>,
  id: () => string,
): DesignBrief {
  return current.questions.reduce((next, question) => {
    const answer = answerIn(drafts, question);
    return answer ? answerQuestion(next, question.question, answer, id) : next;
  }, current);
}

function QuestionCard({
  question,
  draft,
  onChange,
}: {
  question: Question;
  draft: QuestionDraft | undefined;
  onChange: (draft: QuestionDraft) => void;
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
        {keyedByText(question.options, (entry) => entry.label).map(({ key, item: option }) => {
          const selected = draft?.custom === false && draft.text === option.label;
          return (
            <button
              key={key}
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
  const answerOf = (question: Question) => answerIn(drafts, question);
  const allAnswered = questions.every((question) => answerOf(question) !== "");
  const updating = brief.ranFrom.components !== undefined;
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const noticeId = useId();

  const record = (current: DesignBrief) => recordAnswers(current, drafts, newId);

  // Warn when Continue or Assume would run stage 2 over a design that has components. Previews use
  // placeholder ids; only the stages they would run matter.
  const replaces = useMemo(() => {
    if (!nodes.some((node) => node.type === "architecture")) {
      return false;
    }
    const previewId = () => "preview";
    const recorded = recordAnswers(brief, drafts, previewId);
    return [recorded, assumeRemaining(recorded, previewId)].some((next) =>
      nextStages(next, nodes, edges).includes("components"),
    );
  }, [brief, drafts, nodes, edges]);

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
      {/* Ids and labels come from the model and can repeat; keyedByText keeps keys unique. */}
      {keyedByText(questions, (entry) => entry.id).map(({ key, item: question }) => (
        <QuestionCard
          key={key}
          question={question}
          draft={drafts[question.question]}
          onChange={(draft) => setDraft(question.question, draft)}
        />
      ))}
      {replaces && (
        <p id={noticeId} className="text-xs leading-relaxed text-muted-foreground">
          {REPLACEMENT_NOTICE}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!allAnswered}
          aria-describedby={replaces ? noticeId : undefined}
          onClick={() => submit(false)}
        >
          Continue
        </Button>
        <Button
          variant="outline"
          aria-describedby={replaces ? noticeId : undefined}
          onClick={() => submit(true)}
        >
          Assume the rest for me
        </Button>
      </div>
    </section>
  );
}
