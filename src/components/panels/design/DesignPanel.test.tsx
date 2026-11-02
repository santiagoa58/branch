import { ReactFlowProvider, type Node } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AiStage, DesignBrief } from "@/schemas/aiDesign";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useDiagramStore } from "@/store/diagramStore";
import { useUIStore, type DesignTabId } from "@/store/uiStore";
import { inputsFingerprint, resultFingerprint } from "@/utils/aiDesign/fingerprint";
import { EditorRightPanel } from "../EditorRightPanel";
import { DesignPanel } from "./DesignPanel";
import { REPLACEMENT_NOTICE } from "./UpdateBar";

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
    expect(screen.getByRole("button", { name: "Generate design" })).toBeVisible();
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

  it("shows the design, API and data model in their tabs", async () => {
    const user = userEvent.setup();
    useDiagramStore.setState({
      brief: { ...freshBrief(), summary: "A short design." },
      nodes: [service],
      edges: [],
    });
    // "Show on canvas" reaches the editor's React Flow instance.
    render(<DesignPanel />, { wrapper: ReactFlowProvider });
    await user.click(tab("Design"));
    expect(screen.getByText("A short design.")).toBeVisible();
    expect(screen.getByRole("article", { name: "API" })).toBeVisible();
    await user.click(tab("Data model"));
    expect(screen.getByText("The data model has no entities.")).toBeVisible();
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

  it.each<DesignTabId>(["brief", "design", "api", "dataModel"])(
    "shows the run status during a run started from the %s tab, until it ends",
    (designTab) => {
      useDiagramStore.setState({ brief: freshBrief(), nodes: [service], edges: [] });
      useUIStore.setState({ designTab });
      render(<DesignPanel />, { wrapper: ReactFlowProvider });
      expect(screen.queryByRole("status")).not.toBeInTheDocument();

      act(() => {
        useAiDesignStore.getState().start("d1");
        useAiDesignStore.getState().setStage("decisions");
        useAiDesignStore.getState().setDecisionProgress(12, 40);
      });
      expect(screen.getByRole("status")).toHaveTextContent("Explaining decisions 12/40");
      expect(screen.getByRole("button", { name: "Cancel" })).toBeVisible();

      act(() => {
        useAiDesignStore.getState().finish();
      });
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(useUIStore.getState().designTab).toBe(designTab);
    },
  );

  it("closes from its header", async () => {
    const user = userEvent.setup();
    useUIStore.getState().openDesignPanel();
    render(<DesignPanel />);
    await user.click(screen.getByRole("button", { name: "Close design panel" }));
    expect(useUIStore.getState().designPanelOpen).toBe(false);
  });
});

describe("tab after a run", () => {
  it("keeps the open tab when a run ends", async () => {
    const user = userEvent.setup();
    useDiagramStore.setState({ brief: base, nodes: [], edges: [] });
    render(<DesignPanel />);
    await user.click(tab("API"));
    act(() => {
      useAiDesignStore.getState().start("d1");
    });
    act(() => {
      useAiDesignStore.getState().finish();
    });
    expect(tab("API")).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the tab while the inspector holds the slot", async () => {
    const user = userEvent.setup();
    useUIStore.getState().openDesignPanel();
    useDiagramStore.setState({ brief: base, nodes: [], edges: [] });
    render(<EditorRightPanel />);
    await user.click(tab("Data model"));

    act(() => {
      useDiagramStore.setState({ selectedNodeId: "api" });
    });
    expect(screen.queryByRole("complementary", { name: "Design with AI" })).not.toBeInTheDocument();
    act(() => {
      useDiagramStore.setState({ selectedNodeId: null });
    });

    expect(tab("Data model")).toHaveAttribute("aria-pressed", "true");
  });
});

describe("replacement notice before a run", () => {
  it("warns in the composer when the diagram already has components", () => {
    useDiagramStore.setState({ nodes: [service], edges: [] });
    render(<DesignPanel />);
    expect(screen.getByText(REPLACEMENT_NOTICE)).toBeVisible();
    expect(screen.getByRole("button", { name: "Generate design" })).toHaveAccessibleDescription(
      REPLACEMENT_NOTICE,
    );
  });

  it("does not warn in the composer on an empty diagram", () => {
    render(<DesignPanel />);
    expect(screen.queryByText(REPLACEMENT_NOTICE)).not.toBeInTheDocument();
  });

  it("offers Update design, with the notice, for a saved brief that stopped at questions", () => {
    const asking: DesignBrief = {
      ...base,
      questions: [
        {
          id: "q1",
          topic: "scale",
          question: "How many links a day?",
          why: "Sizes storage.",
          options: [],
          recommended: "About 1k",
          allowsCustom: true,
        },
      ],
      ranFrom: { requirements: inputsFingerprint(base.inputs) },
    };
    useDiagramStore.setState({ brief: asking, nodes: [service], edges: [] });
    render(<DesignPanel />);
    expect(screen.queryByRole("region", { name: "Questions" })).toBeNull();
    expect(
      screen.getByText("Requirements, components, reasoning and API will update"),
    ).toBeVisible();
    expect(screen.getByText(REPLACEMENT_NOTICE)).toBeVisible();
    expect(screen.getByRole("button", { name: "Update design" })).toBeVisible();
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

  // A hidden slot stays hidden (the toolbar's run indicator covers it); a closed design panel does not.
  it("shows the run status even when the design panel was closed", () => {
    useUIStore.setState({ rightPanelVisible: true, designPanelOpen: false });
    useDiagramStore.setState({ brief: base });
    render(<EditorRightPanel />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    act(() => {
      useAiDesignStore.getState().start("d1");
      useAiDesignStore.getState().setStage("requirements");
    });
    expect(screen.getByRole("status")).toHaveTextContent("Clarifying requirements");
  });

  it("shows the design panel and its Cancel during a run, even if it was closed", async () => {
    const user = userEvent.setup();
    useDiagramStore.setState({ brief: base });
    useAiDesignStore.getState().start("d1");
    render(<EditorRightPanel />);
    const panel = screen.getByRole("complementary", { name: "Design with AI" });
    await user.click(within(panel).getByRole("button", { name: "Cancel" }));
    expect(pipeline.cancel).toHaveBeenCalledTimes(1);
  });

  it("gives the slot to the inspector for a selection made during a run", () => {
    useUIStore.getState().openDesignPanel();
    useDiagramStore.setState({ brief: base });
    useAiDesignStore.getState().start("d1");
    render(<EditorRightPanel />);
    expect(screen.getByRole("complementary", { name: "Design with AI" })).toBeVisible();

    act(() => useDiagramStore.getState().setSelectedNode("api"));
    expect(screen.getByRole("complementary", { name: "Properties" })).toBeInTheDocument();

    // Closing the inspector returns to the run's progress.
    act(() => useDiagramStore.getState().setSelectedNode(null));
    expect(screen.getByRole("complementary", { name: "Design with AI" })).toBeVisible();
  });

  it("lets a compact screen hide the slot during a run to show the canvas", () => {
    useUIStore.setState({ rightPanelVisible: false });
    useAiDesignStore.getState().start("d1");
    render(<EditorRightPanel />);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });
});
