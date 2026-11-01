import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vite-plus/test";
import type { DesignBrief } from "@/schemas/aiDesign";
import {
  graphFingerprint,
  inputsFingerprint,
  nextStages,
  outdatedStages,
  resultFingerprint,
} from "./fingerprint";

type Inputs = DesignBrief["inputs"];

const r = (
  id: string,
  text: string,
  kind: Inputs["requirements"][number]["kind"] = "functional",
) => ({
  id,
  kind,
  text,
});

function inputs(overrides: Partial<Inputs> = {}): Inputs {
  return {
    prompt: "A notes app",
    scope: "fullstack",
    requirements: [r("a", "Offline"), r("b", "Sync")],
    outOfScope: [{ id: "o1", text: "Billing" }],
    answers: [],
    ...overrides,
  };
}

function withAnswer(answer: string): Inputs {
  return inputs({
    answers: [{ id: "q1", question: "How many users?", answer, assumed: false }],
  });
}

function brief(overrides: Partial<DesignBrief> = {}): DesignBrief {
  return {
    inputs: inputs(),
    questions: [],
    requirements: [],
    assumptions: [],
    outOfScope: [],
    ranFrom: {},
    ...overrides,
  };
}

const question = (): DesignBrief["questions"][number] => ({
  id: "q1",
  topic: "Scale",
  question: "How many users?",
  why: "Sizing",
  options: [{ label: "1M", impact: "Single region" }],
  recommended: "1M",
  allowsCustom: false,
});

const arch = (id: string, type: string, extra: Partial<Node> = {}): Node => ({
  id,
  type: "architecture",
  position: { x: 0, y: 0 },
  data: { type, label: id },
  ...extra,
});
const group = (id: string, groupType: string): Node => ({
  id,
  type: "group",
  position: { x: 0, y: 0 },
  data: { groupType, label: id },
});
const edge = (id: string, source: string, target: string, data?: Edge["data"]): Edge => ({
  id,
  source,
  target,
  ...(data ? { data } : {}),
});

const nodes: Node[] = [
  group("g1", "vpc"),
  arch("api", "api-gateway", { parentId: "g1" }),
  arch("db", "postgresql"),
];
const edges: Edge[] = [edge("e1", "api", "db", { protocol: "TCP", async: false })];

/** Every stage recorded against the current inputs and graph. */
function allFresh(b: DesignBrief = brief()): DesignBrief {
  const input = inputsFingerprint(b.inputs);
  const result = resultFingerprint(b, nodes, edges);
  return {
    ...b,
    ranFrom: { requirements: input, components: input, decisions: result, api: result },
  };
}

describe("inputsFingerprint", () => {
  it("ignores casing, whitespace, ids and order of requirement lines", () =>
    expect(inputsFingerprint(inputs({ requirements: [r("a", "Offline"), r("b", "Sync")] }))).toBe(
      inputsFingerprint(inputs({ requirements: [r("z", " sync "), r("y", "offline")] })),
    ));

  it("changes when an answer changes", () =>
    expect(inputsFingerprint(withAnswer("1M"))).not.toBe(inputsFingerprint(withAnswer("10M"))));

  it("changes when the assumed flag, prompt, scope, kind or out-of-scope lines change", () => {
    const base = inputsFingerprint(withAnswer("1M"));
    const [answer] = withAnswer("1M").answers;
    expect(inputsFingerprint(inputs({ answers: [{ ...answer!, assumed: true }] }))).not.toBe(base);
    expect(inputsFingerprint(inputs({ prompt: "Other" }))).not.toBe(inputsFingerprint(inputs()));
    expect(inputsFingerprint(inputs({ scope: "backend" }))).not.toBe(inputsFingerprint(inputs()));
    expect(
      inputsFingerprint(
        inputs({ requirements: [r("a", "Offline", "constraint"), r("b", "Sync")] }),
      ),
    ).not.toBe(inputsFingerprint(inputs()));
    expect(inputsFingerprint(inputs({ outOfScope: [] }))).not.toBe(inputsFingerprint(inputs()));
  });

  it("reverting an edit restores the fingerprint", () => {
    const original = inputsFingerprint(inputs());
    const edited = inputsFingerprint(
      inputs({ requirements: [r("a", "Offline mode"), r("b", "Sync")] }),
    );
    expect(edited).not.toBe(original);
    expect(inputsFingerprint(inputs({ requirements: [r("a", "Offline"), r("b", "Sync")] }))).toBe(
      original,
    );
  });

  it("returns a hex string", () => expect(inputsFingerprint(inputs())).toMatch(/^[0-9a-f]+$/));
});

describe("graphFingerprint", () => {
  it("ignores labels, descriptions, decisions, positions and comments", () => {
    const base = graphFingerprint(nodes, edges);
    const changed: Node[] = [
      { ...group("g1", "vpc"), data: { groupType: "vpc", label: "Renamed" } },
      arch("api", "api-gateway", {
        parentId: "g1",
        position: { x: 500, y: 90 },
        data: {
          type: "api-gateway",
          label: "Edge",
          description: "New text",
          decision: { choice: "Kong" },
        },
      }),
      arch("db", "postgresql"),
      { id: "c1", type: "comment", position: { x: 1, y: 1 }, data: { text: "hi" } },
    ];
    const changedEdges = [
      { ...edge("renamed", "api", "db", { protocol: "TCP", async: false }), label: "reads" },
    ];
    expect(graphFingerprint(changed, changedEdges)).toBe(base);
  });

  it("ignores node and edge order", () =>
    expect(graphFingerprint([...nodes].reverse(), edges)).toBe(graphFingerprint(nodes, edges)));

  it("changes when a protocol changes", () =>
    expect(
      graphFingerprint(nodes, [edge("e1", "api", "db", { protocol: "gRPC", async: false })]),
    ).not.toBe(graphFingerprint(nodes, edges)));

  it("changes when async, a node type, a parent or an edge changes", () => {
    const base = graphFingerprint(nodes, edges);
    expect(
      graphFingerprint(nodes, [edge("e1", "api", "db", { protocol: "TCP", async: true })]),
    ).not.toBe(base);
    expect(
      graphFingerprint([group("g1", "vpc"), arch("api", "redis"), arch("db", "postgresql")], edges),
    ).not.toBe(base);
    expect(
      graphFingerprint(
        [group("g1", "vpc"), arch("api", "api-gateway"), arch("db", "postgresql")],
        edges,
      ),
    ).not.toBe(base);
    expect(graphFingerprint(nodes, [...edges, edge("e2", "db", "api")])).not.toBe(base);
  });

  it("treats missing protocol and async as empty and false", () =>
    expect(graphFingerprint(nodes, [edge("e1", "api", "db")])).toBe(
      graphFingerprint(nodes, [edge("e1", "api", "db", { protocol: "", async: false })]),
    ));
});

describe("nextStages", () => {
  const all = ["requirements", "components", "decisions", "api"];

  it("new brief: every stage is next", () => expect(nextStages(brief(), [], [])).toEqual(all));

  it("open questions stop the pipeline after requirements", () => {
    const input = inputsFingerprint(inputs());
    const waiting = brief({
      questions: [question()],
      ranFrom: { requirements: input },
    });
    expect(nextStages(waiting, nodes, edges)).toEqual([]);
  });

  it("outdated requirements win over open questions", () => {
    const waiting = brief({
      questions: [question()],
      ranFrom: { requirements: "stale" },
    });
    expect(nextStages(waiting, nodes, edges)).toEqual(all);
  });

  it("a fully fresh brief has nothing to do", () =>
    expect(nextStages(allFresh(), nodes, edges)).toEqual([]));

  it("a hand edit to the graph re-runs decisions and api only", () =>
    expect(nextStages(allFresh(), nodes, [...edges, edge("e2", "db", "api")])).toEqual([
      "decisions",
      "api",
    ]));

  it("only api outdated returns just api", () =>
    expect(
      nextStages({ ...allFresh(), ranFrom: { ...allFresh().ranFrom, api: "stale" } }, nodes, edges),
    ).toEqual(["api"]));

  it("an input edit re-runs everything", () => {
    const fresh = allFresh();
    const edited = {
      ...fresh,
      inputs: inputs({ requirements: [r("a", "Offline"), r("b", "Sync"), r("c", "Search")] }),
    };
    expect(nextStages(edited, nodes, edges)).toEqual(all);
  });

  it("a stage with no record is outdated", () => {
    const fresh = allFresh();
    const { components: _components, ...ranFrom } = fresh.ranFrom;
    expect(nextStages({ ...fresh, ranFrom }, nodes, edges)).toEqual([
      "components",
      "decisions",
      "api",
    ]);
  });

  it("data model is outdated but never in nextStages", () => {
    const withModel: DesignBrief = {
      ...allFresh(),
      dataModel: { entities: [] },
      ranFrom: { ...allFresh().ranFrom, dataModel: "stale" },
    };
    expect(outdatedStages(withModel, nodes, edges)).toEqual({ stages: [], dataModel: true });
    expect(nextStages(withModel, nodes, edges)).toEqual([]);
  });
});

describe("outdatedStages", () => {
  it("lists each outdated stage individually without expansion", () => {
    const fresh = allFresh();
    const brokenComponents = { ...fresh, ranFrom: { ...fresh.ranFrom, components: "stale" } };
    expect(outdatedStages(brokenComponents, nodes, edges).stages).toEqual(["components"]);
  });

  it("reports the data model as not outdated before one is generated", () =>
    expect(outdatedStages(allFresh(), nodes, edges).dataModel).toBe(false));

  it("reports a fresh data model as not outdated and a graph edit as outdated", () => {
    const base = allFresh();
    const withModel: DesignBrief = {
      ...base,
      dataModel: { entities: [] },
      ranFrom: { ...base.ranFrom, dataModel: resultFingerprint(base, nodes, edges) },
    };
    expect(outdatedStages(withModel, nodes, edges).dataModel).toBe(false);
    expect(outdatedStages(withModel, nodes, [...edges, edge("e2", "db", "api")]).dataModel).toBe(
      true,
    );
  });

  it("a new brief has all four pipeline stages outdated", () =>
    expect(outdatedStages(brief(), [], []).stages).toEqual([
      "requirements",
      "components",
      "decisions",
      "api",
    ]));
});

describe("resultFingerprint", () => {
  it("is the inputs and graph fingerprints joined by a colon", () =>
    expect(resultFingerprint(brief(), nodes, edges)).toBe(
      `${inputsFingerprint(inputs())}:${graphFingerprint(nodes, edges)}`,
    ));
});

// Saved diagrams store these strings in `brief.ranFrom`. A change here marks every saved stage as
// outdated, so these values must never change.
describe("golden fingerprints", () => {
  const goldenInputs: Inputs = {
    prompt: "  A Notes App\twith  Sync  ",
    scope: "fullstack",
    requirements: [
      r("b", "  Sync ACROSS Devices "),
      r("a", "Works OFFLINE\n", "nonFunctional"),
      r("c", " Postgres only", "constraint"),
    ],
    outOfScope: [
      { id: "o2", text: "  Billing " },
      { id: "o1", text: "Admin  UI" },
    ],
    answers: [
      { id: "q2", question: " Which REGION? ", answer: "EU  ", assumed: true },
      { id: "q1", question: "How many users?", answer: " 1M ", assumed: false },
    ],
  };
  const goldenNodes: Node[] = [
    { id: "vpc", type: "group", position: { x: 0, y: 0 }, data: { groupType: "vpc" } },
    {
      id: "api",
      type: "architecture",
      position: { x: 10, y: 10 },
      parentId: "vpc",
      data: { type: "api-gateway", label: "API" },
    },
    { id: "db", type: "architecture", position: { x: 50, y: 50 }, data: { type: "database" } },
    { id: "note", type: "text", position: { x: 0, y: 0 }, data: {} },
  ];
  const goldenEdges: Edge[] = [
    { id: "e2", source: "api", target: "db", data: { protocol: "tcp", async: false } },
    { id: "e1", source: "db", target: "api", data: { protocol: "kafka", async: true } },
    { id: "e3", source: "api", target: "db" },
  ];

  it("pins the inputs fingerprint", () =>
    expect(inputsFingerprint(goldenInputs)).toBe("e20bf09b96329"));

  it("pins the graph fingerprint", () =>
    expect(graphFingerprint(goldenNodes, goldenEdges)).toBe("1df01456eb3c3b"));
});
