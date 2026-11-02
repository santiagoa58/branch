import {
  stageContracts,
  type AiStage,
  type StageInput,
  type StageOutput,
} from "@/schemas/aiDesign";
import { serializeJsonRequest } from "./jsonRequest";
import { readJsonResponse } from "./jsonResponse";
import { sendApiRequest } from "./transport";

/**
 * Upper bound on one AI stage request, so a hung connection cannot leave a run spinning forever.
 * `vercel.json` leaves the function's `maxDuration` at the platform default, 300 s with Fluid
 * compute, and the server makes at most two model calls inside it. The platform ends a slower
 * function with a 504, which the pipeline already shows as a stage error, so this timeout only
 * fires when no response arrives at all. Six minutes leaves a minute for cold starts, the auth
 * token and the network on top of that limit. Raise it with `maxDuration`.
 */
export const AI_REQUEST_TIMEOUT_MS = 360_000;

export const AI_TIMEOUT_MESSAGE = "The AI took too long to respond. Retry?";

/** A stage request that got no answer within its timeout. A user cancel is an AbortError instead. */
export class AiTimeoutError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super(AI_TIMEOUT_MESSAGE);
    this.name = "AiTimeoutError";
    this.cause = cause;
  }
}

/**
 * Aborts the request when the run's `signal` aborts or after `timeoutMs`. Equivalent to
 * `AbortSignal.any([signal, AbortSignal.timeout(ms)])`, which jsdom (tests) and Safari before
 * 17.4 lack; it also records which of the two fired and clears its timer once the request settles.
 */
function requestSignal(signal: AbortSignal, timeoutMs: number) {
  const controller = new AbortController();
  const state = { timedOut: false };
  const forward = () => controller.abort(signal.reason);
  if (signal.aborted) {
    forward();
  } else {
    signal.addEventListener("abort", forward, { once: true });
  }
  const timer = setTimeout(() => {
    state.timedOut = true;
    controller.abort(new DOMException("The AI stage request timed out.", "TimeoutError"));
  }, timeoutMs);
  return {
    signal: controller.signal,
    timedOut: () => state.timedOut && !signal.aborted,
    dispose: () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", forward);
    },
  };
}

export const aiApi = {
  run: async <S extends AiStage>(
    stage: S,
    input: StageInput<S>,
    signal: AbortSignal,
    timeoutMs: number = AI_REQUEST_TIMEOUT_MS,
  ): Promise<StageOutput<S>> => {
    const path = `/ai/${stage}`;
    const contract = stageContracts[stage];
    const body = serializeJsonRequest("POST", path, contract.input, input);
    const request = requestSignal(signal, timeoutMs);
    try {
      const response = await sendApiRequest("POST", path, { ...body, signal: request.signal });
      return await readJsonResponse("POST", path, response, contract.output);
    } catch (error) {
      throw request.timedOut() ? new AiTimeoutError(error) : error;
    } finally {
      request.dispose();
    }
  },
};
