// @vitest-environment node
import { describe, expect, it } from "vite-plus/test";
import type {
  ComponentsOutput,
  DecisionsOutput,
  RequirementsOutput,
} from "../../../src/schemas/aiDesign";
import { checkComponents, checkDecisions, checkRequirements } from "./checks";
import type { EvalCase } from "./fixtures";

const open: EvalCase = {
  id: "open",
  scope: "backend",
  kind: "vague",
  input: {
    prompt: "A queue",
    scope: "backend",
    requirements: [],
    outOfScope: [],
    answers: [],
    askQuestions: false,
  },
  expect: { assumes: true },
};

const settled: EvalCase = {
  id: "settled",
  scope: "backend",
  kind: "complete",
  input: {
    prompt: "A queue",
    scope: "backend",
    requirements: [{ kind: "functional", text: "Producers publish jobs" }],
    outOfScope: [],
    answers: [{ question: "How many messages per second?", answer: "10k", assumed: false }],
    askQuestions: false,
  },
  expect: { assumes: false, mustInclude: { types: ["queue"], protocols: ["amqp"] } },
};

const question = {
  id: "q1",
  topic: "Delivery",
  question: "Is at-least-once delivery acceptable?",
  why: "Decides whether consumers must be idempotent",
  options: [
    { label: "Yes", impact: "Consumers deduplicate" },
    { label: "No", impact: "Needs transactions" },
  ],
  recommended: "Yes",
  allowsCustom: true,
};

const requirementsOut = (
  questions: RequirementsOutput["questions"],
  assumptions: RequirementsOutput["assumptions"] = [],
): RequirementsOutput => ({ questions, requirements: [], assumptions, outOfScope: [] });

const assumption = { kind: "nonFunctional", text: "At-least-once delivery" } as const;

describe("checkRequirements", () => {
  it("passes when a case with open decisions assumes them without asking", () => {
    expect(checkRequirements(open, requirementsOut([], [assumption]))).toEqual([]);
  });

  it("fails when a case with open decisions lists no assumption", () => {
    expect(checkRequirements(open, requirementsOut([]))).toEqual([
      "expected assumptions but got none",
    ]);
  });

  it("passes when a settled case asks nothing and assumes nothing", () => {
    expect(checkRequirements(settled, requirementsOut([]))).toEqual([]);
  });

  it("fails whenever a question is asked", () => {
    expect(checkRequirements(settled, requirementsOut([question]))).toEqual([
      "expected no questions but got 1",
    ]);
    expect(checkRequirements(open, requirementsOut([question], [assumption]))).toEqual([
      "expected no questions but got 1",
    ]);
  });
});

const components = (overrides: Partial<ComponentsOutput> = {}): ComponentsOutput => ({
  summary: "A queue between producers and workers.",
  groups: [],
  components: [
    { key: "jobs", type: "queue", label: "Jobs", responsibility: "Holds jobs" },
    { key: "worker", type: "worker", label: "Worker", responsibility: "Runs jobs" },
  ],
  connections: [
    { from: "worker", to: "jobs", protocol: "amqp", purpose: "Take jobs", async: true },
  ],
  mainFlow: { name: "Run a job", description: "Publish then consume", entry: "worker" },
  ...overrides,
});

describe("checkComponents", () => {
  it("passes when every required type and protocol is present", () => {
    expect(checkComponents(settled, components())).toEqual([]);
  });

  it("passes when the case requires nothing", () => {
    expect(checkComponents(open, components({ components: [], connections: [] }))).toEqual([]);
  });

  it("fails for a missing component type", () => {
    const out = components({
      components: components().components.filter((c) => c.type !== "queue"),
    });
    expect(checkComponents(settled, out)).toEqual(["missing component type: queue"]);
  });

  it("fails for a missing protocol", () => {
    const out = components({
      connections: [{ from: "worker", to: "jobs", protocol: "http", purpose: "x", async: false }],
    });
    expect(checkComponents(settled, out)).toEqual(["missing connection protocol: amqp"]);
  });
});

const decision: DecisionsOutput = {
  choice: "RabbitMQ",
  reason: "Simple routing",
  gains: ["Mature"],
  costs: ["Single node limits"],
  considered: [{ option: "Kafka", whyNot: "Heavier" }],
  revisitWhen: [],
};

describe("checkDecisions", () => {
  it("passes when every node has a decision", () => {
    expect(checkDecisions(["jobs", "worker"], { jobs: decision, worker: decision })).toEqual([]);
  });

  it("fails for each node without a decision", () => {
    expect(checkDecisions(["jobs", "worker"], { jobs: decision })).toEqual([
      "no decision for worker",
    ]);
  });
});
