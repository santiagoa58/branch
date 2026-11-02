import type { Edge, Node } from "@xyflow/react";
import type {
  ApiInput,
  DecisionsInput,
  DesignBrief,
  DesignContext,
  RequirementKind,
  RequirementsInput,
  Scope,
} from "@/schemas/aiDesign";
import {
  architectureNodeTypeSchema,
  edgeProtocolSchema,
  groupNodeTypeSchema,
} from "@/schemas/catalogEnums";
import type { ArchitectureNodeType, GroupNodeType } from "@/types";

// Every user action in the AI design panel is an edit to the brief's inputs (spec 3.1). These pure
// helpers return a new brief and leave stage outputs untouched until stage 1 re-runs.

type NewId = () => string;

/** Comparison form of user and model text: trimmed and lower-cased. */
export const normalizeText = (text: string) => text.trim().toLowerCase();

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

// --- Inputs of the stages after stage 2, built from the diagram ---

/** A node's label (its id when it has none) and its catalog type when that is a valid one. */
export type NodeIdentity =
  | { kind: "architecture"; label: string; type: ArchitectureNodeType | undefined }
  | { kind: "group"; label: string; type: GroupNodeType | undefined }
  | { kind: "other"; label: string; type: undefined };

export function nodeIdentity(node: Node): NodeIdentity {
  const label = typeof node.data["label"] === "string" ? node.data["label"] : node.id;
  if (node.type === "architecture") {
    const type = architectureNodeTypeSchema.safeParse(node.data["type"]).data;
    return { kind: "architecture", label, type };
  }
  if (node.type === "group") {
    const type = groupNodeTypeSchema.safeParse(node.data["groupType"]).data;
    return { kind: "group", label, type };
  }
  return { kind: "other", label, type: undefined };
}

function edgeProtocol(edge: Edge) {
  const parsed = edgeProtocolSchema.safeParse(edge.data?.["protocol"]);
  return parsed.success ? parsed.data : undefined;
}

/** The architecture nodes with a valid type, and the edges with a valid protocol. */
export function graphSummary(nodes: Node[], edges: Edge[]): ApiInput["graph"] {
  return {
    nodes: nodes.flatMap((node) => {
      const { kind, type, label } = nodeIdentity(node);
      return kind === "architecture" && type ? [{ key: node.id, type, label }] : [];
    }),
    edges: edges.flatMap((edge) => {
      const protocol = edgeProtocol(edge);
      return protocol
        ? [{ from: edge.source, to: edge.target, protocol, async: edge.data?.["async"] === true }]
        : [];
    }),
  };
}

/** What the stages after stage 2 are told about a design. */
export interface StageDesign {
  context: DesignContext;
  /** Stage 2's summary of the design. */
  summary: string;
  nodes: Node[];
  edges: Edge[];
}

/** The decisions input of an architecture or group node with a valid type, else undefined. */
export function decisionInput(design: StageDesign, node: Node): DecisionsInput | undefined {
  const { type, label } = nodeIdentity(node);
  if (!type) {
    return undefined;
  }
  const byId = new Map(design.nodes.map((entry) => [entry.id, entry]));
  const neighbours = design.edges.flatMap((edge): DecisionsInput["neighbours"] => {
    const direction = edge.source === node.id ? "out" : edge.target === node.id ? "in" : undefined;
    const other = byId.get(direction === "out" ? edge.target : edge.source);
    const protocol = edgeProtocol(edge);
    if (!direction || !other || !protocol) {
      return [];
    }
    const identity = nodeIdentity(other);
    return [
      {
        key: other.id,
        type: identity.type ?? other.type ?? "",
        label: identity.label,
        protocol,
        direction,
      },
    ];
  });
  const description = node.data["description"];
  return {
    context: design.context,
    summary: design.summary,
    node: {
      key: node.id,
      type,
      label,
      ...(typeof description === "string" && description !== ""
        ? { responsibility: description }
        : {}),
    },
    neighbours,
  };
}
