// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { APICallError } from "ai";
import { GatewayInternalServerError } from "@ai-sdk/gateway";
import { apiErrorBodySchema } from "../src/schemas/api";
import { createHandler } from "./handler";
import { WorkspaceRepository, type Database } from "./repository";
import { MAX_BODY_BYTES } from "./http/body";
import type { AiStage } from "../src/schemas/aiDesign";
import { StageOutputTooLargeError, type AiStageRunner } from "./ai/runner";

const run =
  vi.fn<(stage: AiStage, input: unknown, owner: string, signal: AbortSignal) => Promise<unknown>>();
// The runner is generic over the stage; the stub returns whatever each test queues.
const ai: AiStageRunner = {
  run: async (stage, input, owner, signal) => (await run(stage, input, owner, signal)) as never,
};
const handle = createHandler({
  authenticate: async (request) => request.headers.get("x-test-user") || null,
  repository: new WorkspaceRepository({
    query: vi.fn<Database["query"]>(),
    transaction: async () => {
      throw new Error("unused");
    },
  }),
  ai,
});

const valid = {
  prompt: "A URL shortener",
  scope: "backend",
  requirements: [],
  outOfScope: [],
  answers: [],
};
const stage1Output = { questions: [], requirements: [], assumptions: [], outOfScope: [] };

function post(path: string, body: unknown, user = "alice", contentType = "application/json") {
  return handle(
    new Request(`https://branch.test/api${path}`, {
      method: "POST",
      headers: { "x-test-user": user, "Content-Type": contentType },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  run.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/ai/:stage", () => {
  it("requires sign-in", async () =>
    expect((await post("/ai/requirements", valid, "")).status).toBe(401));
  it("rejects an unknown stage", async () =>
    expect((await post("/ai/chat", valid)).status).toBe(404));
  it("rejects input that fails the stage schema", async () => {
    expect((await post("/ai/requirements", { prompt: 1 })).status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });
  it("rejects non-JSON bodies", async () =>
    expect((await post("/ai/requirements", "hello", "alice", "text/plain")).status).toBe(415));
  it("returns 413 for an oversized body", async () => {
    const huge = { ...valid, prompt: "x".repeat(MAX_BODY_BYTES + 1) };
    const response = await post("/ai/requirements", huge);
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ message: "Request is too large." });
    expect(run).not.toHaveBeenCalled();
  });
  it("passes the owner to the runner and returns its output", async () => {
    run.mockResolvedValue(stage1Output);
    const response = await post("/ai/requirements", valid, "alice");
    expect(response.status).toBe(200);
    expect(run).toHaveBeenCalledWith("requirements", valid, "alice", expect.any(AbortSignal));
    expect(await response.json()).toEqual(stage1Output);
  });
  it("accepts the hyphenated data-model stage", async () => {
    const input = {
      context: { prompt: "A URL shortener", scope: "backend", requirements: [], outOfScope: [] },
      graph: { nodes: [], edges: [] },
      endpoints: [],
    };
    run.mockResolvedValue({ entities: [] });
    const response = await post("/ai/data-model", input);
    expect(response.status).toBe(200);
    expect(run).toHaveBeenCalledWith("data-model", input, "alice", expect.any(AbortSignal));
  });
  it.each([
    [
      402,
      "AI budget reached",
      () => new GatewayInternalServerError({ message: "x", statusCode: 402 }),
    ],
    [502, "The design was too large to generate", () => new StageOutputTooLargeError()],
    [502, "The AI service is unavailable. Please retry.", () => new Error("boom")],
  ])("maps runner failures to %i", async (status, message, failure) => {
    run.mockRejectedValue(failure());
    const response = await post("/ai/requirements", valid);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ message });
  });
  it("maps a rate limit to 429 and forwards Retry-After", async () => {
    run.mockRejectedValue(
      new APICallError({
        message: "x",
        url: "https://gateway.test",
        requestBodyValues: {},
        statusCode: 429,
        responseHeaders: { "retry-after": "7" },
      }),
    );
    const response = await post("/ai/requirements", valid);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("7");
    expect(apiErrorBodySchema.parse(await response.json()).message).not.toBe("");
  });
  it("rejects GET and HEAD", async () => {
    for (const method of ["GET", "HEAD"]) {
      const response = await handle(
        new Request("https://branch.test/api/ai/requirements", {
          method,
          headers: { "x-test-user": "alice" },
        }),
      );
      expect(response.status).toBe(405);
    }
    expect(run).not.toHaveBeenCalled();
  });
});
