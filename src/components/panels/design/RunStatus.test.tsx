import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { AiStage } from "@/schemas/aiDesign";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { AiRunIndicator, RunStatus, STALL_THRESHOLD_MS } from "./RunStatus";

const pipeline = vi.hoisted(() => ({
  update: vi.fn<() => Promise<void>>(),
  regenerateDecision: vi.fn<(nodeId: string) => Promise<void>>(),
  generateDataModel: vi.fn<() => Promise<void>>(),
  retry: vi.fn<(stage: AiStage) => Promise<void>>(),
  restart: vi.fn<() => Promise<void>>(),
  cancel: vi.fn<() => void>(),
}));
vi.mock("@/hooks/useDesignPipeline", () => ({ useDesignPipeline: () => pipeline }));

const run = () => useAiDesignStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  useAiDesignStore.setState(useAiDesignStore.getInitialState());
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  run().cancel();
  vi.useRealTimers();
});

const status = () => screen.getByRole("status");
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("RunStatus", () => {
  it.each<[AiStage, string]>([
    ["requirements", "Clarifying requirements"],
    ["components", "Choosing components"],
    ["api", "Designing the API"],
    ["data-model", "Designing the data model"],
  ])("names the %s stage in plain words", (stage, label) => {
    run().start("d1");
    run().setStage(stage);
    render(<RunStatus />);
    expect(status()).toHaveTextContent(label);
    expect(status()).toHaveAttribute("aria-live", "polite");
  });

  it("shows decision progress while explaining decisions", () => {
    run().start("d1");
    run().setStage("decisions");
    run().setDecisionProgress(12, 40);
    render(<RunStatus />);
    expect(status()).toHaveTextContent("Explaining decisions 12/40");
  });

  it("says the run is starting before its first stage", () => {
    run().start("d1");
    render(<RunStatus />);
    expect(status()).toHaveTextContent("Starting");
  });

  it("follows stage changes", () => {
    run().start("d1");
    run().setStage("requirements");
    render(<RunStatus />);
    act(() => {
      run().setStage("components");
    });
    expect(status()).toHaveTextContent("Choosing components");
  });

  it("ticks the time spent on the current stage and restarts it on a new stage", () => {
    run().start("d1");
    run().setStage("requirements");
    render(<RunStatus />);
    expect(screen.getByText("0:00")).toBeVisible();
    advance(7000);
    expect(screen.getByText("0:07")).toBeVisible();
    advance(60_000);
    expect(screen.getByText("1:07")).toBeVisible();

    act(() => {
      run().setStage("components");
    });
    advance(1000);
    expect(screen.getByText("0:01")).toBeVisible();
  });

  it("keeps the ticking time out of the live region", () => {
    run().start("d1");
    run().setStage("requirements");
    render(<RunStatus />);
    advance(3000);
    expect(status()).not.toHaveTextContent("0:03");
  });

  it("flags a stage with no progress past the threshold, offering Retry and Cancel", () => {
    run().start("d1");
    run().setStage("components");
    render(<RunStatus />);
    advance(STALL_THRESHOLD_MS - 1000);
    expect(screen.queryByText(/Taking longer than usual/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();

    advance(1000);
    expect(status()).toHaveTextContent("Taking longer than usual");
    // The stage is still named, so the user knows what is slow.
    expect(status()).toHaveTextContent("Choosing components");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(pipeline.restart).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(pipeline.cancel).toHaveBeenCalledTimes(1);
  });

  it("counts decision progress as progress, clearing the stalled state", () => {
    run().start("d1");
    run().setStage("decisions");
    run().setDecisionProgress(0, 40);
    render(<RunStatus />);
    advance(STALL_THRESHOLD_MS - 5000);
    act(() => {
      run().setDecisionProgress(1, 40);
    });
    advance(10_000);
    expect(screen.queryByText(/Taking longer than usual/)).not.toBeInTheDocument();

    advance(STALL_THRESHOLD_MS);
    expect(status()).toHaveTextContent("Taking longer than usual");
    act(() => {
      run().setDecisionProgress(2, 40);
    });
    advance(1000);
    expect(screen.queryByText(/Taking longer than usual/)).not.toBeInTheDocument();
    expect(status()).toHaveTextContent("Explaining decisions 2/40");
  });

  it("clears the stalled state when the run moves to a new stage", () => {
    run().start("d1");
    run().setStage("requirements");
    render(<RunStatus />);
    advance(STALL_THRESHOLD_MS);
    expect(status()).toHaveTextContent("Taking longer than usual");
    act(() => {
      run().setStage("components");
    });
    advance(1000);
    expect(screen.queryByText(/Taking longer than usual/)).not.toBeInTheDocument();
  });

  it("stops its clock when unmounted", () => {
    run().start("d1");
    const { unmount } = render(<RunStatus />);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uses a reduced-motion-safe activity mark", () => {
    run().start("d1");
    const { container } = render(<RunStatus />);
    // `.branch-loading-dot` stops animating under prefers-reduced-motion (index.css).
    expect(container.querySelector(".branch-loading-dot")).not.toBeNull();
  });
});

describe("AiRunIndicator", () => {
  it("shows nothing while no run is in progress", () => {
    const { container } = render(<AiRunIndicator />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the stage, decision progress and elapsed time during a run, then disappears", () => {
    render(<AiRunIndicator />);
    act(() => {
      run().start("d1");
      run().setStage("decisions");
      run().setDecisionProgress(12, 40);
    });
    expect(screen.getByText("Explaining decisions 12/40")).toBeVisible();
    advance(5000);
    expect(screen.getByText("0:05")).toBeVisible();

    act(() => {
      run().finish();
    });
    expect(screen.queryByText("Explaining decisions 12/40")).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels the run", () => {
    run().start("d1");
    render(<AiRunIndicator />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel AI design run" }));
    expect(pipeline.cancel).toHaveBeenCalledTimes(1);
  });

  it("flags a stalled stage", () => {
    run().start("d1");
    run().setStage("api");
    render(<AiRunIndicator />);
    advance(STALL_THRESHOLD_MS);
    expect(screen.getByText(/Taking longer than usual/)).toBeVisible();
  });
});
