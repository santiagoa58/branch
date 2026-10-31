import { describe, expect, it } from "vite-plus/test";
import { designDecisionSchema } from "@/schemas/diagram";
import type { DesignDecision } from "@/types";
import {
  getDecisionRows,
  getDesignDecision,
  getDocumentedDecision,
  hasDesignDecision,
  parseDecisionRows,
  toDesignDecision,
} from "./designDecision";

const structured: DesignDecision = {
  choice: "Redis cache-aside",
  reason: "Most reads repeat within a minute.",
  benefits: ["Fewer database reads"],
  drawbacks: ["Stale reads"],
  considered: [{ option: "Read replicas", whyNot: "More to operate" }, { option: "No cache" }],
  revisitWhen: ["Reads must always be current"],
};

describe("getDesignDecision", () => {
  it("appends legacy paragraphs after structured items in the matching section", () => {
    const view = getDesignDecision({
      ...structured,
      tradeoffs: " Legacy tradeoff ",
      alternatives: "Legacy alternative",
      assumptions: "Legacy assumption",
    });
    expect(view.drawbacks).toEqual(["Stale reads", "Legacy tradeoff"]);
    expect(view.considered.at(-1)).toEqual({ option: "Legacy alternative" });
    expect(view.revisitWhen).toEqual(["Reads must always be current", "Legacy assumption"]);
  });

  it("returns copies so editing the view never mutates the stored decision", () => {
    const stored = structuredClone(structured);
    const view = getDesignDecision(stored);
    view.benefits.push("x");
    const first = view.considered[0];
    if (first) {
      first.option = "changed";
    }
    expect(stored).toEqual(structured);
  });

  it("keeps blank draft rows so the editor can show a newly added item", () => {
    expect(getDesignDecision({ benefits: ["", "Fast"] }).benefits).toEqual(["", "Fast"]);
  });
});

describe("toDesignDecision", () => {
  it("writes only the structured shape, omitting empty fields", () => {
    const written = toDesignDecision(
      getDesignDecision({ choice: "Redis", tradeoffs: "Stale", assumptions: "" }),
    );
    expect(written).toEqual({ choice: "Redis", drawbacks: ["Stale"] });
    expect(designDecisionSchema.parse(written)).toEqual(written);
  });

  it("round-trips a structured decision unchanged", () => {
    expect(toDesignDecision(getDesignDecision(structured))).toEqual(structured);
  });
});

describe("getDocumentedDecision and hasDesignDecision", () => {
  it("trims text and drops blank items and empty considered rows", () => {
    expect(
      getDocumentedDecision({
        choice: " Redis ",
        benefits: [" ", "Fast "],
        considered: [
          { option: " ", whyNot: " " },
          { option: "", whyNot: "Too slow" },
        ],
      }),
    ).toEqual({
      choice: "Redis",
      reason: "",
      benefits: ["Fast"],
      drawbacks: [],
      considered: [{ option: "", whyNot: "Too slow" }],
      revisitWhen: [],
    });
  });

  it("drops repeated entries so each displayed item is unique", () => {
    const documented = getDocumentedDecision({
      benefits: ["Fast", " Fast ", "Cheap"],
      considered: [
        { option: "Replicas", whyNot: "Cost" },
        { option: "Replicas ", whyNot: "Cost" },
      ],
    });
    expect(documented.benefits).toEqual(["Fast", "Cheap"]);
    expect(documented.considered).toEqual([{ option: "Replicas", whyNot: "Cost" }]);
  });

  it.each<[DesignDecision | undefined, boolean]>([
    [undefined, false],
    [{}, false],
    [{ choice: " ", benefits: [""], considered: [{ option: "  " }] }, false],
    [{ revisitWhen: ["Traffic doubles"] }, true],
    [{ tradeoffs: "Legacy only" }, true],
  ])("detects documented content in %j", (decision, expected) => {
    expect(hasDesignDecision(decision)).toBe(expected);
  });
});

describe("decision rows", () => {
  it("emits one labeled row per item", () => {
    expect(getDecisionRows(structured)).toEqual([
      ["Choice", "Redis cache-aside"],
      ["Why", "Most reads repeat within a minute."],
      ["Benefit", "Fewer database reads"],
      ["Drawback", "Stale reads"],
      ["Considered", "Read replicas — More to operate"],
      ["Considered", "No cache"],
      ["Revisit when", "Reads must always be current"],
    ]);
  });

  it("parses its own rows back into the same decision", () => {
    expect(parseDecisionRows(getDecisionRows(structured))).toEqual(structured);
  });

  it("reads legacy row labels into the structured sections", () => {
    expect(
      parseDecisionRows([
        ["Rationale", "Reduce load"],
        ["Tradeoffs", "Stale reads"],
        ["Alternatives", "Replicas — cost more"],
        ["Assumptions", "Reads tolerate lag"],
        ["Unknown", "ignored"],
      ]),
    ).toEqual({
      reason: "Reduce load",
      drawbacks: ["Stale reads"],
      considered: [{ option: "Replicas", whyNot: "cost more" }],
      revisitWhen: ["Reads tolerate lag"],
    });
  });
});
