// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { generateText, NoObjectGeneratedError, NoOutputGeneratedError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import type { DecisionsInput, DecisionsOutput } from "../../src/schemas/aiDesign";
import { createGatewayRunner, StageOutputTooLargeError } from "./runner";

interface GenerateCall {
  model: string;
  system: string;
  prompt: string;
  temperature: number;
  abortSignal: AbortSignal;
  providerOptions: unknown;
}

const generate = vi.fn<(options: GenerateCall) => Promise<unknown>>();
// The stub stands in for the generic generateText; tests only use the fields the runner reads.
const runner = createGatewayRunner({
  generate: generate as unknown as typeof generateText,
  env: { AI_MODEL: "test/default", AI_MODEL_DECISIONS: "test/decisions-model" },
});
const signal = new AbortController().signal;

const input: DecisionsInput = {
  context: { prompt: "A URL shortener", scope: "backend", requirements: [], outOfScope: [] },
  summary: "An API creates links and an edge function resolves them.",
  node: { key: "api", type: "service", label: "Links API" },
  neighbours: [],
};

const valid: DecisionsOutput = {
  choice: "Links API",
  reason: "Creating links needs auth.",
  gains: ["Abuse checks"],
  costs: ["Another service"],
  considered: [{ option: "Edge creation", whyNot: "Needs more context" }],
  revisitWhen: [],
};

function noObjectError(message: string, finishReason: "stop" | "length" = "stop") {
  return new NoObjectGeneratedError({
    message,
    text: "{}",
    response: { id: "r", timestamp: new Date(), modelId: "m" },
    usage: {
      inputTokens: 1,
      inputTokenDetails: {
        noCacheTokens: undefined,
        cacheReadTokens: undefined,
        cacheWriteTokens: undefined,
      },
      outputTokens: 1,
      outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
      totalTokens: 2,
    },
    finishReason,
  });
}

beforeEach(() => generate.mockReset());

describe("createGatewayRunner", () => {
  it("calls the gateway with the stage model, schema and owner", async () => {
    generate.mockResolvedValueOnce({ output: valid, finishReason: "stop" });
    await runner.run("decisions", input, "alice", signal);
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "test/decisions-model",
        temperature: 0,
        abortSignal: signal,
        providerOptions: { gateway: { user: "alice" } },
      }),
    );
    const call = generate.mock.calls[0]?.[0];
    expect(call?.system).toMatch(/system design interview/i);
    expect(call?.prompt).toContain("Links API");
  });

  it("uses the default model for stages without an override", async () => {
    generate.mockResolvedValueOnce({
      output: { endpoints: [], events: [] },
      finishReason: "stop",
    });
    await runner.run(
      "api",
      { context: input.context, summary: "", graph: { nodes: [], edges: [] } },
      "alice",
      signal,
    );
    expect(generate.mock.calls[0]?.[0].model).toBe("test/default");
  });

  it("retries once with the validation error, then succeeds", async () => {
    generate
      .mockRejectedValueOnce(noObjectError("bad"))
      .mockResolvedValueOnce({ output: valid, finishReason: "stop" });
    await expect(runner.run("decisions", input, "alice", signal)).resolves.toEqual(valid);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1]?.[0].prompt).toContain("bad");
    expect(generate.mock.calls[1]?.[0].prompt).toContain("Return output that matches the schema.");
  });

  it("fails after the second schema failure", async () => {
    generate
      .mockRejectedValueOnce(noObjectError("bad"))
      .mockRejectedValueOnce(noObjectError("still bad"));
    await expect(runner.run("decisions", input, "alice", signal)).rejects.toSatisfy((error) =>
      NoObjectGeneratedError.isInstance(error),
    );
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("retries when the output fails the stage schema", async () => {
    generate
      .mockResolvedValueOnce({ output: { ...valid, gains: [] }, finishReason: "stop" })
      .mockResolvedValueOnce({ output: valid, finishReason: "stop" });
    await expect(runner.run("decisions", input, "alice", signal)).resolves.toEqual(valid);
    expect(generate.mock.calls[1]?.[0].prompt).toContain("gains");
  });

  it("throws StageOutputTooLargeError on finishReason length", async () => {
    generate.mockRejectedValueOnce(noObjectError("truncated", "length"));
    await expect(runner.run("decisions", input, "alice", signal)).rejects.toBeInstanceOf(
      StageOutputTooLargeError,
    );
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("throws StageOutputTooLargeError when a truncated response has no output", async () => {
    generate.mockResolvedValueOnce({
      get output() {
        throw new NoOutputGeneratedError();
      },
      finishReason: "length",
    });
    await expect(runner.run("decisions", input, "alice", signal)).rejects.toBeInstanceOf(
      StageOutputTooLargeError,
    );
  });

  it("does not retry gateway failures", async () => {
    const failure = new Error("gateway down");
    generate.mockRejectedValueOnce(failure);
    await expect(runner.run("decisions", input, "alice", signal)).rejects.toBe(failure);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("reads the environment lazily, at the first run", () => {
    expect(() => createGatewayRunner()).not.toThrow();
  });
});

describe("createGatewayRunner with the AI SDK", () => {
  function reply(output: unknown, finishReason: "stop" | "length" = "stop") {
    return {
      content: [{ type: "text" as const, text: JSON.stringify(output) }],
      finishReason: { unified: finishReason, raw: finishReason },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 1, text: 1, reasoning: 0 },
      },
      warnings: [],
    };
  }

  function sdkRunner(model: MockLanguageModelV4) {
    // Routes the real generateText to the mock model instead of a gateway model id.
    const viaMock: typeof generateText = (options) => generateText({ ...options, model });
    return createGatewayRunner({ generate: viaMock, env: { AI_MODEL: "test/default" } });
  }

  it("parses a valid response", async () => {
    const model = new MockLanguageModelV4({ doGenerate: reply(valid) });
    await expect(sdkRunner(model).run("decisions", input, "alice", signal)).resolves.toEqual(valid);
  });

  it("retries a response that fails the schema with its issues", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: [reply({ ...valid, considered: [] }), reply(valid)],
    });
    await expect(sdkRunner(model).run("decisions", input, "alice", signal)).resolves.toEqual(valid);
    const retry = model.doGenerateCalls[1]?.prompt.find((message) => message.role === "user");
    const text = JSON.stringify(retry?.content);
    expect(text).toMatch(/Your previous output was invalid: .*considered/);
  });
});
