// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { generateText, NoObjectGeneratedError, NoOutputGeneratedError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import {
  aiStageSchema,
  type AiStage,
  type DecisionsInput,
  type DecisionsOutput,
  type StageInput,
  type StageOutput,
} from "../../src/schemas/aiDesign";
import { toAiHttpError } from "./errors";
import { urlShortenerExample } from "./eval/urlShortenerFixture";
import { stagePrompts } from "./prompts";
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
  it("calls the gateway with the stage model, schema, owner and non-strict OpenAI schemas", async () => {
    generate.mockResolvedValueOnce({ output: valid, finishReason: "stop" });
    await runner.run("decisions", input, "alice", signal);
    expect(generate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "test/decisions-model",
        temperature: 0,
        abortSignal: signal,
        providerOptions: {
          gateway: { user: "alice", has: ["structured-output"] },
          openai: { strictJsonSchema: false },
        },
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
    expect(generate.mock.calls[1]?.[0].prompt).toMatch(/matches the structured output schema/);
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

  function systemOf(call: { prompt: { role: string; content: unknown }[] } | undefined): string {
    const system = call?.prompt.find((message) => message.role === "system")?.content;
    return typeof system === "string" ? system : "";
  }

  function userTextOf(call: { prompt: { role: string; content: unknown }[] } | undefined): string {
    return JSON.stringify(call?.prompt.find((message) => message.role === "user")?.content);
  }

  const context = urlShortenerExample.context;
  const emptyGraph = { nodes: [], edges: [] };
  // One input and one schema-valid output per stage.
  const cases: { [S in AiStage]: { input: StageInput<S>; output: StageOutput<S> } } = {
    requirements: {
      input: {
        prompt: "A shared editor",
        scope: "fullstack",
        requirements: [],
        outOfScope: [],
        answers: [],
        askQuestions: false,
      },
      output: {
        questions: [
          {
            id: "q1",
            topic: "sync",
            question: "How do edits merge?",
            why: "Decides whether a sync server is needed.",
            options: [
              { label: "CRDT", impact: "Offline edits merge without a server" },
              { label: "Operational transformation", impact: "Needs a coordinating server" },
            ],
            recommended: "CRDT",
            allowsCustom: true,
          },
        ],
        requirements: [
          { kind: "nonFunctional", text: "Edits appear within 200 ms", category: "latency" },
        ],
        assumptions: [{ kind: "constraint", text: "The backend is a single box" }],
        outOfScope: ["Authentication"],
      },
    },
    components: {
      input: { context, previousKeys: [] },
      output: urlShortenerExample.components,
    },
    decisions: { input, output: valid },
    api: {
      input: { context, summary: "", graph: emptyGraph },
      output: urlShortenerExample.api,
    },
    "data-model": {
      input: { context, graph: emptyGraph, endpoints: [] },
      output: {
        entities: [
          {
            name: "Link",
            store: "db",
            fields: [{ name: "code", type: "string", key: "primary" }],
            relations: [],
          },
        ],
      },
    },
  };

  async function runCase<S extends AiStage>(
    stage: S,
    { input: stageInput, output }: { input: StageInput<S>; output: StageOutput<S> },
  ) {
    const model = new MockLanguageModelV4({ doGenerate: reply(output) });
    await expect(sdkRunner(model).run(stage, stageInput, "alice", signal)).resolves.toEqual(output);
    return { model, expectedSystem: stagePrompts[stage](stageInput).system };
  }

  it.each(aiStageSchema.options)(
    "sends the %s structured output schema to the SDK without embedding it in the system prompt",
    async (stage) => {
      const { model, expectedSystem } = await runCase(stage, cases[stage]);
      const system = systemOf(model.doGenerateCalls[0]);
      expect(system).toBe(expectedSystem);
      expect(system).toMatch(/structured output schema/);
      expect(system).not.toContain('"additionalProperties":false');
    },
  );

  describe("the real-run requirements failure", () => {
    // Stage 1 output from a production run: well-formed JSON in an invented shape.
    const invented = {
      questions: [
        {
          id: "q1",
          topic: "real-time-collaboration",
          question: "Which algorithm supports live collaboration for 500 users with offline mode?",
          recommended: true,
          allowsCustom: false,
          options: [
            {
              id: "opt1a",
              text: "CRDT with automatic conflict resolution",
              impact: "Enables offline editing without central coordination",
            },
            {
              id: "opt1b",
              text: "Operational Transformation with server coordination",
              impact: "Requires server for transformation, higher latency",
            },
            {
              id: "opt1c",
              text: "Custom hybrid approach combining both",
              impact: "Increased complexity, flexible trade-offs",
            },
          ],
        },
      ],
      requirements: [
        { text: "Live Collaboration", category: "functional" },
        { text: "Real-time performance", category: "non-functional" },
        { text: "Offline support", category: "constraint" },
      ],
      assumptions: [{ id: "a1", text: "Backend runs on a single box as per scope constraint" }],
      outOfScope: ["Authentication"],
    };
    const { input: stage1Input, output: stage1Output } = cases.requirements;

    it("retries with the issues and the schema guidance, then accepts a valid shape", async () => {
      const model = new MockLanguageModelV4({ doGenerate: [reply(invented), reply(stage1Output)] });
      await expect(
        sdkRunner(model).run("requirements", stage1Input, "alice", signal),
      ).resolves.toEqual(stage1Output);
      expect(model.doGenerateCalls).toHaveLength(2);
      const [first, retry] = model.doGenerateCalls;
      expect(systemOf(first)).toMatch(/structured output schema/);
      expect(systemOf(retry)).toBe(systemOf(first));
      const retryText = userTextOf(retry);
      expect(retryText).toMatch(/Your previous output was invalid: .*questions\[0\]\.why/);
      expect(retryText).toMatch(/matches the structured output schema/);
      expect(retryText).toMatch(/do not add or rename keys/);
    });

    it("fails when both attempts have the invented shape, as a 502", async () => {
      const model = new MockLanguageModelV4({ doGenerate: [reply(invented), reply(invented)] });
      const error = await sdkRunner(model)
        .run("requirements", stage1Input, "alice", signal)
        .catch((failure: unknown) => failure);
      expect(NoObjectGeneratedError.isInstance(error)).toBe(true);
      expect(model.doGenerateCalls).toHaveLength(2);
      expect(toAiHttpError(error)).toEqual({
        status: 502,
        message: "The AI service is unavailable. Please retry.",
      });
    });
  });
});
