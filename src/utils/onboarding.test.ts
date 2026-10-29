import { describe, it, expect } from "vite-plus/test";
import {
  evaluateCompletedSteps,
  isAllComplete,
  completedCount,
  emptyCompletedSteps,
  getActiveStep,
  ONBOARDING_STEP_IDS,
  type OnboardingStepId,
} from "@/utils/onboarding";
import type { Node, Edge } from "@xyflow/react";

const archNode = (id: string): Node => ({
  id,
  type: "architecture",
  position: { x: 0, y: 0 },
  data: { label: id, type: "service" },
});
const groupNode = (id: string): Node => ({
  id,
  type: "group",
  position: { x: 0, y: 0 },
  data: { label: id, groupType: "vpc" },
});
const commentNode = (id: string): Node => ({
  id,
  type: "comment",
  position: { x: 0, y: 0 },
  data: { text: "note" },
});
const edge = (id: string, data: Record<string, unknown> = {}): Edge => ({
  id,
  source: "a",
  target: "b",
  data,
});

const idle = { mode: "idle", flowPath: null };

describe("evaluateCompletedSteps", () => {
  it("returns nothing for an empty diagram", () => {
    expect(evaluateCompletedSteps([], [], idle)).toEqual([]);
  });

  it("add-node requires a real architecture node, not a group or comment", () => {
    expect(evaluateCompletedSteps([groupNode("g")], [], idle)).not.toContain("add-node");
    expect(evaluateCompletedSteps([commentNode("c")], [], idle)).not.toContain("add-node");
    expect(evaluateCompletedSteps([archNode("n1")], [], idle)).toContain("add-node");
  });

  it("connect-nodes requires at least one edge", () => {
    expect(evaluateCompletedSteps([archNode("a"), archNode("b")], [], idle)).not.toContain(
      "connect-nodes",
    );
    expect(evaluateCompletedSteps([archNode("a"), archNode("b")], [edge("e1")], idle)).toContain(
      "connect-nodes",
    );
  });

  it("set-contract requires an edge with a dataContract", () => {
    expect(evaluateCompletedSteps([], [edge("e1")], idle)).not.toContain("set-contract");
    const withContract = edge("e2", { dataContract: { format: "json", schemaName: "User" } });
    expect(evaluateCompletedSteps([], [withContract], idle)).toContain("set-contract");
  });

  it("run-flow-sim latches only when mode is flow AND a flowPath exists", () => {
    expect(evaluateCompletedSteps([], [], { mode: "flow", flowPath: null })).not.toContain(
      "run-flow-sim",
    );
    expect(
      evaluateCompletedSteps([], [], { mode: "failure", flowPath: { nodeIds: [] } }),
    ).not.toContain("run-flow-sim");
    expect(
      evaluateCompletedSteps([], [], { mode: "flow", flowPath: { nodeIds: ["a"] } }),
    ).toContain("run-flow-sim");
  });

  it("can report several satisfied steps at once", () => {
    const nodes = [archNode("a"), archNode("b")];
    const edges = [edge("e1", { dataContract: { format: "json" } })];
    const result = evaluateCompletedSteps(nodes, edges, {
      mode: "flow",
      flowPath: { nodeIds: ["a"] },
    });
    expect(result.sort()).toEqual(
      ["add-node", "connect-nodes", "run-flow-sim", "set-contract"].sort(),
    );
  });
});

describe("completion helpers", () => {
  it("emptyCompletedSteps has every id set to false", () => {
    const empty = emptyCompletedSteps();
    expect(Object.keys(empty).sort()).toEqual([...ONBOARDING_STEP_IDS].sort());
    expect(Object.values(empty).every((v) => !v)).toBe(true);
  });

  it("isAllComplete / completedCount reflect the record", () => {
    const empty = emptyCompletedSteps();
    expect(isAllComplete(empty)).toBe(false);
    expect(completedCount(empty)).toBe(0);

    const partial: Record<OnboardingStepId, boolean> = { ...empty, "add-node": true };
    expect(completedCount(partial)).toBe(1);
    expect(isAllComplete(partial)).toBe(false);

    const all = ONBOARDING_STEP_IDS.reduce(
      (acc, id) => ({ ...acc, [id]: true }),
      {} as Record<OnboardingStepId, boolean>,
    );
    expect(isAllComplete(all)).toBe(true);
    expect(completedCount(all)).toBe(ONBOARDING_STEP_IDS.length);
  });

  it("getActiveStep returns the first incomplete step, or null when all done", () => {
    expect(getActiveStep(emptyCompletedSteps())).toBe("add-node");

    const partial: Record<OnboardingStepId, boolean> = {
      ...emptyCompletedSteps(),
      "add-node": true,
    };
    expect(getActiveStep(partial)).toBe("connect-nodes");

    const all = ONBOARDING_STEP_IDS.reduce(
      (acc, id) => ({ ...acc, [id]: true }),
      {} as Record<OnboardingStepId, boolean>,
    );
    expect(getActiveStep(all)).toBeNull();
  });
});
