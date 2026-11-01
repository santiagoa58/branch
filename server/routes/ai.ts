import { Hono } from "hono";
import {
  aiStageSchema,
  stageSchemas,
  type AiStage,
  type StageInput,
} from "../../src/schemas/aiDesign";
import { toAiHttpError } from "../ai/errors";
import type { AiStageRunner } from "../ai/runner";
import { jsonBody, MAX_BODY_BYTES } from "../http/body";
import { methodNotAllowed, rejectHead } from "../http/middleware";
import { HttpError } from "../repository";
import type { WorkspaceEnv } from "../types";

// Set from measurement once the largest realistic stage input is known.
export const AI_MAX_BODY_BYTES = MAX_BODY_BYTES;

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
