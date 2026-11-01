import type {
  DesignBrief,
  DesignContext,
  RequirementKind,
  RequirementsInput,
  Scope,
} from "@/schemas/aiDesign";

// Every user action in the AI design panel is an edit to the brief's inputs (spec 3.1). These pure
// helpers return a new brief and leave stage outputs untouched until stage 1 re-runs.

type NewId = () => string;

function withInputs(brief: DesignBrief, inputs: Partial<DesignBrief["inputs"]>): DesignBrief {
  return { ...brief, inputs: { ...brief.inputs, ...inputs } };
}

// oxlint-disable-next-line max-params -- debt: 5 params; take an options object
export function createBrief(
  prompt: string,
  scope: Scope,
  requirements: { kind: RequirementKind; text: string }[],
  outOfScope: string[],
  newId: NewId,
): DesignBrief {
  return {
    inputs: {
      prompt,
      scope,
      requirements: requirements.map((line) => ({ id: newId(), ...line })),
      outOfScope: outOfScope.map((text) => ({ id: newId(), text })),
      answers: [],
    },
    questions: [],
    requirements: [],
    assumptions: [],
    outOfScope: [],
    ranFrom: {},
  };
}

export function addRequirementLine(
  brief: DesignBrief,
  kind: RequirementKind,
  text: string,
  newId: NewId,
): DesignBrief {
  return withInputs(brief, {
    requirements: [...brief.inputs.requirements, { id: newId(), kind, text }],
  });
}

export function editRequirementLine(brief: DesignBrief, id: string, text: string): DesignBrief {
  return withInputs(brief, {
    requirements: brief.inputs.requirements.map((line) =>
      line.id === id ? { ...line, text } : line,
    ),
  });
}

export function removeRequirementLine(brief: DesignBrief, id: string): DesignBrief {
  return withInputs(brief, {
    requirements: brief.inputs.requirements.filter((line) => line.id !== id),
  });
}

export function addOutOfScopeLine(brief: DesignBrief, text: string, newId: NewId): DesignBrief {
  return withInputs(brief, {
    outOfScope: [...brief.inputs.outOfScope, { id: newId(), text }],
  });
}

export function editOutOfScopeLine(brief: DesignBrief, id: string, text: string): DesignBrief {
  return withInputs(brief, {
    outOfScope: brief.inputs.outOfScope.map((line) => (line.id === id ? { ...line, text } : line)),
  });
}

export function removeOutOfScopeLine(brief: DesignBrief, id: string): DesignBrief {
  return withInputs(brief, {
    outOfScope: brief.inputs.outOfScope.filter((line) => line.id !== id),
  });
}

// Answers are matched by question text. Confirming or changing an assumed answer goes through here
// too, so it is always recorded as `assumed: false`.
export function answerQuestion(
  brief: DesignBrief,
  question: string,
  answer: string,
  newId: NewId,
): DesignBrief {
  const existing = brief.inputs.answers.some((entry) => entry.question === question);
  return withInputs(brief, {
    answers: existing
      ? brief.inputs.answers.map((entry) =>
          entry.question === question ? { ...entry, answer, assumed: false } : entry,
        )
      : [...brief.inputs.answers, { id: newId(), question, answer, assumed: false }],
  });
}

export function assumeRemaining(brief: DesignBrief, newId: NewId): DesignBrief {
  const answered = new Set(brief.inputs.answers.map((entry) => entry.question));
  const added = brief.questions
    .filter((entry) => !answered.has(entry.question))
    .map((entry) => ({
      id: newId(),
      question: entry.question,
      answer: entry.recommended,
      assumed: true,
    }));
  if (added.length === 0) {
    return brief;
  }
  return withInputs(brief, { answers: [...brief.inputs.answers, ...added] });
}

export function confirmAssumption(brief: DesignBrief, index: number, newId: NewId): DesignBrief {
  const assumption = brief.assumptions[index];
  if (!assumption) {
    return brief;
  }
  return addRequirementLine(brief, assumption.kind, assumption.text, newId);
}

export function changeAssumption(
  brief: DesignBrief,
  index: number,
  text: string,
  newId: NewId,
): DesignBrief {
  const assumption = brief.assumptions[index];
  if (!assumption) {
    return brief;
  }
  return addRequirementLine(brief, assumption.kind, text, newId);
}

export function removeDerivedRequirement(
  brief: DesignBrief,
  index: number,
  newId: NewId,
): DesignBrief {
  const requirement = brief.requirements[index];
  if (!requirement) {
    return brief;
  }
  return addOutOfScopeLine(brief, requirement.text, newId);
}

export function bringIntoScope(brief: DesignBrief, index: number, newId: NewId): DesignBrief {
  const text = brief.outOfScope[index];
  if (text === undefined) {
    return brief;
  }
  return addRequirementLine(brief, "functional", text, newId);
}

export function requireCondition(brief: DesignBrief, text: string, newId: NewId): DesignBrief {
  return addRequirementLine(brief, "functional", text, newId);
}

// Answers are not added here: stage 1 always re-runs after an answer and turns it into derived
// requirements or assumptions.
export function buildDesignContext(brief: DesignBrief): DesignContext {
  return {
    prompt: brief.inputs.prompt,
    scope: brief.inputs.scope,
    requirements: [
      ...brief.inputs.requirements.map(({ kind, text }) => ({ kind, text, assumed: false })),
      ...brief.requirements.map((requirement) => ({ ...requirement, assumed: false })),
      ...brief.assumptions.map(({ kind, text }) => ({ kind, text, assumed: true })),
    ],
    outOfScope: [...brief.inputs.outOfScope.map((line) => line.text), ...brief.outOfScope],
  };
}

export function requirementsInput(brief: DesignBrief): RequirementsInput {
  return {
    prompt: brief.inputs.prompt,
    scope: brief.inputs.scope,
    requirements: brief.inputs.requirements.map(({ kind, text }) => ({ kind, text })),
    outOfScope: brief.inputs.outOfScope.map((line) => line.text),
    answers: brief.inputs.answers.map(({ question, answer, assumed }) => ({
      question,
      answer,
      assumed,
    })),
  };
}
