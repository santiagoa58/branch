import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { setApiTokenProvider } from "./auth";
import { ApiError } from "./errors";
import { sendApiRequest } from "./transport";

function respondWith(body: string, init: ResponseInit) {
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>().mockImplementation(async () => new Response(body, init)),
  );
}

async function rejection(): Promise<ApiError> {
  const error: unknown = await sendApiRequest("POST", "/ai/requirements").catch(
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ApiError);
  if (!(error instanceof ApiError)) {
    throw new TypeError("sendApiRequest did not reject with an ApiError");
  }
  return error;
}

beforeEach(() => {
  setApiTokenProvider(async () => "token");
});

afterEach(() => {
  setApiTokenProvider(null);
  vi.unstubAllGlobals();
});

describe("sendApiRequest", () => {
  it("carries the server message of a valid error body as its detail", async () => {
    respondWith('{"message":"AI budget reached"}', { status: 402, statusText: "Payment Required" });

    const error = await rejection();

    expect(error.status).toBe(402);
    expect(error.detail).toBe("AI budget reached");
    expect(error.message).toBe(
      "POST /ai/requirements failed (402 Payment Required): AI budget reached",
    );
  });

  it.each([
    ["an empty", "", "the backend returned an invalid error body."],
    ["a malformed JSON", "<html>Gateway Timeout</html>", "the backend returned malformed JSON."],
    ["an invalid", '{"error":"AI budget reached"}', "the backend returned an invalid error body."],
  ])(
    "carries the transport's reason for %s error body as its detail",
    async (_kind, body, reason) => {
      respondWith(body, { status: 504, statusText: "Gateway Timeout" });

      const error = await rejection();

      expect(error.status).toBe(504);
      expect(error.detail).toBe(reason);
      expect(error.message).toBe(`POST /ai/requirements failed (504 Gateway Timeout): ${reason}`);
    },
  );
});
