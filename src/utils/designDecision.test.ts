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

describe("designDecisionSchema", () => {
  it.each(["alternatives", "tradeoffs", "assumptions"])(
    "rejects the retired %s paragraph field",
    (field) => {
      expect(designDecisionSchema.safeParse({ choice: "Redis", [field]: "text" }).success).toBe(
        false,
      );
    },
  );
});

describe("toDesignDecision", () => {
  it("omits empty fields when writing", () => {
    const written = toDesignDecision(
      getDesignDecision({ choice: "Redis", reason: "", drawbacks: ["Stale"], benefits: [] }),
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

  it("ignores rows with labels it does not know, including retired paragraph labels", () => {
    expect(
      parseDecisionRows([
        ["Why", "Reduce load"],
        ["Rationale", "ignored"],
        ["Tradeoffs", "ignored"],
        ["Unknown", "ignored"],
      ]),
    ).toEqual({ reason: "Reduce load" });
  });
});
