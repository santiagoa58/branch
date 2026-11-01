import type { Node } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AiStage, DesignBrief } from "@/schemas/aiDesign";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useDiagramStore } from "@/store/diagramStore";
import { useUIStore } from "@/store/uiStore";
import { inputsFingerprint, resultFingerprint } from "@/utils/aiDesign/fingerprint";
import { EditorRightPanel } from "../EditorRightPanel";
import { DesignPanel } from "./DesignPanel";

const pipeline = vi.hoisted(() => ({
  update: vi.fn<() => Promise<void>>(),
  regenerateDecision: vi.fn<(nodeId: string) => Promise<void>>(),
  generateDataModel: vi.fn<() => Promise<void>>(),
  retry: vi.fn<(stage: AiStage) => Promise<void>>(),
  cancel: vi.fn<() => void>(),
}));
vi.mock("@/hooks/useDesignPipeline", () => ({ useDesignPipeline: () => pipeline }));
vi.mock("../PropertiesPanel", () => ({
  PropertiesPanel: () => <aside aria-label="Properties" />,
}));

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

function freshBrief(): DesignBrief {
  const inputs = inputsFingerprint(base.inputs);
  const result = resultFingerprint(base, [service], []);
  return {
    ...base,
    dataModel: { entities: [] },
    ranFrom: {
      requirements: inputs,
      components: inputs,
      decisions: result,
      api: result,
      dataModel: result,
    },
  };
}

const tab = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });

beforeEach(() => {
  useAiDesignStore.setState(useAiDesignStore.getInitialState());
  useDiagramStore.getState().resetDiagramState();
  useUIStore.setState(useUIStore.getInitialState());
});

afterEach(() => {
  cleanup();
  useAiDesignStore.getState().cancel();
});

describe("DesignPanel", () => {
  it("shows the composer without tabs while the diagram has no brief", () => {
    render(<DesignPanel />);
    expect(screen.getByRole("heading", { name: "Design with AI" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Start design" })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Design sections" })).not.toBeInTheDocument();
  });

  it("marks each tab whose content is out of date", () => {
    useDiagramStore.setState({ brief: freshBrief(), nodes: [service], edges: [] });
    render(<DesignPanel />);
    expect(screen.getByText("Backend")).toBeVisible();
    expect(screen.getByText("A URL shortener")).toBeVisible();
    for (const name of ["Brief", "Design", "API", "Data model"]) {
      expect(tab(name)).not.toHaveTextContent("out of date");
    }

    // A graph edit leaves reasoning, API and the data model out of date.
    act(() => {
      useDiagramStore.setState({ nodes: [service, { ...service, id: "db" }] });
    });
    expect(tab("Brief")).not.toHaveTextContent("out of date");
    expect(tab("Design")).toHaveTextContent("(out of date)");
    expect(tab("API")).toHaveTextContent("(out of date)");
    expect(tab("Data model")).toHaveTextContent("(out of date)");

    // An input edit leaves every stage out of date.
    act(() => {
      useDiagramStore.setState({
        nodes: [service],
        brief: { ...freshBrief(), inputs: { ...base.inputs, prompt: "A link shortener" } },
      });
    });
    expect(tab("Brief")).toHaveTextContent("(out of date)");
  });

  it("switches tabs and keeps the update bar pinned below them", async () => {
    const user = userEvent.setup();
    useDiagramStore.setState({ brief: base, nodes: [], edges: [] });
    render(<DesignPanel />);
    expect(tab("Brief")).toHaveAttribute("aria-pressed", "true");
    await user.click(tab("API"));
    expect(tab("API")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Endpoints and events appear here after an update.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Update design" })).toBeVisible();
  });

  it("shows progress instead of the tabs during a run, and cannot be closed", () => {
    useDiagramStore.setState({ brief: base, nodes: [], edges: [] });
    useAiDesignStore.getState().start("d1");
    useAiDesignStore.getState().setStage("requirements");
    render(<DesignPanel />);
    expect(screen.getByRole("list", { name: "Design progress" })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Design sections" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close design panel" })).toBeDisabled();
  });

  it("closes from its header", async () => {
    const user = userEvent.setup();
    useUIStore.getState().openDesignPanel();
    render(<DesignPanel />);
    await user.click(screen.getByRole("button", { name: "Close design panel" }));
    expect(useUIStore.getState().designPanelOpen).toBe(false);
  });
});

describe("EditorRightPanel", () => {
  it("gives the slot to the inspector while something is selected", () => {
    useUIStore.getState().openDesignPanel();
    render(<EditorRightPanel />);
    expect(screen.getByRole("complementary", { name: "Design with AI" })).toBeVisible();

    act(() => {
      useDiagramStore.setState({ selectedNodeId: "api" });
    });
    expect(screen.getByRole("complementary", { name: "Properties" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Design with AI" })).not.toBeInTheDocument();

    // Closing the inspector shows the design panel again.
    act(() => {
      useDiagramStore.setState({ selectedNodeId: null });
    });
    expect(screen.getByRole("complementary", { name: "Design with AI" })).toBeVisible();
  });

  it("shows the inspector when the design panel is closed", () => {
    render(<EditorRightPanel />);
    expect(screen.getByRole("complementary", { name: "Properties" })).toBeInTheDocument();
  });

  it("keeps the design panel and its Cancel on screen during a run", async () => {
    const user = userEvent.setup();
    useUIStore.setState({ rightPanelVisible: false });
    useDiagramStore.setState({ brief: base, selectedNodeId: "api" });
    useAiDesignStore.getState().start("d1");
    render(<EditorRightPanel />);
    const panel = screen.getByRole("complementary", { name: "Design with AI" });
    await user.click(within(panel).getByRole("button", { name: "Cancel" }));
    expect(pipeline.cancel).toHaveBeenCalledTimes(1);
  });
});
