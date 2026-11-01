// @vitest-environment node
import { describe, expect, it } from "vite-plus/test";
import { stageSchemas } from "../../../src/schemas/aiDesign";
import { AI_MAX_BODY_BYTES } from "../../routes/ai";
import { evalCases } from "./fixtures";
import {
  apiInput,
  componentsInput,
  contextFrom,
  dataModelInput,
  decisionsInputs,
} from "./stageInputs";
import { syntheticApi, syntheticComponents, syntheticContext } from "./synthetic";

const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
const KB64 = 64 * 1024;

// Every stage input a browser can send for the fixtures and the synthetic 40-component design.
function measuredInputs() {
  const components = syntheticComponents();
  const api = syntheticApi();
  const synthetic = [
    ["components", componentsInput(syntheticContext)],
    ["decisions", decisionsInputs(syntheticContext, components)[0]],
    ["api", apiInput(syntheticContext, components)],
    ["data-model", dataModelInput(syntheticContext, components, api)],
  ] as const;
  const fixtures = evalCases.flatMap((c) => [
    ["requirements", c.input] as const,
    ["components", componentsInput(contextFrom(c))] as const,
  ]);
  return [...synthetic, ...fixtures];
}

describe("synthetic design", () => {
  it("has 40 components and valid stage inputs", () => {
    const components = syntheticComponents();
    expect(components.components).toHaveLength(40);
    const keys = new Set(components.components.map((component) => component.key));
    expect(keys.size).toBe(40);
    for (const { from, to } of components.connections) {
      expect(keys.has(from) && keys.has(to)).toBe(true);
    }
    for (const [stage, input] of measuredInputs()) {
      expect(stageSchemas[stage].input.safeParse(input).success).toBe(true);
    }
  });
});

describe("AI_MAX_BODY_BYTES", () => {
  it("is four times the largest measured stage input, rounded up to 64 KB", () => {
    const largest = Math.max(...measuredInputs().map(([, input]) => bytes(input)));
    expect(AI_MAX_BODY_BYTES).toBe(Math.ceil((largest * 4) / KB64) * KB64);
  });
});
