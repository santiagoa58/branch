import { useId, useState, type ReactNode } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DesignBrief, RequirementKind } from "@/schemas/aiDesign";
import {
  addOutOfScopeLine,
  addRequirementLine,
  answerQuestion,
  bringIntoScope,
  changeAssumption,
  confirmAssumption,
  editOutOfScopeLine,
  editRequirementLine,
  removeDerivedRequirement,
  removeOutOfScopeLine,
  removeRequirementLine,
} from "@/utils/aiDesign/inputs";
import { editBrief, keyedByText, newId, sectionLabelClass, tagClass } from "./briefEdits";
import { InlineEdit } from "./InlineEdit";

const GROUPS: readonly { kind: RequirementKind; title: string; addLabel: string }[] = [
  { kind: "functional", title: "Functional requirements", addLabel: "a functional requirement" },
  {
    kind: "nonFunctional",
    title: "Non-functional requirements",
    addLabel: "a non-functional requirement",
  },
  { kind: "constraint", title: "Constraints", addLabel: "a constraint" },
];

const normalize = (text: string) => text.trim().toLowerCase();
const lineKey = (kind: RequirementKind, text: string) => `${kind}:${normalize(text)}`;

/**
 * Actions on stage 1 output rows add an input line; the row stays until stage 1 runs again. Each
 * row's status comes from the inputs, so it follows undo and redo, and an action already taken
 * (or clicked twice) shows as done instead of adding the line again.
 */
function rowStatuses(brief: DesignBrief) {
  const requirements = new Set(
    brief.inputs.requirements.map((line) => lineKey(line.kind, line.text)),
  );
  const outOfScope = new Set(brief.inputs.outOfScope.map((line) => normalize(line.text)));
  return {
    assumption: (assumption: DesignBrief["assumptions"][number]) =>
      requirements.has(lineKey(assumption.kind, assumption.text)) ? "Confirmed" : undefined,
    requirement: (requirement: DesignBrief["requirements"][number]) =>
      outOfScope.has(normalize(requirement.text)) ? "Moved out of scope" : undefined,
    outOfScope: (text: string) =>
      requirements.has(lineKey("functional", text)) ? "Brought into scope" : undefined,
  };
}

function Row({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <li
      className={cn(
        "flex items-start justify-between gap-2.5 border-t border-zinc-100 dark:border-zinc-800/70 px-3 py-2.5 text-sm leading-snug first:border-t-0",
        className,
      )}
    >
      {children}
    </li>
  );
}

function Status({ children }: { children: ReactNode }) {
  return <span className="shrink-0 text-xs text-muted-foreground">{children}</span>;
}

function SectionHeader({
  title,
  addLabel,
  onAdd,
}: {
  title: string;
  addLabel?: string;
  onAdd?: () => void;
}) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-2">
      <h3 className={sectionLabelClass}>{title}</h3>
      {onAdd && (
        <Button variant="ghost" size="sm" onClick={onAdd}>
          <Plus aria-hidden="true" />
          Add<span className="sr-only"> {addLabel}</span>
        </Button>
      )}
    </div>
  );
}

/** A line the user wrote: shown verbatim, marked "Yours", with Edit and Delete. */
function UserLine({
  text,
  onEdit,
  onDelete,
}: {
  text: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const textId = useId();
  return (
    <Row>
      <span id={textId} className="min-w-0 whitespace-pre-wrap wrap-anywhere">
        {text}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <span
          className={cn(
            tagClass,
            "bg-primary text-primary-foreground dark:bg-primary dark:text-primary-foreground",
          )}
        >
          Yours
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Edit"
          aria-describedby={textId}
          onClick={onEdit}
        >
          <Pencil aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Delete"
          aria-describedby={textId}
          onClick={onDelete}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </span>
    </Row>
  );
}

function EditorRow(props: Parameters<typeof InlineEdit>[0]) {
  return (
    <Row>
      <InlineEdit {...props} />
    </Row>
  );
}

const listClass = "mt-1.5 rounded-lg border border-border bg-card";

/** Requirements by kind, the assumptions to check, and what is out of scope. */
// oxlint-disable-next-line max-lines-per-function -- debt: 250 lines; split into smaller units
export function BriefSections({ brief }: { brief: DesignBrief }) {
  // One inline editor at a time, named by what it edits.
  const [editing, setEditing] = useState<string | null>(null);
  const close = () => setEditing(null);
  const statuses = rowStatuses(brief);
  const assumedAnswers = brief.inputs.answers.filter((answer) => answer.assumed);

  return (
    <div className="flex flex-col gap-5">
      {GROUPS.map((group) => {
        const lines = brief.inputs.requirements.filter((line) => line.kind === group.kind);
        const derived = keyedByText(brief.requirements, (entry) => entry.text).filter(
          (entry) => entry.item.kind === group.kind,
        );
        const adding = editing === `add:${group.kind}`;
        return (
          <section key={group.kind} aria-label={group.title}>
            <SectionHeader
              title={group.title}
              addLabel={group.addLabel}
              onAdd={() => setEditing(`add:${group.kind}`)}
            />
            {(lines.length > 0 || derived.length > 0 || adding) && (
              <ul className={listClass}>
                {lines.map((line) =>
                  editing === `requirement:${line.id}` ? (
                    <EditorRow
                      key={line.id}
                      label="Edit requirement"
                      initial={line.text}
                      onCancel={close}
                      onSave={(text) => {
                        editBrief((current) => editRequirementLine(current, line.id, text));
                        close();
                      }}
                    />
                  ) : (
                    <UserLine
                      key={line.id}
                      text={line.text}
                      onEdit={() => setEditing(`requirement:${line.id}`)}
                      onDelete={() =>
                        editBrief((current) => removeRequirementLine(current, line.id))
                      }
                    />
                  ),
                )}
                {derived.map(({ key, item: requirement, index }) => {
                  const status = statuses.requirement(requirement);
                  return (
                    <Row key={key}>
                      <span className="min-w-0 wrap-anywhere">{requirement.text}</span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {requirement.category && (
                          <span className={tagClass}>{requirement.category}</span>
                        )}
                        {status ? (
                          <Status>{status}</Status>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              editBrief((current) =>
                                removeDerivedRequirement(current, index, newId),
                              );
                            }}
                          >
                            Remove
                          </Button>
                        )}
                      </span>
                    </Row>
                  );
                })}
                {adding && (
                  <EditorRow
                    label="New requirement"
                    onCancel={close}
                    onSave={(text) => {
                      editBrief((current) => addRequirementLine(current, group.kind, text, newId));
                      close();
                    }}
                  />
                )}
              </ul>
            )}
          </section>
        );
      })}

      <section aria-label="Assumptions">
        <SectionHeader title="Assumptions made" />
        <p className="text-xs text-muted-foreground">Confirm what is right; change what isn't.</p>
        <ul className="mt-1.5 rounded-lg border border-attention/40 bg-attention/10 [&>li]:border-attention/25">
          {keyedByText(brief.assumptions, (entry) => entry.text).map(
            ({ key: rowKey, item: assumption, index }) => {
              const key = `assumption:${index}`;
              const status = statuses.assumption(assumption);
              return editing === key ? (
                <EditorRow
                  key={rowKey}
                  label="Change assumption"
                  initial={assumption.text}
                  onCancel={close}
                  onSave={(text) => {
                    editBrief((current) => changeAssumption(current, index, text, newId));
                    close();
                  }}
                />
              ) : (
                <Row key={rowKey}>
                  <span className="min-w-0 wrap-anywhere">{assumption.text}</span>
                  {status ? (
                    <Status>{status}</Status>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          editBrief((current) => confirmAssumption(current, index, newId));
                        }}
                      >
                        Confirm
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(key)}>
                        Change
                      </Button>
                    </span>
                  )}
                </Row>
              );
            },
          )}
          {/* Confirming or changing an assumed answer records it as the user's own answer. */}
          {assumedAnswers.map((answer) =>
            editing === `answer:${answer.id}` ? (
              <EditorRow
                key={answer.id}
                label="Change assumed answer"
                initial={answer.answer}
                onCancel={close}
                onSave={(text) => {
                  editBrief((current) => answerQuestion(current, answer.question, text, newId));
                  close();
                }}
              />
            ) : (
              <Row key={answer.id}>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="wrap-anywhere">{answer.answer}</span>
                  <span className="text-xs text-muted-foreground wrap-anywhere">
                    <span className="sr-only">Assumed answer to: </span>
                    {answer.question}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      editBrief((current) =>
                        answerQuestion(current, answer.question, answer.answer, newId),
                      )
                    }
                  >
                    Confirm
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(`answer:${answer.id}`)}
                  >
                    Change
                  </Button>
                </span>
              </Row>
            ),
          )}
          {brief.assumptions.length === 0 && assumedAnswers.length === 0 && (
            <Row className="text-muted-foreground">No open assumptions.</Row>
          )}
        </ul>
      </section>

      <section aria-label="Out of scope">
        <SectionHeader
          title="Out of scope"
          addLabel="an out-of-scope line"
          onAdd={() => setEditing("add:outOfScope")}
        />
        {(brief.inputs.outOfScope.length > 0 ||
          brief.outOfScope.length > 0 ||
          editing === "add:outOfScope") && (
          <ul className={listClass}>
            {brief.inputs.outOfScope.map((line) =>
              editing === `outOfScope:${line.id}` ? (
                <EditorRow
                  key={line.id}
                  label="Edit out-of-scope line"
                  initial={line.text}
                  onCancel={close}
                  onSave={(text) => {
                    editBrief((current) => editOutOfScopeLine(current, line.id, text));
                    close();
                  }}
                />
              ) : (
                <UserLine
                  key={line.id}
                  text={line.text}
                  onEdit={() => setEditing(`outOfScope:${line.id}`)}
                  onDelete={() => editBrief((current) => removeOutOfScopeLine(current, line.id))}
                />
              ),
            )}
            {keyedByText(brief.outOfScope, (text) => text).map(({ key, item: text, index }) => {
              const status = statuses.outOfScope(text);
              return (
                <Row key={key} className="items-center">
                  <span className="min-w-0 wrap-anywhere">{text}</span>
                  {status ? (
                    <Status>{status}</Status>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        editBrief((current) => bringIntoScope(current, index, newId));
                      }}
                    >
                      Bring into scope
                    </Button>
                  )}
                </Row>
              );
            })}
            {editing === "add:outOfScope" && (
              <EditorRow
                label="New out-of-scope line"
                onCancel={close}
                onSave={(text) => {
                  editBrief((current) => addOutOfScopeLine(current, text, newId));
                  close();
                }}
              />
            )}
          </ul>
        )}
      </section>
    </div>
  );
}
