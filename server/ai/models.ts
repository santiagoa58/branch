import type { AiEnv } from "../../src/schemas/server";
import type { AiStage } from "../../src/schemas/aiDesign";

const overrides = {
  requirements: "AI_MODEL_REQUIREMENTS",
  components: "AI_MODEL_COMPONENTS",
  decisions: "AI_MODEL_DECISIONS",
  api: "AI_MODEL_API",
  "data-model": "AI_MODEL_DATA_MODEL",
} as const satisfies Record<AiStage, keyof AiEnv>;

/** The stage's model override when set, otherwise the default model. */
export function modelFor(stage: AiStage, env: AiEnv): string {
  return env[overrides[stage]] || env.AI_MODEL;
}
