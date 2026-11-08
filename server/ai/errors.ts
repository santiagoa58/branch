import { APICallError, RetryError } from "ai";
import { GatewayError } from "@ai-sdk/gateway";
import { StageOutputTooLargeError } from "./runner";

export interface AiHttpError {
  status: 402 | 429 | 502;
  message: string;
  retryAfter?: string;
}

const unavailable: AiHttpError = {
  status: 502,
  message: "The AI service is unavailable. Please retry.",
};

function statusOf(error: unknown): number | undefined {
  if (GatewayError.isInstance(error) || APICallError.isInstance(error)) {
    return error.statusCode;
  }
  return undefined;
}

function retryAfterOf(error: unknown): string | undefined {
  // Gateway errors wrap the provider call that carries the response headers.
  const call = APICallError.isInstance(error)
    ? error
    : GatewayError.isInstance(error) && APICallError.isInstance(error.cause)
      ? error.cause
      : undefined;
  return call?.responseHeaders?.["retry-after"];
}

/** Maps a failure from the AI runner to the HTTP status and copy returned to the browser. */
export function toAiHttpError(error: unknown): AiHttpError {
  const cause = RetryError.isInstance(error) ? error.lastError : error;
  if (cause instanceof StageOutputTooLargeError) {
    return { status: 502, message: cause.message };
  }
  const status = statusOf(cause);
  if (status === 402) {
    return { status: 402, message: "AI budget reached" };
  }
  if (status === 429) {
    const retryAfter = retryAfterOf(cause);
    return {
      status: 429,
      message: "The AI service is busy. Please retry shortly.",
      ...(retryAfter ? { retryAfter } : {}),
    };
  }
  return unavailable;
}
