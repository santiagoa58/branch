import type {
  ComponentsOutput,
  DecisionsOutput,
  RequirementsOutput,
} from "../../../src/schemas/aiDesign";
import type { EvalCase } from "./fixtures";

const normalize = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();

/** Stage 1: asks when it should, never re-asks an answered question, always recommends. */
export function checkRequirements(c: EvalCase, out: RequirementsOutput): string[] {
  const failures: string[] = [];
  const asked = out.questions.length;
  if (c.expect.asks && asked === 0) {
    failures.push("expected questions but got none");
  }
  if (!c.expect.asks && asked > 0) {
    failures.push(`expected no questions but got ${asked}`);
  }
  const answered = new Set(c.input.answers.map(({ question }) => normalize(question)));
  for (const question of out.questions) {
    if (answered.has(normalize(question.question)) || answered.has(normalize(question.topic))) {
      failures.push(`re-asks an answered question: "${question.question.trim()}"`);
    }
    if (question.recommended.trim() === "") {
      failures.push(`question "${question.id}" has no recommended answer`);
    }
  }
  return failures;
}

/** Stage 2: every component type and connection protocol the case requires is present. */
export function checkComponents(c: EvalCase, out: ComponentsOutput): string[] {
  const failures: string[] = [];
  const types = new Set(out.components.map((component) => component.type));
  const protocols = new Set(out.connections.map((connection) => connection.protocol));
  for (const type of c.expect.mustInclude?.types ?? []) {
    if (!types.has(type)) {
      failures.push(`missing component type: ${type}`);
    }
  }
  for (const protocol of c.expect.mustInclude?.protocols ?? []) {
    if (!protocols.has(protocol)) {
      failures.push(`missing connection protocol: ${protocol}`);
    }
  }
  return failures;
}

/** Stage 3: one decision for every node. */
export function checkDecisions(
  nodeKeys: string[],
  outs: Record<string, DecisionsOutput>,
): string[] {
  return nodeKeys.filter((key) => !(key in outs)).map((key) => `no decision for ${key}`);
}
