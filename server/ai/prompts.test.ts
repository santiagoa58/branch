// @vitest-environment node
import { describe, it, expect } from "vite-plus/test";
import {
  aiStageSchema,
  type ApiInput,
  type ComponentsInput,
  type DataModelInput,
  type DecisionsInput,
  type DesignContext,
  type RequirementsInput,
} from "../../src/schemas/aiDesign";
import { urlShortenerExample } from "./examples/urlShortener";
import { buildApiPrompt } from "./prompts/api";
import { buildComponentsPrompt } from "./prompts/components";
import { buildDataModelPrompt } from "./prompts/dataModel";
import { buildDecisionsPrompt } from "./prompts/decisions";
import { buildRequirementsPrompt } from "./prompts/requirements";
import { stagePrompts } from "./prompts";

const stage1Input: RequirementsInput = {
  prompt: "Design a shared grocery list app for households.",
  scope: "fullstack",
  requirements: [{ kind: "functional", text: "Members share lists" }],
  outOfScope: ["Ordering groceries"],
  answers: [{ question: "How many households?", answer: "About 1M households", assumed: false }],
};

const withAssumedAnswer: RequirementsInput = {
  ...stage1Input,
  answers: [{ question: "How fast must changes appear?", answer: "Instantly", assumed: true }],
};

const context: DesignContext = {
  prompt: "Design a shared grocery list app for households.",
  scope: "fullstack",
  requirements: [
    { kind: "functional", text: "Members share lists", assumed: false },
    { kind: "nonFunctional", text: "Serve about 1M households", assumed: false, category: "scale" },
    { kind: "nonFunctional", text: "Members see changes instantly", assumed: true },
  ],
  outOfScope: ["Ordering groceries"],
};

const stage2Input: ComponentsInput = { context, previousKeys: ["lists-service", "sync"] };

const graph: ApiInput["graph"] = {
  nodes: [
    { key: "mobile", type: "mobileapp", label: "Mobile app" },
    { key: "lists-service", type: "service", label: "Lists service" },
    { key: "db", type: "database", label: "Lists database" },
  ],
  edges: [
    { from: "mobile", to: "lists-service", protocol: "http", async: false },
    { from: "lists-service", to: "db", protocol: "tcp", async: false },
  ],
};

const decisionsInput: DecisionsInput = {
  context,
  summary: "Clients talk to a lists service backed by PostgreSQL.",
  node: {
    key: "lists-service",
    type: "service",
    label: "Lists service",
    responsibility: "Owns lists and items",
  },
  neighbours: [
    { key: "mobile", type: "mobileapp", label: "Mobile app", protocol: "http", direction: "in" },
  ],
};

const apiInput: ApiInput = { context, summary: decisionsInput.summary, graph };

const dataModelInput: DataModelInput = {
  context,
  graph,
  endpoints: [{ service: "lists-service", method: "POST", path: "/households/{id}/lists" }],
};

describe("stage prompts", () => {
  it("requirements prompt includes user lines, out-of-scope lines and answers", () => {
    const { prompt } = buildRequirementsPrompt(stage1Input);
    for (const text of ["Members share lists", "Ordering groceries", "About 1M households"]) {
      expect(prompt).toContain(text);
    }
  });
  it("requirements prompt marks assumed answers", () =>
    expect(buildRequirementsPrompt(withAssumedAnswer).prompt).toMatch(/assumed/i));
  it("requirements system prompt carries the stage 1 rules", () => {
    const { system } = buildRequirementsPrompt(stage1Input);
    expect(system).toMatch(/system design interview/i);
    expect(system).toMatch(/never re-ask/i);
    expect(system).toMatch(/conflict/i);
  });
  it("components prompt lists previous keys and the example", () => {
    const { system, prompt } = buildComponentsPrompt(stage2Input);
    expect(prompt).toContain("lists-service");
    expect(prompt).toMatch(/\(assumed\)/);
    expect(system).toContain(urlShortenerExample.components.summary);
  });
  it("components system prompt lists the allowed types and protocols", () => {
    const { system } = buildComponentsPrompt(stage2Input);
    for (const text of ["edgefunction", "vpc", "websocket"]) {
      expect(system).toContain(text);
    }
  });
  it("decisions prompt names the node and includes the example decision", () => {
    const { system, prompt } = buildDecisionsPrompt(decisionsInput);
    expect(prompt).toContain("lists-service");
    expect(prompt).toContain("Owns lists and items");
    expect(system).toContain(urlShortenerExample.decision.output.reason);
  });
  it("api prompt lists the graph and includes the example API", () => {
    const { system, prompt } = buildApiPrompt(apiInput);
    expect(prompt).toContain("mobile -> lists-service");
    expect(system).toContain(urlShortenerExample.api.endpoints[0]?.path ?? "missing");
  });
  it("data model prompt lists the endpoints", () => {
    const { system, prompt } = buildDataModelPrompt(dataModelInput);
    expect(prompt).toContain("POST /households/{id}/lists");
    expect(system).toMatch(/store/);
  });
  it("every stage has a prompt builder", () =>
    expect(Object.keys(stagePrompts).sort()).toEqual([...aiStageSchema.options].sort()));
});
