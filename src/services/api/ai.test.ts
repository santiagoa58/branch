import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { DecisionsInput, RequirementsInput } from "@/schemas/aiDesign";
import { aiApi } from "./ai";
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
    expect(options?.signal).toBe(controller.signal);
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
});
