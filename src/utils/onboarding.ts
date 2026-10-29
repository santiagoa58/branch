/**
 * Onboarding step definitions and the pure logic that decides which steps a
 * diagram currently satisfies.
 *
 * `evaluateCompletedSteps` is side-effect free and unit-tested. It reports which
 * conditions are *currently* true; the one-way "latch" (a step stays done even
 * after the user deletes everything) lives in `onboardingStore`, not here.
 */
import type { Node, Edge } from "@xyflow/react";

export type OnboardingStepId = "add-node" | "connect-nodes" | "set-contract" | "run-flow-sim";

export interface OnboardingStep {
  id: OnboardingStepId;
  label: string;
  /** One-liner used by the optional interactive-step enhancement (not in v1). */
  hint: string;
}

/** Display order of the checklist. */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "add-node",
    label: "Add your first component",
    hint: "Drag a node from the left palette onto the canvas.",
  },
  {
    id: "connect-nodes",
    label: "Connect two nodes",
    hint: "Drag from a node’s edge dot (the pulsing handles) to another node.",
  },
  {
    id: "set-contract",
    label: "Set a data contract on an edge",
    hint: "Select an edge and define its data contract in the Properties panel.",
  },
  {
    id: "run-flow-sim",
    label: "Run a flow simulation",
    hint: "Open Simulate, pick a source node, and press play.",
  },
];

export const ONBOARDING_STEP_IDS: OnboardingStepId[] = ONBOARDING_STEPS.map((s) => s.id);

/** Minimal slice of simulation state needed to detect a flow run. */
export interface OnboardingSimState {
  mode: string;
  flowPath: unknown;
}

/**
 * Which onboarding steps are satisfied by the given diagram + simulation state,
 * right now. Pure — no latching, no store access.
 */
export function evaluateCompletedSteps(
  nodes: Node[],
  edges: Edge[],
  sim: OnboardingSimState,
): OnboardingStepId[] {
  const done: OnboardingStepId[] = [];

  // A "real" component is an architecture node — not a group container or a comment sticky.
  if (nodes.some((n) => n.type === "architecture")) {
    done.push("add-node");
  }

  if (edges.length >= 1) {
    done.push("connect-nodes");
  }

  if (
    edges.some((e) => e.data?.["dataContract"] !== null && e.data?.["dataContract"] !== undefined)
  ) {
    done.push("set-contract");
  }

  if (sim.mode === "flow" && sim.flowPath !== null && sim.flowPath !== undefined) {
    done.push("run-flow-sim");
  }

  return done;
}

/** A fresh "nothing done yet" record. */
export function emptyCompletedSteps(): Record<OnboardingStepId, boolean> {
  return ONBOARDING_STEP_IDS.reduce(
    (acc, id) => {
      acc[id] = false;
      return acc;
    },
    {} as Record<OnboardingStepId, boolean>,
  );
}

/** True when every step is marked complete. */
export function isAllComplete(completed: Record<OnboardingStepId, boolean>): boolean {
  return ONBOARDING_STEP_IDS.every((id) => completed[id]);
}

/** Count of completed steps. */
export function completedCount(completed: Record<OnboardingStepId, boolean>): number {
  return ONBOARDING_STEP_IDS.filter((id) => completed[id]).length;
}

/** The next step to guide the user toward — the first incomplete one, or null if done. */
export function getActiveStep(
  completed: Record<OnboardingStepId, boolean>,
): OnboardingStepId | null {
  return ONBOARDING_STEP_IDS.find((id) => !completed[id]) ?? null;
}
