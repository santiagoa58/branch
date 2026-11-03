import type {
  ComponentsOutput,
  DecisionsOutput,
  RequirementsOutput,
} from "../../../src/schemas/aiDesign";
import type { EvalCase } from "./fixtures";

/** Stage 1: asks nothing, and lists assumptions when the case leaves decisions open. */
export function checkRequirements(c: EvalCase, out: RequirementsOutput): string[] {
  const failures: string[] = [];
  const asked = out.questions.length;
  if (asked > 0) {
    failures.push(`expected no questions but got ${asked}`);
  }
  if (c.expect.assumes && out.assumptions.length === 0) {
    failures.push("expected assumptions but got none");
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
