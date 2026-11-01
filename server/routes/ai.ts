import { Hono } from "hono";
import {
  aiStageSchema,
  stageSchemas,
  type AiStage,
  type StageInput,
} from "../../src/schemas/aiDesign";
import { toAiHttpError } from "../ai/errors";
import type { AiStageRunner } from "../ai/runner";
import { jsonBody } from "../http/body";
import { methodNotAllowed, rejectHead } from "../http/middleware";
import { HttpError } from "../repository";
import type { WorkspaceEnv } from "../types";

// Largest measured stage input is 9,747 bytes (data-model input for a synthetic 40-component design
// with 32 endpoints, server/ai/eval/limits.test.ts); 4 x 9,747 = 38,988, rounded up to 64 KB.
export const AI_MAX_BODY_BYTES = 64 * 1024;

async function runStage<S extends AiStage>(
  ai: AiStageRunner,
  stage: S,
  input: StageInput<S>,
  owner: string,
  signal: AbortSignal,
) {
  try {
    return await ai.run(stage, input, owner, signal);
  } catch (error) {
    const { status, message, retryAfter } = toAiHttpError(error);
    console.error("AI stage failed", stage, error);
    throw new HttpError(status, message, retryAfter ? { "Retry-After": retryAfter } : {});
  }
}

export function aiRoutes(ai: AiStageRunner) {
  return new Hono<WorkspaceEnv>()
    .post(
      "/ai/:stage",
      async (c, next) => {
        if (!aiStageSchema.safeParse(c.req.param("stage")).success) {
          throw new HttpError(404, "API endpoint not found.");
        }
        await next();
      },
      jsonBody(AI_MAX_BODY_BYTES),
      async (c) => {
        const stage = aiStageSchema.parse(c.req.param("stage"));
        const input = stageSchemas[stage].input.safeParse(await c.req.json());
        if (!input.success) {
          throw new HttpError(400, "The request does not match the data contract.");
        }
        // The schema lookup is keyed by a runtime stage, so TypeScript cannot correlate it with S.
        const output = await runStage(
          ai,
          stage,
          input.data as StageInput<typeof stage>,
          c.get("owner"),
          c.req.raw.signal,
        );
        return c.json(output);
      },
    )
    .get("/ai/:stage", rejectHead, methodNotAllowed)
    .all("/ai/:stage", methodNotAllowed);
}
