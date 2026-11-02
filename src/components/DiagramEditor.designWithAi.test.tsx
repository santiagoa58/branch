import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactFlowProps, XYPosition } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { cloudWorkspace } from "@/services/cloudWorkspace";
import { useAnimationStore } from "@/store/animationStore";
import { useDiagramStore } from "@/store/diagramStore";
import { useSimulationStore } from "@/store/simulationStore";
import { useUIStore } from "@/store/uiStore";
import { DiagramEditor } from "./DiagramEditor";

const flow = vi.hoisted(() => ({
  screenToFlowPosition: vi.fn<(position: XYPosition) => XYPosition>(),
  zoomIn: vi.fn<() => void>(),
  zoomOut: vi.fn<() => void>(),
  getZoom: () => 1,
  getIntersectingNodes: () => [],
}));

// Keep React Flow's graph helpers real for the diagram store, but isolate canvas rendering.
vi.mock("@xyflow/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@xyflow/react")>()),
  ReactFlow: ({ children, selectionOnDrag, panOnDrag }: ReactFlowProps) => (
    <div
      className="react-flow"
      data-testid="canvas"
      data-selection-on-drag={String(selectionOnDrag)}
      data-pan-on-drag={JSON.stringify(panOnDrag)}
    >
      {children}
    </div>
  ),
  MiniMap: () => null,
  useReactFlow: () => flow,
  useStoreApi: () => ({ getState: () => ({ nodeLookup: new Map() }) }),
}));
vi.mock("@/components/nodes", () => ({ nodeTypes: {} }));
vi.mock("@/components/edges", () => ({ edgeTypes: {} }));
vi.mock("@/hooks/useSimulationAnimation", () => ({ useSimulationAnimation: () => {} }));
vi.mock("@/hooks/useDestroyAnimation", () => ({ useDestroyAnimation: () => {} }));
vi.mock("@/hooks/useChaosSimulation", () => ({ useChaosSimulation: () => {} }));
vi.mock("@/hooks/useOnboardingProgress", () => ({ useOnboardingProgress: () => {} }));
vi.mock("@/hooks/useAutoFormat", () => ({ useAutoFormat: () => ({ autoFormat: () => {} }) }));
vi.mock("@/components/panels/SimulationPanel", () => ({
  SimulationPanel: () => <section aria-label="Simulation panel" />,
}));
vi.mock("@/components/panels/GettingStartedChecklist", () => ({
  GettingStartedChecklist: () => null,
}));
vi.mock("@/components/panels/DiagramInfoCard", () => ({ DiagramInfoCard: () => null }));
vi.mock("@/components/panels/ProtocolLegend", () => ({ ProtocolLegend: () => null }));
vi.mock("@/components/panels/NodeDetailPopup", () => ({ NodeDetailPopup: () => null }));
vi.mock("@/components/panels/CanvasStatusBar", () => ({ CanvasStatusBar: () => null }));
vi.mock("@/components/panels/SpotlightSearch", () => ({ SpotlightSearch: () => null }));
vi.mock("@/components/panels/TagFilter", () => ({ TagFilter: () => null }));
vi.mock("@/components/panels/FlowsPanel", () => ({ FlowsPanel: () => null }));
vi.mock("@/components/ui/ImportDialog", () => ({ ImportDialog: () => null }));
vi.mock("@/components/ui/TemplateGalleryDialog", () => ({ TemplateGalleryDialog: () => null }));
vi.mock("@/components/ui/LaserPointer", () => ({ LaserPointer: () => null }));

function resetStores() {
  useDiagramStore.setState(useDiagramStore.getInitialState());
  useUIStore.setState(useUIStore.getInitialState());
  useSimulationStore.setState(useSimulationStore.getInitialState());
  useAnimationStore.setState(useAnimationStore.getInitialState());
}

beforeEach(() => {
  cloudWorkspace.reset();
  resetStores();
  vi.spyOn(cloudWorkspace, "getState").mockReturnValue({
    diagram: null,
    status: "saved",
    dirty: false,
    locked: false,
    transitioning: false,
    message: null,
  });
  vi.spyOn(cloudWorkspace, "schedule").mockImplementation(() => {});
  useDiagramStore.getState().hydrateDiagram({ nodes: [], edges: [] });
  flow.screenToFlowPosition.mockReset().mockReturnValue({ x: 240, y: 160 });
  window.getSelection()?.removeAllRanges();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  cloudWorkspace.reset();
  resetStores();
});

const architectureNode = {
  id: "api",
  type: "architecture",
  position: { x: 0, y: 0 },
  data: { label: "API", type: "service" },
};

describe("Design with AI entry points", () => {
  it("the toolbar button opens and closes the design panel", async () => {
    const user = userEvent.setup();
    useDiagramStore.getState().hydrateDiagram({ nodes: [architectureNode], edges: [] });
    render(<DiagramEditor />);
    const button = screen.getByRole("button", { name: "Design with AI" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await user.click(button);
    expect(useUIStore.getState()).toMatchObject({ designPanelOpen: true, rightPanelVisible: true });
    expect(button).toHaveAttribute("aria-pressed", "true");

    await user.click(button);
    expect(useUIStore.getState().designPanelOpen).toBe(false);
  });

  it("opening the panel clears the selection so the inspector gives way", async () => {
    const user = userEvent.setup();
    useDiagramStore.getState().hydrateDiagram({ nodes: [architectureNode], edges: [] });
    act(() => useDiagramStore.getState().setSelectedNode("api"));
    useUIStore.getState().openDesignPanel();
    render(<DiagramEditor />);
    const button = screen.getByRole("button", { name: "Design with AI" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await user.click(button);
    expect(useDiagramStore.getState().selectedNodeId).toBeNull();
    expect(useUIStore.getState().designPanelOpen).toBe(true);
  });

  it("the empty canvas offers Design with AI beside the starter templates", async () => {
    const user = userEvent.setup();
    render(<DiagramEditor />);
    expect(screen.getByRole("button", { name: "Browse starter templates" })).toBeVisible();
    const buttons = screen.getAllByRole("button", { name: "Design with AI" });
    // The toolbar button and the empty-canvas button.
    expect(buttons).toHaveLength(2);
    await user.click(buttons[1]!);
    expect(useUIStore.getState().designPanelOpen).toBe(true);
  });
});
