import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { OpenAIProvider } from "./openai";
import { diagramDataSchema } from "@/schemas/diagram";

const create = vi.hoisted(() =>
  vi.fn<(request: { messages: { role: string; content: string }[] }) => Promise<unknown>>(),
);
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
  },
}));

describe("OpenAI response validation", () => {
  const provider = new OpenAIProvider("test-key");
  const diagram = { nodes: [], edges: [] };

  beforeEach(() => {
    create.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([null, 123, "", "   "])("rejects invalid documentation content: %j", async (content) => {
    create.mockResolvedValue({ choices: [{ message: { content } }] });
    await expect(provider.generateDocumentation(diagram)).rejects.toThrow(/content/);
  });

  it("rejects an empty suggestion response rather than returning success", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: null } }] });
    await expect(provider.suggestConnections(diagram)).rejects.toThrow(/content/);
  });

  it("rejects a malformed chat completion", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: { text: "bad" } } }] });
    await expect(provider.chat([], diagram)).rejects.toThrow(/content/);
  });

  it.each(["documentation", "chat", "analysis", "suggestions"])(
    "includes decision-first guidance and unit-bearing context in %s requests",
    async (operation) => {
      const context = diagramDataSchema.parse({
        nodes: [
          {
            id: "group-1",
            type: "group",
            position: { x: 0, y: 0 },
            data: {
              label: "Boundary",
              groupType: "vpc",
              decision: { choice: "Private network", assumptions: "Illustrative isolation" },
            },
          },
          {
            id: "node-1",
            type: "architecture",
            position: { x: 0, y: 0 },
            data: {
              label: "API",
              type: "service",
              description: "Domain entry point",
              decision: {
                choice: "Stateless API",
                reason: "Independent scaling",
                benefits: ["Scales per service"],
                drawbacks: ["Network overhead"],
                considered: [{ option: "Monolith", whyNot: "One deploy for everything" }],
                revisitWhen: ["Example workload changes"],
              },
              attributes: [{ name: "Latency budget", value: "25", unit: "ms" }],
              metadata: { Owner: "Platform", Replicas: "3" },
            },
          },
        ],
        edges: [
          {
            id: "edge-1",
            source: "node-1",
            target: "node-1",
            data: {
              protocol: "http",
              decision: { choice: "Bounded retries", tradeoffs: "Duplicate delivery" },
            },
          },
        ],
      });
      const content =
        operation === "analysis"
          ? JSON.stringify({ summary: "Example", score: 80, issues: [], recommendations: [] })
          : operation === "suggestions"
            ? JSON.stringify({ suggestions: [] })
            : "Architecture notes";
      create.mockResolvedValue({ choices: [{ message: { content } }] });

      if (operation === "documentation") {
        await provider.generateDocumentation(context);
      } else if (operation === "chat") {
        await provider.chat([], context);
      } else if (operation === "analysis") {
        await provider.analyzeArchitecture(context);
      } else {
        await provider.suggestConnections(context);
      }

      expect(create).toHaveBeenCalledOnce();
      const request = create.mock.calls[0]?.[0];
      expect(request).toBeDefined();
      const systemPrompt = request?.messages.find((message) => message.role === "system")?.content;
      expect(systemPrompt).toContain("numeric attributes need a unit");
      expect(systemPrompt).toContain("not dedicated technology or port properties");
      expect(systemPrompt).toContain("considered: {option, whyNot?}[]");
      const contextRole = operation === "chat" ? "system" : "user";
      const contextText = request?.messages.find(
        (message) => message.role === contextRole,
      )?.content;
      for (const text of [
        "Domain entry point",
        "Choice: Stateless API",
        "Why: Independent scaling",
        "Benefit: Scales per service",
        "Drawback: Network overhead",
        "Considered: Monolith — One deploy for everything",
        "Revisit when: Example workload changes",
        "Latency budget: 25 ms",
        "Owner: Platform",
        "Replicas: 3\n",
        "Choice: Private network",
        // Legacy paragraph fields still reach the model, under their structured section.
        "Revisit when: Illustrative isolation",
        "Choice: Bounded retries",
        "Drawback: Duplicate delivery",
      ]) {
        expect(contextText).toContain(text);
      }
    },
  );

  it("returns validated documentation and chat text", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: "Architecture notes" } }] });
    await expect(provider.generateDocumentation(diagram)).resolves.toBe("Architecture notes");
    await expect(provider.chat([], diagram)).resolves.toBe("Architecture notes");
  });
});
