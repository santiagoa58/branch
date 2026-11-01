import { generateText, NoObjectGeneratedError, NoOutputGeneratedError, Output } from "ai";
import { z } from "zod";
import {
  stageSchemas,
  type AiStage,
  type StageInput,
  type StageOutput,
} from "../../src/schemas/aiDesign";
import { aiEnvSchema, type AiEnv } from "../../src/schemas/server";
import { modelFor } from "./models";
import { stagePrompts } from "./prompts";

export interface AiStageRunner {
  run<S extends AiStage>(
    stage: S,
    input: StageInput<S>,
    owner: string,
    signal: AbortSignal,
  ): Promise<StageOutput<S>>;
}

// Thrown when the model stops because it ran out of output tokens.
export class StageOutputTooLargeError extends Error {
  constructor(message = "The design was too large to generate") {
    super(message);
    this.name = "StageOutputTooLargeError";
  }
}

// Typed per stage so a generic stage lookup returns that stage's output type.
const outputSchemas: { [S in AiStage]: z.ZodType<StageOutput<S>> } = {
  requirements: stageSchemas.requirements.output,
  components: stageSchemas.components.output,
  decisions: stageSchemas.decisions.output,
  api: stageSchemas.api.output,
  "data-model": stageSchemas["data-model"].output,
};

// An output that did not match the schema; the stage is retried once with this message.
class InvalidOutputError extends Error {
  constructor(
    message: string,
    readonly original: unknown,
  ) {
    super(message);
    this.name = "InvalidOutputError";
  }
}

function zodErrorIn(error: unknown): z.ZodError | undefined {
  let current = error;
  while (typeof current === "object" && current !== null) {
    if (current instanceof z.ZodError) {
      return current;
    }
    current = "cause" in current ? current.cause : undefined;
  }
  return undefined;
}

// The error message plus the schema issues, without echoing the model's whole output back.
function explain(error: Error): string {
  if (error instanceof z.ZodError) {
    return z.prettifyError(error);
  }
  const issues = zodErrorIn(error);
  return issues ? `${error.message} ${z.prettifyError(issues)}` : error.message;
}

function invalidOutput(error: unknown, finishReason: string | undefined): never {
  if (finishReason === "length") {
    throw new StageOutputTooLargeError();
  }
  if (
    NoObjectGeneratedError.isInstance(error) ||
    NoOutputGeneratedError.isInstance(error) ||
    error instanceof z.ZodError
  ) {
    throw new InvalidOutputError(explain(error), error);
  }
  throw error;
}

/**
 * Runs AI stages through the Vercel AI Gateway. Without injected dependencies it reads the AI
 * settings from the environment at the first run, so importing the module needs no settings.
 */
export function createGatewayRunner(
  deps: { generate?: typeof generateText; env?: AiEnv } = {},
): AiStageRunner {
  const generate = deps.generate ?? generateText;
  let env = deps.env;

  // oxlint-disable-next-line max-params -- debt: 5 params; take an options object
  async function attempt<S extends AiStage>(
    stage: S,
    system: string,
    prompt: string,
    owner: string,
    signal: AbortSignal,
  ): Promise<StageOutput<S>> {
    env ??= aiEnvSchema.parse(process.env);
    const schema: z.ZodType<StageOutput<S>> = outputSchemas[stage];
    let result;
    try {
      result = await generate({
        model: modelFor(stage, env),
        system,
        prompt,
        output: Output.object({ schema }),
        temperature: 0,
        abortSignal: signal,
        providerOptions: { gateway: { user: owner } },
      });
    } catch (error) {
      return invalidOutput(
        error,
        NoObjectGeneratedError.isInstance(error) ? error.finishReason : undefined,
      );
    }
    try {
      return schema.parse(result.output);
    } catch (error) {
      return invalidOutput(error, result.finishReason);
    }
  }

  return {
    async run(stage, input, owner, signal) {
      const { system, prompt } = stagePrompts[stage](input);
      try {
        return await attempt(stage, system, prompt, owner, signal);
      } catch (error) {
        if (!(error instanceof InvalidOutputError)) {
          throw error;
        }
        const retryPrompt = `${prompt}\n\nYour previous output was invalid: ${error.message}. Return output that matches the schema.`;
        try {
          return await attempt(stage, system, retryPrompt, owner, signal);
        } catch (retryError) {
          throw retryError instanceof InvalidOutputError ? retryError.original : retryError;
        }
      }
    },
  };
}
