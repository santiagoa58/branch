// @vitest-environment node
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import type { AiStage, StageInput } from "../../../src/schemas/aiDesign";
import { stagePrompts } from "../prompts";
import { evalCases } from "./fixtures";
import {
  apiInput,
  componentsInput,
  contextFrom,
  dataModelInput,
  decisionsInputs,
} from "./stageInputs";
import { syntheticApi, syntheticComponents } from "./synthetic";

// Writes the system and user prompt of every case and stage to .superpowers/eval-prompts/, for
// running the prompts through a stand-in model: `pnpm eval:prompts`. Without AI_EVAL_DUMP it is
// skipped. Stage 1 uses each case's own input; stages 2 to 5 use the case's context with a fixed
// synthetic design (synthetic.ts), since the real stage 2 output needs a model.

const OUT_DIR = path.resolve(import.meta.dirname, "../../../.superpowers/eval-prompts");

function render<S extends AiStage>(stage: S, input: StageInput<S>): string {
  const { system, prompt } = stagePrompts[stage](input);
  return `# System\n\n${system}\n\n# User\n\n${prompt}\n`;
}

describe.skipIf(!process.env["AI_EVAL_DUMP"])("dump evaluation prompts", () => {
  it("writes one file per case and stage", () => {
    mkdirSync(OUT_DIR, { recursive: true });
    const components = syntheticComponents();
    const api = syntheticApi();
    let written = 0;
    const write = (name: string, content: string) => {
      writeFileSync(path.join(OUT_DIR, `${name}.md`), content);
      written += 1;
    };
    for (const c of evalCases) {
      const context = contextFrom(c);
      write(`${c.id}-requirements`, render("requirements", c.input));
      write(`${c.id}-components`, render("components", componentsInput(context)));
      const firstDecision = decisionsInputs(context, components).find(
        (input) => input.node.key === "gateway",
      );
      if (firstDecision) {
        write(`${c.id}-decisions`, render("decisions", firstDecision));
      }
      write(`${c.id}-api`, render("api", apiInput(context, components)));
      write(`${c.id}-data-model`, render("data-model", dataModelInput(context, components, api)));
    }
    expect(written).toBe(evalCases.length * 5);
  });
});
