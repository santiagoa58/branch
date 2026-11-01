// @vitest-environment node
import { describe, it, expect } from "vite-plus/test";
import { APICallError, RetryError } from "ai";
import { GatewayInternalServerError } from "@ai-sdk/gateway";
import { toAiHttpError } from "./errors";
import { StageOutputTooLargeError } from "./runner";

const gatewayError = (statusCode: number) =>
  new GatewayInternalServerError({ message: "gateway failed", statusCode });
const apiCallError = (statusCode: number, responseHeaders: Record<string, string> = {}) =>
  new APICallError({
    message: "call failed",
    url: "https://gateway.test",
    requestBodyValues: {},
    statusCode,
    responseHeaders,
  });
const retryError = (lastError: unknown) =>
  new RetryError({
    message: "retries exhausted",
    reason: "maxRetriesExceeded",
    errors: [lastError],
  });

describe("toAiHttpError", () => {
  it("maps a gateway 402 to 402", () => {
    expect(toAiHttpError(gatewayError(402))).toEqual({
      status: 402,
      message: "AI budget reached",
    });
  });
  it("maps a gateway 429 and forwards Retry-After", () => {
    const mapped = toAiHttpError(apiCallError(429, { "retry-after": "12" }));
    expect(mapped.status).toBe(429);
    expect(mapped.message).not.toBe("");
    expect(mapped.retryAfter).toBe("12");
  });
  it("maps a 429 without Retry-After and omits the field", () => {
    expect(toAiHttpError(gatewayError(429))).not.toHaveProperty("retryAfter");
    expect(toAiHttpError(gatewayError(429)).status).toBe(429);
  });
  it("unwraps RetryError.lastError", () =>
    expect(toAiHttpError(retryError(gatewayError(402))).status).toBe(402));
  it("unwraps RetryError around a rate limit", () =>
    expect(toAiHttpError(retryError(apiCallError(429, { "retry-after": "3" })))).toMatchObject({
      status: 429,
      retryAfter: "3",
    }));
  it("maps truncation to 502 with the too-large message", () =>
    expect(toAiHttpError(new StageOutputTooLargeError())).toEqual({
      status: 502,
      message: "The design was too large to generate",
    }));
  it("maps other provider statuses to 502", () => {
    expect(toAiHttpError(gatewayError(500)).status).toBe(502);
    expect(toAiHttpError(apiCallError(503)).status).toBe(502);
  });
  it("maps anything else to 502", () =>
    expect(toAiHttpError(new Error("boom"))).toEqual({
      status: 502,
      message: "The AI service is unavailable. Please retry.",
    }));
});
