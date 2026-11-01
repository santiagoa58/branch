import type { Node } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AiStage, DesignBrief } from "@/schemas/aiDesign";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useDiagramStore } from "@/store/diagramStore";
import { inputsFingerprint, resultFingerprint } from "@/utils/aiDesign/fingerprint";
import { RunNotes, RunProgress, UpdateBar, updateMessage } from "./UpdateBar";

const pipeline = vi.hoisted(() => ({
  update: vi.fn<() => Promise<void>>(),
  regenerateDecision: vi.fn<(nodeId: string) => Promise<void>>(),
  generateDataModel: vi.fn<() => Promise<void>>(),
  retry: vi.fn<(stage: AiStage) => Promise<void>>(),
  cancel: vi.fn<() => void>(),
}));
vi.mock("@/hooks/useDesignPipeline", () => ({ useDesignPipeline: () => pipeline }));

const service: Node = {
  id: "api",
  type: "architecture",
  position: { x: 0, y: 0 },
  data: { label: "API", type: "service" },
};

const base: DesignBrief = {
  inputs: {
    prompt: "A URL shortener",
    scope: "backend",
    requirements: [],
    outOfScope: [],
    answers: [],
  },
  questions: [],
  requirements: [],
  assumptions: [],
  outOfScope: [],
  ranFrom: {},
};

/** Stages 1 and 2 ran from the current inputs; reasoning and API are due. */
function designedBrief(): DesignBrief {
  const inputs = inputsFingerprint(base.inputs);
  return { ...base, ranFrom: { requirements: inputs, components: inputs } };
}

function freshBrief(nodes: Node[]): DesignBrief {
  const designed = designedBrief();
  const result = resultFingerprint(designed, nodes, []);
  return { ...designed, ranFrom: { ...designed.ranFrom, decisions: result, api: result } };
}

beforeEach(() => {
  useAiDesignStore.setState(useAiDesignStore.getInitialState());
  useDiagramStore.getState().resetDiagramState();
  for (const fn of Object.values(pipeline)) {
    fn.mockReset();
  }
  pipeline.update.mockResolvedValue();
  pipeline.retry.mockResolvedValue();
});

afterEach(() => {
  cleanup();
  useAiDesignStore.getState().cancel();
});

describe("updateMessage", () => {
  it("names the stages in order, joined with commas and and", () => {
    expect(updateMessage(["requirements", "components", "decisions", "api"])).toBe(
      "Requirements, components, reasoning and API will update",
    );
    expect(updateMessage(["decisions", "api"])).toBe("Reasoning and API will update");
    expect(updateMessage(["api"])).toBe("API will update");
  });
});

describe("UpdateBar", () => {
  it("update bar names the stages that will run and warns about replacement", async () => {
    const user = userEvent.setup();
    useDiagramStore.setState({ brief: base, nodes: [service], edges: [] });
    render(<UpdateBar />);
    expect(
      screen.getByText("Requirements, components, reasoning and API will update"),
    ).toBeVisible();
    expect(
      screen.getByText("The current design is replaced; a version is saved first."),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Update design" }));
    expect(pipeline.update).toHaveBeenCalledTimes(1);
  });

  it("does not warn when components will not run or there is no design to replace", () => {
    useDiagramStore.setState({ brief: designedBrief(), nodes: [service], edges: [] });
    const { unmount } = render(<UpdateBar />);
    expect(screen.getByText("Reasoning and API will update")).toBeVisible();
    expect(screen.queryByText(/The current design is replaced/)).not.toBeInTheDocument();
    unmount();

    useDiagramStore.setState({ brief: base, nodes: [], edges: [] });
    render(<UpdateBar />);
    expect(screen.getByText(/^Requirements, components/)).toBeVisible();
    expect(screen.queryByText(/The current design is replaced/)).not.toBeInTheDocument();
  });

  it("is hidden when nothing is out of date, during a run, or while questions are open", () => {
    useDiagramStore.setState({ brief: freshBrief([service]), nodes: [service], edges: [] });
    const { rerender } = render(<UpdateBar />);
    expect(screen.queryByRole("button", { name: "Update design" })).not.toBeInTheDocument();

    act(() => {
      useDiagramStore.setState({ brief: base });
    });
    rerender(<UpdateBar />);
    expect(screen.getByRole("button", { name: "Update design" })).toBeVisible();

    act(() => {
      useAiDesignStore.getState().start("d1");
    });
    expect(screen.queryByRole("button", { name: "Update design" })).not.toBeInTheDocument();

    act(() => {
      useAiDesignStore.getState().finish();
      useDiagramStore.setState({
        brief: {
          ...base,
          questions: [
            {
              id: "q1",
              topic: "scale",
              question: "How many links a day?",
              why: "Sizes storage.",
              options: [],
              recommended: "About 1M",
              allowsCustom: true,
            },
          ],
        },
      });
    });
    expect(screen.queryByRole("button", { name: "Update design" })).not.toBeInTheDocument();
  });
});

describe("RunProgress", () => {
  it("progress shows reasoning d/t and Cancel calls cancel()", async () => {
    const user = userEvent.setup();
    useAiDesignStore.getState().start("d1");
    useAiDesignStore.getState().setStage("decisions");
    useAiDesignStore.getState().setDecisionProgress(3, 7);
    render(<RunProgress />);

    const steps = screen.getAllByRole("listitem").map((item) => item.textContent);
    expect(steps).toEqual([
      expect.stringContaining("Requirements"),
      expect.stringContaining("Components"),
      expect.stringContaining("Reasoning 3/7"),
      expect.stringContaining("API"),
    ]);
    expect(screen.getByText("Reasoning 3/7").closest("li")).toHaveAttribute("aria-current", "step");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(pipeline.cancel).toHaveBeenCalledTimes(1);
  });

  it("shows a data model run as its own step", () => {
    useAiDesignStore.getState().start("d1");
    useAiDesignStore.getState().setStage("data-model");
    render(<RunProgress />);
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      expect.stringContaining("Data model"),
    ]);
  });
});

describe("RunNotes", () => {
  it("a failed stage shows its error and Retry", async () => {
    const user = userEvent.setup();
    useAiDesignStore.getState().setError("api", "The AI service timed out");
    useAiDesignStore.getState().setError("decisions", "Reasoning failed for 2 components");
    render(<RunNotes />);
    expect(screen.getByText("The AI service timed out")).toBeVisible();
    const retries = screen.getAllByRole("button", { name: /^Retry/ });
    expect(retries).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Retry API" }));
    expect(pipeline.retry).toHaveBeenCalledWith("api");
  });

  it("shows warnings until dismissed", async () => {
    const user = userEvent.setup();
    useAiDesignStore.getState().addWarnings(["Dropped a connection to an unknown component"]);
    render(<RunNotes />);
    expect(screen.getByText("Dropped a connection to an unknown component")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Dismiss warnings" }));
    expect(
      screen.queryByText("Dropped a connection to an unknown component"),
    ).not.toBeInTheDocument();
  });
});
