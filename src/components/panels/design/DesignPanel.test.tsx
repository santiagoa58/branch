import { ReactFlowProvider, type Node } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AiStage, DesignBrief } from "@/schemas/aiDesign";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useDiagramStore } from "@/store/diagramStore";
import { useUIStore } from "@/store/uiStore";
import { inputsFingerprint, resultFingerprint } from "@/utils/aiDesign/fingerprint";
import { EditorRightPanel } from "../EditorRightPanel";
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
  PropertiesPanel: () => <div aria-label="Element details">Inspector content</div>,
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
const section = (label: string) =>
  within(screen.getByRole("navigation", { name: "Sidebar sections" })).getByRole("button", {
    name: new RegExp(`^${label}`),
  });

beforeEach(() => {
  useAiDesignStore.setState(useAiDesignStore.getInitialState());
  useDiagramStore.getState().resetDiagramState();
  useUIStore.setState(useUIStore.getInitialState());
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  useAiDesignStore.getState().cancel();
});

describe("one editor sidebar", () => {
  it("has one complementary region and six sections even without an AI brief", async () => {
    const user = userEvent.setup();
    render(<EditorRightPanel />);
    expect(screen.getAllByRole("complementary")).toHaveLength(1);
    expect(screen.getByRole("complementary", { name: "Editor sidebar" })).toBeVisible();
    for (const label of ["Inspect", "Brief", "Design", "API", "Data", "Flows"]) {
      expect(section(label)).toBeVisible();
    }
    await user.click(section("API"));
    expect(useUIStore.getState().rightPanelTab).toBe("api");
    expect(screen.getByText("Endpoints and events appear here after an update.")).toBeVisible();
    expect(screen.getAllByRole("complementary")).toHaveLength(1);
    await user.click(section("Brief"));
    expect(screen.getByRole("button", { name: "Generate design" })).toBeVisible();
    expect(screen.getAllByRole("complementary")).toHaveLength(1);
  });

  it("switches between inspect, API and data model without clearing selection", async () => {
    const user = userEvent.setup();
    useDiagramStore.setState({
      brief: { ...freshBrief(), summary: "A short design." },
      nodes: [service],
      selectedNodeId: "api",
    });
    render(<EditorRightPanel />, { wrapper: ReactFlowProvider });
    expect(screen.getByText("Inspector content")).toBeVisible();
    await user.click(section("Design"));
    expect(screen.getByText("A short design.")).toBeVisible();
    await user.click(section("API"));
    expect(screen.getByText("Endpoints and events appear here after an update.")).toBeVisible();
    await user.click(section("Data"));
    expect(screen.getByText("The data model has no entities.")).toBeVisible();
    await user.click(section("Inspect"));
    expect(screen.getByText("Inspector content")).toBeVisible();
    expect(useDiagramStore.getState().selectedNodeId).toBe("api");
  });

  it("shows out-of-date indicators in the shared navigation", () => {
    useDiagramStore.setState({ brief: freshBrief(), nodes: [service], edges: [] });
    render(<EditorRightPanel />);
    for (const label of ["Brief", "Design", "API", "Data"]) {
      expect(section(label)).not.toHaveTextContent("out of date");
    }
    act(() => {
      useDiagramStore.setState({ nodes: [service, { ...service, id: "db" }] });
    });
    expect(section("Design")).toHaveTextContent("(out of date)");
    expect(section("API")).toHaveTextContent("(out of date)");
    expect(section("Data")).toHaveTextContent("(out of date)");
    act(() => {
      useDiagramStore.setState({
        nodes: [service],
        brief: { ...freshBrief(), inputs: { ...base.inputs, prompt: "A link shortener" } },
      });
    });
    expect(section("Brief")).toHaveTextContent("(out of date)");
  });

  it("keeps API available independently of Design with AI, and keeps the update footer", async () => {
    const user = userEvent.setup();
    useDiagramStore.setState({ brief: base });
    render(<EditorRightPanel />);
    await user.click(section("API"));
    expect(screen.getByRole("button", { name: "Update design" })).toBeVisible();
    await user.click(section("Brief"));
    expect(screen.getByText("A URL shortener")).toBeInTheDocument();
  });

  it("shows AI progress in Brief while other sections stay navigable", async () => {
    const user = userEvent.setup();
    useDiagramStore.setState({ brief: base });
    useUIStore.getState().openRightPanel("brief");
    render(<EditorRightPanel />);
    act(() => {
      void useAiDesignStore.getState().start("d1");
      useAiDesignStore.getState().setStage("requirements");
    });
    expect(screen.getByRole("list", { name: "Design progress" })).toBeVisible();
    await user.click(section("API"));
    expect(screen.getByText("Endpoints and events appear here after an update.")).toBeVisible();
    await user.click(section("Brief"));
    expect(screen.getByRole("button", { name: "Cancel" })).toBeVisible();
  });

  it("has one close action that closes the entire sidebar, without clearing selection", async () => {
    const user = userEvent.setup();
    useDiagramStore.setState({ nodes: [service], selectedNodeId: "api" });
    render(<EditorRightPanel />);
    await user.click(screen.getByRole("button", { name: "Close sidebar" }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(useUIStore.getState().rightPanelVisible).toBe(false);
    expect(useDiagramStore.getState().selectedNodeId).toBe("api");
  });

  it("exposes saved request flows in the same sidebar instead of a floating second sidebar", async () => {
    const user = userEvent.setup();
    render(<EditorRightPanel />);
    await user.click(section("Flows"));
    expect(screen.getAllByRole("complementary")).toHaveLength(1);
    expect(screen.getByText(/Save a replayable flow scenario/)).toBeVisible();
  });

  it("preserves the replace-design warning in Brief", async () => {
    const user = userEvent.setup();
    useDiagramStore.setState({ nodes: [service] });
    render(<EditorRightPanel />);
    await user.click(section("Brief"));
    expect(screen.getByText(REPLACEMENT_NOTICE)).toBeVisible();
  });

  it("retains section state when hidden and reopened", async () => {
    const user = userEvent.setup();
    render(<EditorRightPanel />);
    await user.click(section("API"));
    await user.click(screen.getByRole("button", { name: "Close sidebar" }));
    act(() => useUIStore.getState().toggleRightPanel());
    expect(section("API")).toHaveAttribute("aria-pressed", "true");
  });
});
