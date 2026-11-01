import { describe, expect, it } from "vite-plus/test";
import {
  aiStageSchema,
  componentsOutputSchema,
  decisionsOutputSchema,
  designBriefSchema,
  stageSchemas,
  requirementsOutputSchema,
} from "./aiDesign";
import { diagramDataSchema } from "./diagram";

type Json = Record<string, unknown>;

const question = {
  id: "q1",
  topic: "Scale",
  question: "How many users?",
  why: "Sizing changes the storage choice.",
  options: [
    { label: "Thousands", impact: "A single database is enough." },
    { label: "Millions", impact: "Needs sharding." },
  ],
  recommended: "Thousands",
  allowsCustom: true,
};

function stage1(overrides: Json = {}) {
  return {
    questions: [{ ...question, ...overrides }],
    requirements: [{ kind: "nonFunctional", text: "p95 under 200ms", category: "latency" }],
    assumptions: [{ kind: "constraint", text: "Single region" }],
    outOfScope: ["Billing"],
  };
}

const decision = {
  choice: "PostgreSQL",
  reason: "Relational data with transactions.",
  gains: ["ACID transactions"],
  costs: ["Vertical scaling limits"],
  considered: [{ option: "DynamoDB", whyNot: "Access patterns are not known yet." }],
  revisitWhen: ["Writes exceed 10k/s"],
};

function graph(component: Json = {}) {
  return {
    summary: "A list app. It has one service.",
    groups: [{ key: "backend", type: "boundary", label: "Backend" }],
    components: [
      {
        key: "lists-service",
        type: "service",
        label: "Lists Service",
        responsibility: "Owns lists.",
        group: "backend",
        ...component,
      },
    ],
    connections: [],
    mainFlow: { name: "Create list", description: "User creates a list.", entry: "lists-service" },
  };
}
const graphWithKey = (key: string) => graph({ key });
const graphWithType = (type: string) => graph({ type });

const brief = {
  inputs: {
    prompt: "A todo app",
    scope: "fullstack",
    requirements: [{ id: "r1", kind: "functional", text: "Create lists" }],
    outOfScope: [{ id: "o1", text: "Billing" }],
    answers: [{ id: "a1", question: "How many users?", answer: "Thousands", assumed: false }],
  },
  questions: [question],
  requirements: [{ kind: "nonFunctional", text: "p95 under 200ms", category: "latency" }],
  assumptions: [{ kind: "constraint", text: "Single region" }],
  outOfScope: ["Billing"],
  summary: "A list app.",
  api: {
    endpoints: [
      {
        key: "create-list",
        service: "lists-service",
        calledBy: ["web"],
        method: "POST",
        path: "/lists",
        summary: "Create a list",
        auth: "user",
        style: "request",
        request: { name: "string" },
        errors: [{ status: 400, when: "Name is empty" }],
      },
    ],
    events: [
      {
        name: "list.created",
        producer: "lists-service",
        consumers: ["search"],
        payload: { id: "string" },
      },
    ],
  },
  dataModel: {
    entities: [
      {
        name: "List",
        store: "db",
        fields: [{ name: "id", type: "uuid", key: "primary" }],
        relations: [{ to: "Item", kind: "one-to-many" }],
      },
    ],
  },
  ranFrom: { requirements: "abc", dataModel: "def" },
};
const withBrief = { nodes: [], edges: [], brief };
const briefWithScope = (scope: string) => ({
  ...withBrief,
  brief: { ...brief, inputs: { ...brief.inputs, scope } },
});

describe("stage 1 output", () => {
  it("accepts a free-text question with no options", () => {
    expect(requirementsOutputSchema.safeParse(stage1({ options: [] })).success).toBe(true);
  });
  it("accepts a question with two options", () => {
    expect(requirementsOutputSchema.safeParse(stage1()).success).toBe(true);
  });
  it("rejects a question with exactly one option", () => {
    expect(
      requirementsOutputSchema.safeParse(stage1({ options: [{ label: "A", impact: "x" }] }))
        .success,
    ).toBe(false);
  });
  it("requires a recommended answer", () => {
    expect(requirementsOutputSchema.safeParse(stage1({ recommended: undefined })).success).toBe(
      false,
    );
  });
});

describe("stage 3 output", () => {
  it("accepts a complete decision", () => {
    expect(decisionsOutputSchema.safeParse(decision).success).toBe(true);
  });
  it.each(["gains", "costs", "considered"])("requires at least one %s", (field) => {
    expect(decisionsOutputSchema.safeParse({ ...decision, [field]: [] }).success).toBe(false);
  });
  it("allows an empty revisitWhen", () => {
    expect(decisionsOutputSchema.safeParse({ ...decision, revisitWhen: [] }).success).toBe(true);
  });
});

describe("stage 2 output", () => {
  it("accepts a valid graph", () => {
    expect(componentsOutputSchema.safeParse(graph()).success).toBe(true);
  });
  it("rejects a non-slug key", () => {
    expect(componentsOutputSchema.safeParse(graphWithKey("Lists Service")).success).toBe(false);
  });
  it("rejects an unknown node type", () => {
    expect(componentsOutputSchema.safeParse(graphWithType("mainframe")).success).toBe(false);
  });
});

describe("stage lookup", () => {
  it("has an input and output schema for every stage", () => {
    for (const stage of aiStageSchema.options) {
      expect(stageSchemas[stage].input).toBeDefined();
      expect(stageSchemas[stage].output).toBeDefined();
    }
  });
});

describe("design brief", () => {
  it("accepts a brief with empty fingerprints and no stage 4-5 output", () => {
    const { api: _api, dataModel: _dataModel, ...minimal } = brief;
    expect(designBriefSchema.safeParse({ ...minimal, ranFrom: {} }).success).toBe(true);
  });
  it("requires ranFrom", () => {
    expect(designBriefSchema.safeParse({ ...brief, ranFrom: undefined }).success).toBe(false);
  });
});

describe("diagram brief", () => {
  it("round-trips a diagram with a brief", () => {
    expect(diagramDataSchema.parse(withBrief).brief).toEqual(withBrief.brief);
  });
  it("still accepts a diagram without a brief", () => {
    expect(diagramDataSchema.safeParse({ nodes: [], edges: [] }).success).toBe(true);
  });
  it("rejects a brief whose inputs.scope is unknown", () => {
    expect(diagramDataSchema.safeParse(briefWithScope("mobile")).success).toBe(false);
  });
});
