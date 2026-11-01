import type { ApiInput, DesignContext, Scope } from "../../../src/schemas/aiDesign";

export interface StagePrompt {
  system: string;
  prompt: string;
}

// Scope definitions from spec section 3.1; every stage designs at this level of detail.
const SCOPE_DEFINITIONS: Record<Scope, string> = {
  frontend: "detail the client side; the backend is a single box",
  backend: "detail services, data and infrastructure; clients are one box per kind",
  fullstack: "detail both the client side and the backend",
};

export const SYSTEM_PREAMBLE = [
  "You are a senior engineer answering a system design interview.",
  "Output only what the schema asks for: no commentary, no extra fields.",
  "Design only for the given requirements. Do not add features nobody asked for, and never design anything listed as out of scope.",
  "Respect the scope:",
  ...Object.entries(SCOPE_DEFINITIONS).map(([scope, definition]) => `- ${scope}: ${definition}.`),
].join("\n");

/** The preamble for stages 2 to 5, which design from a settled DesignContext. */
export const DESIGN_PREAMBLE = `${SYSTEM_PREAMBLE}
Requirements marked (assumed) were assumed on the user's behalf; design for them like any other requirement.`;

/** Joins prompt parts with blank lines, skipping empty ones. */
export function joinSections(...sections: string[]): string {
  return sections.filter(Boolean).join("\n\n");
}

/** A labelled section with one bullet per line, or "(none)". */
export function section(label: string, lines: string[]): string {
  return `${label}\n${lines.length > 0 ? lines.map((line) => `- ${line}`).join("\n") : "(none)"}`;
}

export function scopeLine(scope: Scope): string {
  return `Scope: ${scope} (${SCOPE_DEFINITIONS[scope]})`;
}

const KIND_LABELS = {
  functional: "functional",
  nonFunctional: "non-functional",
  constraint: "constraint",
} as const;

export function kindLabel(kind: keyof typeof KIND_LABELS): string {
  return KIND_LABELS[kind];
}

/** The problem statement shared by stages 2 to 5. */
export function formatContext(context: DesignContext): string {
  return joinSections(
    `System to design: ${context.prompt}`,
    scopeLine(context.scope),
    section(
      "Requirements:",
      context.requirements.map(
        (requirement) =>
          `[${kindLabel(requirement.kind)}${requirement.category ? `, ${requirement.category}` : ""}] ${requirement.text}${requirement.assumed ? " (assumed)" : ""}`,
      ),
    ),
    section("Out of scope:", context.outOfScope),
  );
}

/** The component graph as one line per node and edge, which reads more clearly than JSON. */
export function formatGraph(graph: ApiInput["graph"]): string {
  return joinSections(
    section(
      "Components (key: label, type):",
      graph.nodes.map((node) => `${node.key}: ${node.label}, ${node.type}`),
    ),
    section(
      "Connections (from -> to, protocol):",
      graph.edges.map(
        (edge) => `${edge.from} -> ${edge.to}, ${edge.protocol}${edge.async ? ", async" : ""}`,
      ),
    ),
  );
}

/** A few-shot example: the input it answers, then the expected output as compact JSON. */
export function example(input: string, output: unknown): string {
  return joinSections("Example input:", input, "Example output:", JSON.stringify(output));
}
