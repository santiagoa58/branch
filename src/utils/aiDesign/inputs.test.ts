import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vite-plus/test";
import type { DesignBrief, DesignContext } from "@/schemas/aiDesign";
import {
  addOutOfScopeLine,
  addRequirementLine,
  answerQuestion,
  assumeRemaining,
  bringIntoScope,
  buildDesignContext,
  changeAssumption,
  confirmAssumption,
  createBrief,
  decisionInput,
  editOutOfScopeLine,
  editRequirementLine,
  graphSummary,
  nodeIdentity,
  normalizeText,
  removeDerivedRequirement,
  removeOutOfScopeLine,
  removeRequirementLine,
  requireCondition,
  requirementsInput,
  type StageDesign,
} from "./inputs";

function ids() {
  let n = 0;
  return () => `id-${++n}`;
}

function question(text: string, recommended: string): DesignBrief["questions"][number] {
  return {
    id: `q-${text}`,
    topic: "Topic",
    question: text,
    why: "Because",
    options: [],
    recommended,
    allowsCustom: true,
  };
}

const answered = { id: "a-1", question: "How many users?", answer: "10k", assumed: false };

function brief(overrides: Partial<DesignBrief> = {}): DesignBrief {
  return {
    inputs: {
      prompt: "A shared shopping list",
      scope: "fullstack",
      requirements: [
        { id: "r-1", kind: "functional", text: "Members share lists" },
        { id: "r-2", kind: "constraint", text: "Use Postgres" },
      ],
      outOfScope: [{ id: "o-1", text: "Billing" }],
      answers: [],
    },
    questions: [],
    requirements: [],
    assumptions: [],
    outOfScope: [],
    ranFrom: {},
    ...overrides,
  };
}

function withOutputs(): DesignBrief {
  return brief({
    questions: [question("How many users?", "10k"), question("How fresh?", "Instantly")],
    requirements: [
      { kind: "functional", text: "Check items off" },
      { kind: "nonFunctional", text: "p95 under 200ms", category: "latency" },
    ],
    assumptions: [{ kind: "nonFunctional", text: "Online only" }],
    outOfScope: ["Recipes"],
    summary: "Summary",
    ranFrom: { requirements: "abc" },
  });
}

function outputsOf(b: DesignBrief) {
  const { inputs: _inputs, ...rest } = b;
  return rest;
}

describe("createBrief", () => {
  it("builds inputs with ids and empty stage outputs", () => {
    expect(
      createBrief(
        "A notes app",
        "backend",
        [{ kind: "functional", text: "Sync" }],
        ["Billing", "Chat"],
        ids(),
      ),
    ).toEqual({
      inputs: {
        prompt: "A notes app",
        scope: "backend",
        requirements: [{ id: "id-1", kind: "functional", text: "Sync" }],
        outOfScope: [
          { id: "id-2", text: "Billing" },
          { id: "id-3", text: "Chat" },
        ],
        answers: [],
      },
      questions: [],
      requirements: [],
      assumptions: [],
      outOfScope: [],
      ranFrom: {},
    });
  });
});

describe("requirement lines", () => {
  it("adds a line with its kind", () => {
    const base = withOutputs();
    const next = addRequirementLine(base, "nonFunctional", "99.9% uptime", ids());
    expect(next.inputs.requirements).toEqual([
      ...base.inputs.requirements,
      { id: "id-1", kind: "nonFunctional", text: "99.9% uptime" },
    ]);
    expect(outputsOf(next)).toEqual(outputsOf(base));
  });

  it("edits only the text of the matching line", () => {
    const base = withOutputs();
    const next = editRequirementLine(base, "r-2", "Use MySQL");
    expect(next.inputs.requirements).toEqual([
      { id: "r-1", kind: "functional", text: "Members share lists" },
      { id: "r-2", kind: "constraint", text: "Use MySQL" },
    ]);
    expect(outputsOf(next)).toEqual(outputsOf(base));
  });

  it("removes the matching line", () => {
    const base = withOutputs();
    const next = removeRequirementLine(base, "r-1");
    expect(next.inputs.requirements).toEqual([
      { id: "r-2", kind: "constraint", text: "Use Postgres" },
    ]);
    expect(outputsOf(next)).toEqual(outputsOf(base));
  });
});

describe("out-of-scope lines", () => {
  it("adds a line", () => {
    const base = withOutputs();
    const next = addOutOfScopeLine(base, "Chat", ids());
    expect(next.inputs.outOfScope).toEqual([
      { id: "o-1", text: "Billing" },
      { id: "id-1", text: "Chat" },
    ]);
    expect(outputsOf(next)).toEqual(outputsOf(base));
  });

  it("edits the matching line", () => {
    const base = withOutputs();
    const next = editOutOfScopeLine(base, "o-1", "Payments");
    expect(next.inputs.outOfScope).toEqual([{ id: "o-1", text: "Payments" }]);
    expect(outputsOf(next)).toEqual(outputsOf(base));
  });

  it("removes the matching line", () => {
    const base = withOutputs();
    const next = removeOutOfScopeLine(base, "o-1");
    expect(next.inputs.outOfScope).toEqual([]);
    expect(outputsOf(next)).toEqual(outputsOf(base));
  });
});

describe("answerQuestion", () => {
  it("adds an answer that is not assumed", () => {
    const base = withOutputs();
    const next = answerQuestion(base, "How many users?", "10k", ids());
    expect(next.inputs.answers).toEqual([
      { id: "id-1", question: "How many users?", answer: "10k", assumed: false },
    ]);
    expect(outputsOf(next)).toEqual(outputsOf(base));
  });

  it("replaces an existing answer to the same question, keeping its id", () => {
    const base = brief();
    base.inputs.answers = [
      { id: "a-9", question: "How fresh?", answer: "Instantly", assumed: true },
      answered,
    ];
    const next = answerQuestion(base, "How fresh?", "Within a minute", ids());
    expect(next.inputs.answers).toEqual([
      { id: "a-9", question: "How fresh?", answer: "Within a minute", assumed: false },
      answered,
    ]);
  });
});

describe("assumeRemaining", () => {
  it("answers only unanswered questions with their recommended answer", () => {
    const base = withOutputs();
    base.inputs.answers = [answered];
    const next = assumeRemaining(base, ids());
    expect(next.inputs.answers).toEqual([
      answered,
      { id: "id-1", question: "How fresh?", answer: "Instantly", assumed: true },
    ]);
    expect(outputsOf(next)).toEqual(outputsOf(base));
  });

  it("changes nothing when every question is answered", () => {
    const base = withOutputs();
    base.inputs.answers = [
      answered,
      { id: "a-2", question: "How fresh?", answer: "Hourly", assumed: false },
    ];
    expect(assumeRemaining(base, ids())).toEqual(base);
  });
});

describe("derived items", () => {
  it("confirmAssumption adds its text as a requirement line of its kind", () => {
    const base = withOutputs();
    const next = confirmAssumption(base, 0, ids());
    expect(next.inputs.requirements).toEqual([
      ...base.inputs.requirements,
      { id: "id-1", kind: "nonFunctional", text: "Online only" },
    ]);
    expect(outputsOf(next)).toEqual(outputsOf(base));
  });

  it("changeAssumption adds the edited text as a requirement line of its kind", () => {
    const base = withOutputs();
    const next = changeAssumption(base, 0, "Offline first", ids());
    expect(next.inputs.requirements).toEqual([
      ...base.inputs.requirements,
      { id: "id-1", kind: "nonFunctional", text: "Offline first" },
    ]);
    expect(outputsOf(next)).toEqual(outputsOf(base));
  });

  it("removeDerivedRequirement adds its text as an out-of-scope line", () => {
    const base = withOutputs();
    const next = removeDerivedRequirement(base, 1, ids());
    expect(next.inputs.outOfScope).toEqual([
      { id: "o-1", text: "Billing" },
      { id: "id-1", text: "p95 under 200ms" },
    ]);
    expect(next.inputs.requirements).toEqual(base.inputs.requirements);
    expect(outputsOf(next)).toEqual(outputsOf(base));
  });

  it("bringIntoScope adds a derived out-of-scope item as a functional requirement line", () => {
    const base = withOutputs();
    const next = bringIntoScope(base, 0, ids());
    expect(next.inputs.requirements).toEqual([
      ...base.inputs.requirements,
      { id: "id-1", kind: "functional", text: "Recipes" },
    ]);
    expect(next.inputs.outOfScope).toEqual(base.inputs.outOfScope);
    expect(outputsOf(next)).toEqual(outputsOf(base));
  });

  it("requireCondition adds the condition as a functional requirement line", () => {
    const base = withOutputs();
    const next = requireCondition(base, "Traffic exceeds 1M users", ids());
    expect(next.inputs.requirements).toEqual([
      ...base.inputs.requirements,
      { id: "id-1", kind: "functional", text: "Traffic exceeds 1M users" },
    ]);
    expect(outputsOf(next)).toEqual(outputsOf(base));
  });

  it.each([
    ["confirmAssumption", (b: DesignBrief, i: number) => confirmAssumption(b, i, ids())],
    ["changeAssumption", (b: DesignBrief, i: number) => changeAssumption(b, i, "x", ids())],
    [
      "removeDerivedRequirement",
      (b: DesignBrief, i: number) => removeDerivedRequirement(b, i, ids()),
    ],
    ["bringIntoScope", (b: DesignBrief, i: number) => bringIntoScope(b, i, ids())],
  ])("%s returns the brief unchanged for an out-of-range index", (_name, act) => {
    const base = withOutputs();
    expect(act(base, 5)).toBe(base);
    expect(act(base, -1)).toBe(base);
  });
});

describe("buildDesignContext", () => {
  it("merges user lines, derived requirements and assumptions", () => {
    const base = withOutputs();
    expect(buildDesignContext(base)).toEqual({
      prompt: "A shared shopping list",
      scope: "fullstack",
      requirements: [
        { kind: "functional", text: "Members share lists", assumed: false },
        { kind: "constraint", text: "Use Postgres", assumed: false },
        { kind: "functional", text: "Check items off", assumed: false },
        { kind: "nonFunctional", text: "p95 under 200ms", assumed: false, category: "latency" },
        { kind: "nonFunctional", text: "Online only", assumed: true },
      ],
      outOfScope: ["Billing", "Recipes"],
    });
  });

  it("does not duplicate answers into the context", () => {
    const base = withOutputs();
    base.inputs.answers = [
      answered,
      { id: "a-2", question: "How fresh?", answer: "Instantly", assumed: true },
    ];
    const context = buildDesignContext(base);
    expect(context.requirements).toEqual(buildDesignContext(withOutputs()).requirements);
    expect(JSON.stringify(context)).not.toContain("10k");
  });

  it("omits category when a derived requirement has none", () => {
    const [, , derived] = buildDesignContext(withOutputs()).requirements;
    expect(derived).not.toHaveProperty("category");
  });
});

describe("requirementsInput", () => {
  it("projects the inputs without ids", () => {
    const base = withOutputs();
    base.inputs.answers = [
      { id: "a-2", question: "How fresh?", answer: "Instantly", assumed: true },
    ];
    expect(requirementsInput(base)).toEqual({
      prompt: "A shared shopping list",
      scope: "fullstack",
      requirements: [
        { kind: "functional", text: "Members share lists" },
        { kind: "constraint", text: "Use Postgres" },
      ],
      outOfScope: ["Billing"],
      answers: [{ question: "How fresh?", answer: "Instantly", assumed: true }],
    });
  });
});

describe("normalizeText", () => {
  it("trims surrounding whitespace and lower-cases", () =>
    expect(normalizeText("  Sync ACROSS Devices\n\t")).toBe("sync across devices"));

  it("keeps inner whitespace as written", () =>
    expect(normalizeText(" Admin  UI\twith Tabs ")).toBe("admin  ui\twith tabs"));

  it("returns an empty string for whitespace-only text", () =>
    expect(normalizeText(" \n\t ")).toBe(""));
});

// --- Inputs of the stages after stage 2 ---

function node(id: string, type: string, data: Record<string, unknown>): Node {
  return { id, type, position: { x: 0, y: 0 }, data };
}

function edge(source: string, target: string, data?: Record<string, unknown>): Edge {
  return { id: `${source}-${target}`, source, target, ...(data ? { data } : {}) };
}

const api = node("api", "architecture", { type: "service", label: "API", description: "Serves" });
const db = node("db", "architecture", { type: "database", label: "Orders DB" });
const web = node("web", "architecture", { type: "webapp", label: "Web" });
const vpc = node("vpc", "group", { groupType: "vpc", label: "VPC" });
const note = node("note", "comment", { label: "Remember backups" });

const shopContext: DesignContext = {
  prompt: "Shop",
  scope: "backend",
  requirements: [],
  outOfScope: [],
};

const design = (nodes: Node[], edges: Edge[]): StageDesign => ({
  context: shopContext,
  summary: "A shop",
  nodes,
  edges,
});

describe("nodeIdentity", () => {
  it("reads the label and the type of an architecture node", () =>
    expect(nodeIdentity(api)).toEqual({ kind: "architecture", label: "API", type: "service" }));

  it("reads a group's type from groupType", () =>
    expect(nodeIdentity(vpc)).toEqual({ kind: "group", label: "VPC", type: "vpc" }));

  it("leaves out a type the catalog does not have", () => {
    expect(nodeIdentity(node("x", "architecture", { type: "mainframe", label: "X" })).type).toBe(
      undefined,
    );
    expect(nodeIdentity(node("g", "group", { groupType: "service", label: "G" })).type).toBe(
      undefined,
    );
  });

  it("gives other nodes no type", () =>
    expect(nodeIdentity(note)).toEqual({
      kind: "other",
      label: "Remember backups",
      type: undefined,
    }));

  it("falls back to the id when the label is not a string", () =>
    expect(nodeIdentity(node("cache", "architecture", { type: "cache" })).label).toBe("cache"));

  it("keeps an empty label", () =>
    expect(nodeIdentity(node("cache", "architecture", { type: "cache", label: "" })).label).toBe(
      "",
    ));
});

describe("graphSummary", () => {
  it("keeps architecture nodes with a valid type and skips the rest", () => {
    const invalid = node("bad", "architecture", { type: "mainframe", label: "Bad" });
    expect(graphSummary([vpc, api, invalid, note, db], []).nodes).toEqual([
      { key: "api", type: "service", label: "API" },
      { key: "db", type: "database", label: "Orders DB" },
    ]);
  });

  it("drops edges without a valid protocol and reads async", () => {
    const edges = [
      edge("api", "db", { protocol: "sql" }),
      edge("web", "api"),
      edge("api", "web", { protocol: "carrier-pigeon" }),
      edge("api", "web", { protocol: "kafka", async: true }),
    ];
    expect(graphSummary([], edges).edges).toEqual([
      { from: "api", to: "db", protocol: "sql", async: false },
      { from: "api", to: "web", protocol: "kafka", async: true },
    ]);
  });

  it("labels an unnamed node with its id", () =>
    expect(graphSummary([node("q", "architecture", { type: "queue" })], []).nodes).toEqual([
      { key: "q", type: "queue", label: "q" },
    ]));
});

describe("decisionInput", () => {
  it("lists neighbours with the direction of each edge", () => {
    const input = decisionInput(
      design(
        [web, api, db],
        [edge("web", "api", { protocol: "http" }), edge("api", "db", { protocol: "sql" })],
      ),
      api,
    );
    expect(input).toEqual({
      context: shopContext,
      summary: "A shop",
      node: { key: "api", type: "service", label: "API", responsibility: "Serves" },
      neighbours: [
        { key: "web", type: "webapp", label: "Web", protocol: "http", direction: "in" },
        { key: "db", type: "database", label: "Orders DB", protocol: "sql", direction: "out" },
      ],
    });
  });

  it("drops neighbours whose edge has no protocol or whose node is missing", () => {
    const edges = [edge("web", "api"), edge("api", "gone", { protocol: "http" })];
    expect(decisionInput(design([web, api], edges), api)?.neighbours).toEqual([]);
  });

  it("falls back to the raw node type and the id for a neighbour outside the catalog", () => {
    const other = node("ext", "architecture", { type: "mainframe" });
    const input = decisionInput(
      design([api, other], [edge("api", "ext", { protocol: "tcp" })]),
      api,
    );
    expect(input?.neighbours).toEqual([
      { key: "ext", type: "architecture", label: "ext", protocol: "tcp", direction: "out" },
    ]);
  });

  it("builds an input for a group and leaves out an empty responsibility", () => {
    const group = node("vpc", "group", { groupType: "vpc", description: "" });
    expect(decisionInput(design([group], []), group)?.node).toEqual({
      key: "vpc",
      type: "vpc",
      label: "vpc",
    });
  });

  it("skips nodes without a valid catalog type", () => {
    const invalid = node("bad", "architecture", { type: "mainframe", label: "Bad" });
    expect(decisionInput(design([invalid, note], []), invalid)).toBe(undefined);
    expect(decisionInput(design([invalid, note], []), note)).toBe(undefined);
  });
});
