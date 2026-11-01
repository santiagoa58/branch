// @vitest-environment node
import { describe, expect, it } from "vite-plus/test";
import type {
  ApiOutput,
  ComponentsOutput,
  DecisionsOutput,
  RequirementsOutput,
} from "../../../src/schemas/aiDesign";
import { createGatewayRunner } from "../runner";
import { checkComponents, checkDecisions, checkRequirements } from "./checks";
import { evalCases } from "./fixtures";
import {
  apiInput,
  componentsInput,
  contextFrom,
  dataModelInput,
  decisionsInputs,
} from "./stageInputs";

// Runs every evaluation case through the real AI gateway: `pnpm eval:ai` (needs AI_GATEWAY_API_KEY
// and AI_MODEL in .env.local). Without AI_EVAL it is skipped, so `pnpm test:run` never calls a model.
// Per case it logs the input and output bytes and the latency of each stage, and it fails on any
// check failure or stage error. Stage 5 (data model) runs too: it has the largest input.

const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
const TEN_MINUTES = 10 * 60 * 1000;

interface Timing {
  stage: string;
  inputBytes: number;
  outputBytes: number;
  ms: number;
}

async function timed<T>(
  timings: Timing[],
  stage: string,
  input: unknown,
  call: () => Promise<T>,
): Promise<T> {
  const started = performance.now();
  const output = await call();
  timings.push({
    stage,
    inputBytes: bytes(input),
    outputBytes: bytes(output),
    ms: Math.round(performance.now() - started),
  });
  return output;
}

describe.skipIf(!process.env["AI_EVAL"])("prompt evaluation against the gateway", () => {
  const runner = createGatewayRunner();
  const signal = new AbortController().signal;
  const owner = "ai-eval";

  it.each(evalCases)(
    "$id",
    async (c) => {
      const timings: Timing[] = [];
      const failures: string[] = [];

      const requirements: RequirementsOutput = await timed(timings, "requirements", c.input, () =>
        runner.run("requirements", c.input, owner, signal),
      );
      failures.push(...checkRequirements(c, requirements).map((f) => `requirements: ${f}`));

      if (requirements.questions.length === 0) {
        const context = contextFrom(c, requirements);
        const input = componentsInput(context);
        const components: ComponentsOutput = await timed(timings, "components", input, () =>
          runner.run("components", input, owner, signal),
        );
        failures.push(...checkComponents(c, components).map((f) => `components: ${f}`));

        // One call per component, all at once, as the pipeline does.
        const decisionInputs = decisionsInputs(context, components);
        const decisions: Record<string, DecisionsOutput> = {};
        await Promise.all(
          decisionInputs.map(async (decisionInput) => {
            decisions[decisionInput.node.key] = await timed(
              timings,
              `decisions:${decisionInput.node.key}`,
              decisionInput,
              () => runner.run("decisions", decisionInput, owner, signal),
            );
          }),
        );
        failures.push(
          ...checkDecisions(
            components.components.map((component) => component.key),
            decisions,
          ).map((f) => `decisions: ${f}`),
        );

        const apiIn = apiInput(context, components);
        const api: ApiOutput = await timed(timings, "api", apiIn, () =>
          runner.run("api", apiIn, owner, signal),
        );
        const dataModelIn = dataModelInput(context, components, api);
        await timed(timings, "data-model", dataModelIn, () =>
          runner.run("data-model", dataModelIn, owner, signal),
        );
      }

      const lines = timings.map(
        (t) => `  ${t.stage}: in ${t.inputBytes} B, out ${t.outputBytes} B, ${t.ms} ms`,
      );
      console.warn(
        `[${c.id}] ${failures.length === 0 ? "pass" : "FAIL"}\n${lines.join("\n")}${
          failures.length > 0 ? `\n  failures:\n    ${failures.join("\n    ")}` : ""
        }`,
      );
      expect(failures).toEqual([]);
    },
    TEN_MINUTES,
  );
});
