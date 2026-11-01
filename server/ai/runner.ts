import type { AiStage, StageInput, StageOutput } from "../../src/schemas/aiDesign";

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

// Placeholder until the Gateway-backed runner replaces it.
export function createGatewayRunner(): AiStageRunner {
  return {
    run() {
      throw new Error("Not implemented");
    },
  };
}
