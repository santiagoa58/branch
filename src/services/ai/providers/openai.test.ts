import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { OpenAIProvider } from "./openai";

const create = vi.hoisted(() => vi.fn<() => Promise<unknown>>());
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

  it("returns validated documentation and chat text", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: "Architecture notes" } }] });
    await expect(provider.generateDocumentation(diagram)).resolves.toBe("Architecture notes");
    await expect(provider.chat([], diagram)).resolves.toBe("Architecture notes");
  });
});
