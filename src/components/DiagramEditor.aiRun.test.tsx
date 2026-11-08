import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Node, ReactFlowProps, XYPosition } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { cloudWorkspace } from "@/services/cloudWorkspace";
import { useAiDesignStore } from "@/store/aiDesignStore";
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
  /** The props the editor last rendered React Flow with. */
  props: {} as ReactFlowProps,
}));

// The zone layer reads React Flow internals that the stub below does not provide.
vi.mock("@/components/canvas/ZoneBands", () => ({ ZoneBands: () => null }));
// Keep React Flow's graph helpers real for the diagram store, but isolate canvas rendering.
vi.mock("@xyflow/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@xyflow/react")>()),
  ReactFlow: (props: ReactFlowProps) => {
    flow.props = props;
    return (
      <div
        className="react-flow"
        data-testid="canvas"
        onDrop={props.onDrop}
        onDragOver={props.onDragOver}
      >
        {props.children}
      </div>
    );
  },
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
vi.mock("@/components/panels/FlowsPanel", () => ({ FlowsPanel: () => null }));
vi.mock("@/components/ui/ImportDialog", () => ({ ImportDialog: () => null }));
vi.mock("@/components/ui/TemplateGalleryDialog", () => ({ TemplateGalleryDialog: () => null }));
vi.mock("@/components/ui/LaserPointer", () => ({ LaserPointer: () => null }));

const HINT = "AI is updating the design. Viewing only.";

const api: Node = {
  id: "api",
  type: "architecture",
  position: { x: 0, y: 0 },
  data: { label: "API", type: "service" },
};
const db: Node = {
  id: "db",
  type: "architecture",
  position: { x: 300, y: 0 },
  data: { label: "Database", type: "database" },
};

function resetStores() {
  useDiagramStore.setState(useDiagramStore.getInitialState());
  useUIStore.setState(useUIStore.getInitialState());
  useSimulationStore.setState(useSimulationStore.getInitialState());
  useAnimationStore.setState(useAnimationStore.getInitialState());
  useAiDesignStore.setState(useAiDesignStore.getInitialState());
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
  useDiagramStore.getState().hydrateDiagram({
    nodes: [api, db],
    edges: [{ id: "api-db", source: "api", target: "db", data: { protocol: "http" } }],
  });
  flow.screenToFlowPosition.mockReset().mockReturnValue({ x: 240, y: 160 });
  flow.zoomIn.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useAiDesignStore.getState().cancel();
  cloudWorkspace.reset();
  resetStores();
});

function startRun() {
  act(() => {
    void useAiDesignStore.getState().start("d1");
  });
}

function selectNode(id: string) {
  act(() => {
    flow.props.onNodesChange?.([{ id, type: "select", selected: true }]);
    flow.props.onNodeClick?.({} as React.MouseEvent, useDiagramStore.getState().nodes[0]!);
  });
}

function press(key: string, init: KeyboardEventInit = {}) {
  fireEvent.keyDown(screen.getByTestId("canvas"), { key, ...init });
}

describe("connection focus on the canvas", () => {
  it("highlights selection without saving or changing the real graph, and clears on a canvas click", () => {
    render(<DiagramEditor />);
    const storedEdges = useDiagramStore.getState().edges;
    selectNode("api");
    expect(flow.props.edges?.[0]?.data?.["connectionFocus"]).toBe("highlighted");
    expect(useDiagramStore.getState().edges).toBe(storedEdges);
    expect(cloudWorkspace.schedule).not.toHaveBeenCalled();

    act(() => {
      flow.props.onNodesChange?.([{ id: "api", type: "select", selected: false }]);
      flow.props.onPaneClick?.({} as React.MouseEvent);
    });
    expect(flow.props.edges?.[0]?.data).not.toHaveProperty("connectionFocus");
  });

  it.each(["flow", "traffic", "failure", "chaos"] as const)(
    "lets %s simulation own highlighting and restores selection focus on exit",
    (mode) => {
      render(<DiagramEditor />);
      selectNode("api");
      act(() => useSimulationStore.getState().setMode(mode));
      expect(flow.props.edges?.[0]?.data).not.toHaveProperty("connectionFocus");
      act(() => useSimulationStore.getState().setMode("idle"));
      expect(flow.props.edges?.[0]?.data?.["connectionFocus"]).toBe("highlighted");
    },
  );

  it("clears node focus when inspecting a connection", () => {
    render(<DiagramEditor />);
    selectNode("api");
    act(() =>
      flow.props.onEdgeClick?.({} as React.MouseEvent, useDiagramStore.getState().edges[0]!),
    );
    expect(flow.props.edges?.[0]?.data).not.toHaveProperty("connectionFocus");
  });
});

describe("the canvas during an AI design run", () => {
  it("stays viewable: pan, zoom and selection work, and nothing is inert", () => {
    render(<DiagramEditor />);
    startRun();

    const canvas = screen.getByTestId("canvas");
    expect(canvas.closest("[inert]")).toBeNull();
    expect(flow.props).toMatchObject({
      elementsSelectable: true,
      panOnScroll: true,
      zoomOnPinch: true,
      panOnDrag: [1, 2],
    });
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(flow.zoomIn).toHaveBeenCalledTimes(1);

    selectNode("api");
    expect(useDiagramStore.getState().selectedNodeId).toBe("api");
    expect(useDiagramStore.getState().nodes[0]?.selected).toBe(true);
  });

  it("does not let nodes be dragged, connected, reconnected or deleted", () => {
    render(<DiagramEditor />);
    startRun();

    expect(flow.props).toMatchObject({
      nodesDraggable: false,
      nodesConnectable: false,
      edgesReconnectable: false,
      deleteKeyCode: null,
    });

    // Even if React Flow reported a drag or a connection, the store would ignore it.
    act(() => {
      flow.props.onNodesChange?.([
        { id: "api", type: "position", position: { x: 99, y: 99 }, dragging: false },
      ]);
      flow.props.onConnect?.({
        source: "db",
        target: "api",
        sourceHandle: null,
        targetHandle: null,
      });
    });
    expect(useDiagramStore.getState().nodes[0]?.position).toEqual({ x: 0, y: 0 });
    expect(useDiagramStore.getState().edges).toHaveLength(1);
  });

  it("ignores Delete and paste for a selected node", () => {
    render(<DiagramEditor />);
    act(() => {
      useDiagramStore.getState().onNodesChange([{ id: "api", type: "select", selected: true }]);
      useDiagramStore.getState().copySelectedNodes();
    });
    startRun();
    selectNode("api");

    press("Delete");
    press("v", { ctrlKey: true });

    expect(useAnimationStore.getState().pendingDeletions.size).toBe(0);
    expect(useDiagramStore.getState().nodes.map((node) => node.id)).toEqual(["api", "db"]);
  });

  it("offers only the context menu actions that do not edit", () => {
    render(<DiagramEditor />);
    act(() => {
      useDiagramStore.getState().onNodesChange([{ id: "api", type: "select", selected: true }]);
      useDiagramStore.getState().copySelectedNodes();
    });
    startRun();

    fireEvent.contextMenu(screen.getByTestId("canvas"), { clientX: 10, clientY: 10 });

    expect(screen.getByRole("button", { name: /Export Selection as SVG/ })).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Copy/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Paste/ })).not.toBeInTheDocument();
  });

  it("does not add a component dropped from the palette", () => {
    render(<DiagramEditor />);
    startRun();

    const dataTransfer = { getData: () => "service", dropEffect: "move" };
    fireEvent.dragOver(screen.getByTestId("canvas"), { dataTransfer });
    expect(dataTransfer.dropEffect).toBe("none");
    fireEvent.drop(screen.getByTestId("canvas"), { dataTransfer, clientX: 5, clientY: 5 });

    expect(useDiagramStore.getState().nodes).toHaveLength(2);
  });

  it("disables the toolbar actions that replace the diagram", () => {
    render(<DiagramEditor />);
    startRun();

    expect(screen.getByRole("button", { name: "Import diagram" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Starter templates" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Simulate requests and failures" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saved request flows" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Design with AI" })).toBeEnabled();
  });

  it("shows a viewing-only hint on the canvas while the run lasts", () => {
    render(<DiagramEditor />);
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();

    startRun();
    expect(screen.getByRole("status")).toHaveTextContent(HINT);

    act(() => useAiDesignStore.getState().finish());
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
  });

  it("allows editing again after the run ends", () => {
    render(<DiagramEditor />);
    startRun();
    act(() => useAiDesignStore.getState().finish());

    expect(flow.props).toMatchObject({
      nodesDraggable: true,
      nodesConnectable: true,
      edgesReconnectable: true,
    });
    expect(screen.getByRole("button", { name: "Import diagram" })).toBeEnabled();
    act(() => {
      flow.props.onNodesChange?.([
        { id: "api", type: "position", position: { x: 99, y: 99 }, dragging: false },
      ]);
    });
    expect(useDiagramStore.getState().nodes[0]?.position).toEqual({ x: 99, y: 99 });

    selectNode("api");
    press("Delete");
    expect(useAnimationStore.getState().pendingDeletions).toEqual(new Set(["api"]));
  });
});
