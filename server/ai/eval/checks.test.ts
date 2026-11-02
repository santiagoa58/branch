// @vitest-environment node
import { describe, expect, it } from "vite-plus/test";
import type {
  ComponentsOutput,
  DecisionsOutput,
  RequirementsOutput,
} from "../../../src/schemas/aiDesign";
import { checkComponents, checkDecisions, checkRequirements } from "./checks";
import type { EvalCase } from "./fixtures";

const asking: EvalCase = {
  id: "asking",
  scope: "backend",
  kind: "vague",
  input: { prompt: "A queue", scope: "backend", requirements: [], outOfScope: [], answers: [] },
  expect: { asks: true },
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
  },
  expect: { asks: false, mustInclude: { types: ["queue"], protocols: ["amqp"] } },
};

const question = (overrides: Partial<RequirementsOutput["questions"][number]> = {}) => ({
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
  ...overrides,
});

const requirementsOut = (questions: RequirementsOutput["questions"]): RequirementsOutput => ({
  questions,
  requirements: [],
  assumptions: [],
  outOfScope: [],
});

describe("checkRequirements", () => {
  it("passes when a case that should ask asks with recommended answers", () => {
    expect(checkRequirements(asking, requirementsOut([question()]))).toEqual([]);
  });

  it("fails when a case that should ask asks nothing", () => {
    expect(checkRequirements(asking, requirementsOut([]))).toEqual([
      "expected questions but got none",
    ]);
  });

  it("passes when a case that should not ask asks nothing", () => {
    expect(checkRequirements(settled, requirementsOut([]))).toEqual([]);
  });

  it("fails when a case that should not ask asks", () => {
    expect(checkRequirements(settled, requirementsOut([question()]))).toEqual([
      "expected no questions but got 1",
    ]);
  });

  it("fails when an answered question is asked again", () => {
    const again = question({ question: "  how many MESSAGES per second? " });
    const failures = checkRequirements(
      { ...settled, expect: { asks: true } },
      requirementsOut([again]),
    );
    expect(failures).toEqual(['re-asks an answered question: "how many MESSAGES per second?"']);
  });

  it("passes when the asked question differs from the answered ones", () => {
    const failures = checkRequirements(
      { ...settled, expect: { asks: true } },
      requirementsOut([question()]),
    );
    expect(failures).toEqual([]);
  });

  it("fails when a question has no recommended answer", () => {
    expect(checkRequirements(asking, requirementsOut([question({ recommended: " " })]))).toEqual([
      'question "q1" has no recommended answer',
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
    expect(checkComponents(asking, components({ components: [], connections: [] }))).toEqual([]);
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
