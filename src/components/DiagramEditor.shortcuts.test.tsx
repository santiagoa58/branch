import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

function mountEditor() {
  render(<DiagramEditor />);
  const canvas = screen.getByTestId("canvas");
  const wrapper = canvas.parentElement;
  if (!wrapper) {
    throw new Error("Expected React Flow to be mounted inside the editor's viewport wrapper.");
  }
  vi.spyOn(wrapper, "getBoundingClientRect").mockReturnValue(new DOMRect(137, 89, 960, 640));
  return canvas;
}

function press(key: string, init: KeyboardEventInit = {}) {
  fireEvent.keyDown(screen.getByTestId("canvas"), { key, ...init });
}

describe("DiagramEditor shortcut integration", () => {
  it("adds a service at the converted viewport center, including the wrapper's screen offset", () => {
    mountEditor();

    press("s");

    expect(flow.screenToFlowPosition).toHaveBeenCalledExactlyOnceWith({ x: 617, y: 409 });
    expect(useDiagramStore.getState().nodes).toEqual([
      expect.objectContaining({
        type: "architecture",
        position: { x: 240, y: 160 },
        data: { label: "New Service", type: "service" },
      }),
    ]);
  });

  it("toggles the simulation panel and real simulation mode with Shift+S without adding a service", () => {
    mountEditor();

    press("S", { shiftKey: true });

    expect(screen.getByRole("region", { name: "Simulation panel" })).toBeInTheDocument();
    expect(useSimulationStore.getState().mode).toBe("traffic");
    expect(useDiagramStore.getState().nodes).toEqual([]);
    expect(flow.screenToFlowPosition).not.toHaveBeenCalled();

    press("S", { shiftKey: true });

    expect(screen.queryByRole("region", { name: "Simulation panel" })).not.toBeInTheDocument();
    expect(useSimulationStore.getState().mode).toBe("idle");
    expect(useDiagramStore.getState().nodes).toEqual([]);
  });

  it.each([
    { key: "K", groupType: "cluster" },
    { key: "N", groupType: "subnet" },
  ])(
    "adds only a $groupType group with Shift+$key, not its unshifted node",
    ({ key, groupType }) => {
      mountEditor();

      press(key, { shiftKey: true });

      expect(useDiagramStore.getState().nodes).toMatchObject([
        {
          type: "group",
          position: { x: 240, y: 160 },
          zIndex: -1,
          style: { width: 300, height: 250 },
          data: { groupType, collapsed: false },
        },
      ]);
      expect(flow.screenToFlowPosition).toHaveBeenCalledTimes(1);
    },
  );

  it("pastes the real clipboard with Ctrl+V without switching the canvas out of pan mode", () => {
    useDiagramStore.setState({
      nodes: [
        {
          id: "source",
          type: "architecture",
          position: { x: 10, y: 20 },
          data: { label: "Copied API", type: "service" },
          selected: true,
        },
      ],
    });
    useDiagramStore.getState().copySelectedNodes();
    const canvas = mountEditor();
    press("h");
    expect(canvas).toHaveAttribute("data-selection-on-drag", "false");
    expect(canvas).toHaveAttribute("data-pan-on-drag", "true");

    press("v", { ctrlKey: true });

    const [original, pasted] = useDiagramStore.getState().nodes;
    expect(useDiagramStore.getState().nodes).toHaveLength(2);
    expect(original).toMatchObject({ id: "source", selected: false });
    expect(pasted).toMatchObject({
      type: "architecture",
      position: { x: 60, y: 70 },
      data: { label: "Copied API", type: "service" },
      selected: true,
    });
    expect(pasted?.id).not.toBe("source");
    expect(canvas).toHaveAttribute("data-selection-on-drag", "false");
    expect(canvas).toHaveAttribute("data-pan-on-drag", "true");
  });

  it("opens the native help dialog for shifted ?, blocks canvas additions behind it, and closes on Escape", () => {
    mountEditor();

    press("?", { shiftKey: true });

    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    expect(dialog.tagName).toBe("DIALOG");
    expect(dialog).toHaveAttribute("open");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("heading", { name: "Keyboard shortcuts" })).toBeInTheDocument();

    press("s");
    press("K", { shiftKey: true });
    expect(useDiagramStore.getState().nodes).toEqual([]);
    expect(flow.screenToFlowPosition).not.toHaveBeenCalled();

    press("Escape");

    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
    press("s");
    expect(useDiagramStore.getState().nodes).toHaveLength(1);
  });

  it("toggles the real left and right panel state independently with brackets", () => {
    mountEditor();

    press("[");
    expect(useUIStore.getState()).toMatchObject({
      leftPanelVisible: false,
      rightPanelVisible: true,
    });

    press("]");
    expect(useUIStore.getState()).toMatchObject({
      leftPanelVisible: false,
      rightPanelVisible: false,
    });

    press("[");
    press("]");
    expect(useUIStore.getState()).toMatchObject({
      leftPanelVisible: true,
      rightPanelVisible: true,
    });
    expect(useDiagramStore.getState().nodes).toEqual([]);
  });

  it("redos an undone editor addition with uppercase Ctrl+Shift+Z", () => {
    mountEditor();
    press("s");
    const addedNodes = useDiagramStore.getState().nodes;
    expect(addedNodes).toHaveLength(1);

    press("z", { ctrlKey: true });
    expect(useDiagramStore.getState().nodes).toEqual([]);
    expect(useDiagramStore.getState().canRedo()).toBe(true);

    press("Z", { ctrlKey: true, shiftKey: true });

    expect(useDiagramStore.getState().nodes).toEqual(addedNodes);
    expect(useDiagramStore.getState().canRedo()).toBe(false);
    expect(flow.screenToFlowPosition).toHaveBeenCalledTimes(1);
  });
});
