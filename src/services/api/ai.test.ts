import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { DecisionsInput, RequirementsInput } from "@/schemas/aiDesign";
import { AI_REQUEST_TIMEOUT_MS, AI_TIMEOUT_MESSAGE, AiTimeoutError, aiApi } from "./ai";
import { ApiError, ApiResponseValidationError } from "./errors";
import { setApiTokenProvider } from "./auth";

afterEach(() => {
  setApiTokenProvider(null);
  vi.unstubAllGlobals();
});

const requirementsInput: RequirementsInput = {
  prompt: "A URL shortener",
  scope: "backend",
  requirements: [],
  outOfScope: [],
  answers: [],
  askQuestions: false,
};

const requirementsOutput = {
  questions: [],
  requirements: [{ kind: "functional", text: "Create short links" }],
  assumptions: [],
  outOfScope: [],
};

const decisionsInput: DecisionsInput = {
  context: {
    prompt: "A URL shortener",
    scope: "backend",
    requirements: [],
    outOfScope: [],
  },
  summary: "Redirects short codes to long URLs.",
  node: { key: "cache", type: "cache", label: "Cache" },
  neighbours: [],
};

const validDecisionsOutput = {
  choice: "Redis",
  reason: "Low-latency lookups for hot short codes.",
  gains: ["Sub-millisecond reads"],
  costs: ["Another stateful service to run"],
  considered: [{ option: "Memcached", whyNot: "No persistence and fewer data types." }],
  revisitWhen: [],
};

/** Settles only when the request's signal aborts, the way fetch does. */
const untilAborted = (_input: RequestInfo | URL, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () =>
      reject(new DOMException("Aborted", "AbortError")),
    );
  });

describe("aiApi.run", () => {
  it("posts to /api/ai/<stage> and returns the validated output", async () => {
    setApiTokenProvider(async () => "token");
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(requirementsOutput)));
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();

    await expect(aiApi.run("requirements", requirementsInput, controller.signal)).resolves.toEqual(
      requirementsOutput,
    );

    expect(fetcher).toHaveBeenCalledOnce();
    const [path, options] = fetcher.mock.calls[0] ?? [];
    expect(path).toBe("/api/ai/requirements");
    expect(options?.method).toBe("POST");
    expect(options?.body).toBe(JSON.stringify(requirementsInput));
    // The request gets its own signal, which the run's signal and the timeout both abort.
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(options?.signal?.aborted).toBe(false);
    expect(new Headers(options?.headers).get("authorization")).toBe("Bearer token");
    expect(new Headers(options?.headers).get("content-type")).toBe("application/json");
  });

  it("rejects an output that fails the stage schema", async () => {
    setApiTokenProvider(async () => "token");
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify({ choice: "Redis" })));
    vi.stubGlobal("fetch", fetcher);
    const signal = new AbortController().signal;

    await expect(aiApi.run("decisions", decisionsInput, signal)).rejects.toBeInstanceOf(
      ApiResponseValidationError,
    );
  });

  it("accepts a well-formed output for the stage", async () => {
    setApiTokenProvider(async () => "token");
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(validDecisionsOutput)));
    vi.stubGlobal("fetch", fetcher);
    const signal = new AbortController().signal;

    await expect(aiApi.run("decisions", decisionsInput, signal)).resolves.toEqual(
      validDecisionsOutput,
    );
    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/ai/decisions");
  });

  it("surfaces a 402 as ApiError with status 402", async () => {
    setApiTokenProvider(async () => "token");
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () =>
          new Response('{"message":"Payment required to run AI stages."}', { status: 402 }),
      );
    vi.stubGlobal("fetch", fetcher);
    const signal = new AbortController().signal;

    await expect(aiApi.run("requirements", requirementsInput, signal)).rejects.toBeInstanceOf(
      ApiError,
    );
    await expect(aiApi.run("requirements", requirementsInput, signal)).rejects.toMatchObject({
      status: 402,
    });
    await expect(aiApi.run("requirements", requirementsInput, signal)).rejects.toThrow(
      "Payment required to run AI stages.",
    );
  });

  it("forwards cancellation to the request", async () => {
    setApiTokenProvider(async () => "token");
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    controller.abort();

    await expect(
      aiApi.run("requirements", requirementsInput, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("aborts the request when the run is cancelled mid-flight, without a timeout error", async () => {
    setApiTokenProvider(async () => "token");
    const fetcher = vi.fn<typeof fetch>().mockImplementation(untilAborted);
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();

    const request = aiApi.run("requirements", requirementsInput, controller.signal);
    const settled = request.catch((error: unknown) => error);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    controller.abort();

    const error = await settled;
    expect(error).toMatchObject({ name: "AbortError" });
    expect(error).not.toBeInstanceOf(AiTimeoutError);
  });

  describe("timeout", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("gives up after the request timeout with a timeout error, not a cancel", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      setApiTokenProvider(async () => "token");
      const fetcher = vi.fn<typeof fetch>().mockImplementation(untilAborted);
      vi.stubGlobal("fetch", fetcher);
      const controller = new AbortController();

      const request = aiApi.run("requirements", requirementsInput, controller.signal);
      const settled = request.catch((error: unknown) => error);
      // Settles the token lookup without moving the clock (`vi.waitFor` would advance it).
      await vi.advanceTimersByTimeAsync(0);
      expect(fetcher).toHaveBeenCalledOnce();
      const requestSignal = fetcher.mock.calls[0]?.[1]?.signal;
      await vi.advanceTimersByTimeAsync(AI_REQUEST_TIMEOUT_MS - 1);
      expect(requestSignal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);

      const error = await settled;
      expect(error).toBeInstanceOf(AiTimeoutError);
      expect(error).toHaveProperty("message", AI_TIMEOUT_MESSAGE);
      expect(requestSignal?.aborted).toBe(true);
      // The run was not cancelled: the pipeline reports the timeout as a stage error.
      expect(controller.signal.aborted).toBe(false);
    });

    it("clears its timer once the request settles", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      setApiTokenProvider(async () => "token");
      vi.stubGlobal(
        "fetch",
        vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(requirementsOutput))),
      );

      await aiApi.run("requirements", requirementsInput, new AbortController().signal);
      expect(vi.getTimerCount()).toBe(0);
    });

    it("sits comfortably above the 300 s platform function limit", () => {
      expect(AI_REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(330_000);
    });
  });
});
