import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { CloudState } from "@/services/cloudPersistence";
import { cloudWorkspace } from "@/services/cloudWorkspace";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useAnimationStore } from "@/store/animationStore";
import {
  editBlockReason,
  STORE_EDIT_CHECKS,
  useEditBlocked,
  VERSION_EDIT_CHECKS,
  type EditBlockReason,
} from "./editLock";

let cloud: CloudState;

function setConditions(locked: boolean, loading: boolean, aiRunning: boolean, deleting: boolean) {
  cloud = { ...cloud, locked, status: loading ? "loading" : "saved" };
  useAiDesignStore.setState({ running: aiRunning });
  useAnimationStore.setState({ pendingDeletions: new Set(deleting ? ["api"] : []) });
}

beforeEach(() => {
  cloud = {
    diagram: null,
    status: "saved",
    dirty: false,
    locked: false,
    transitioning: false,
    message: null,
  };
  vi.spyOn(cloudWorkspace, "getState").mockImplementation(() => cloud);
  useAiDesignStore.setState(useAiDesignStore.getInitialState());
  useAnimationStore.setState(useAnimationStore.getInitialState());
});

afterEach(() => {
  vi.restoreAllMocks();
  useAiDesignStore.setState(useAiDesignStore.getInitialState());
  useAnimationStore.setState(useAnimationStore.getInitialState());
});

type Reason = EditBlockReason | null;

// locked, loading, AI running, deletions pending → all checks, store checks, version checks.
const cases: [boolean, boolean, boolean, boolean, Reason, Reason, Reason][] = [
  [false, false, false, false, null, null, null],
  [false, false, false, true, "deletions-pending", null, "deletions-pending"],
  [false, false, true, false, "ai-running", "ai-running", "ai-running"],
  [false, false, true, true, "ai-running", "ai-running", "ai-running"],
  [false, true, false, false, "loading", null, null],
  [false, true, false, true, "loading", null, "deletions-pending"],
  [false, true, true, false, "loading", "ai-running", "ai-running"],
  [false, true, true, true, "loading", "ai-running", "ai-running"],
  [true, false, false, false, "locked", "locked", null],
  [true, false, false, true, "locked", "locked", "deletions-pending"],
  [true, false, true, false, "locked", "locked", "ai-running"],
  [true, false, true, true, "locked", "locked", "ai-running"],
  [true, true, false, false, "locked", "locked", null],
  [true, true, false, true, "locked", "locked", "deletions-pending"],
  [true, true, true, false, "locked", "locked", "ai-running"],
  [true, true, true, true, "locked", "locked", "ai-running"],
];

describe("editBlockReason", () => {
  it.each(cases)(
    "locked=%s loading=%s aiRunning=%s deleting=%s → %s (store %s, versions %s)",
    (locked, loading, aiRunning, deleting, all, store, versions) => {
      setConditions(locked, loading, aiRunning, deleting);
      expect(editBlockReason()).toBe(all);
      expect(editBlockReason(STORE_EDIT_CHECKS)).toBe(store);
      expect(editBlockReason(VERSION_EDIT_CHECKS)).toBe(versions);
    },
  );

  it("does not treat other cloud statuses as loading", () => {
    const statuses = [
      "idle",
      "load-error",
      "saved",
      "pending",
      "saving",
      "error",
      "conflict",
      "versioning",
      "restoring",
    ] as const satisfies readonly CloudState["status"][];
    for (const status of statuses) {
      cloud = { ...cloud, status };
      expect(editBlockReason()).toBeNull();
    }
  });
});

describe("useEditBlocked", () => {
  it.each(cases)(
    "locked=%s loading=%s aiRunning=%s deleting=%s matches editBlockReason() (%s)",
    (locked, loading, aiRunning, deleting, all) => {
      setConditions(locked, loading, aiRunning, deleting);
      const { result } = renderHook(() => useEditBlocked());
      expect(result.current).toBe(all !== null);
    },
  );

  it("re-renders only when the blocked state changes", () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return useEditBlocked();
    });
    expect(result.current).toBe(false);
    const initialRenders = renders;

    act(() => {
      useAnimationStore.setState({ pendingDeletions: new Set(["api"]) });
    });
    expect(result.current).toBe(true);
    const blockedRenders = renders;
    expect(blockedRenders).toBeGreaterThan(initialRenders);

    act(() => {
      useAnimationStore.setState({ pendingDeletions: new Set(["api", "db"]) });
      useAiDesignStore.setState({ stage: "components" });
    });
    expect(renders).toBe(blockedRenders);

    act(() => {
      useAnimationStore.setState({ pendingDeletions: new Set() });
    });
    expect(result.current).toBe(false);
  });
});
