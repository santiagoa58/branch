import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactFlowProps } from "@xyflow/react";
import { DiagramEditor } from "@/components/DiagramEditor";
import { Navbar } from "@/components/Navbar";
import { useDiagramStore } from "./diagramStore";
import { useUIStore } from "./uiStore";

vi.mock("@xyflow/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@xyflow/react")>()),
  ReactFlow: ({ children }: ReactFlowProps) => <div>{children}</div>,
  MiniMap: () => null,
  useReactFlow: () => ({}),
  useStoreApi: () => ({}),
}));
vi.mock("@/components/nodes", () => ({ nodeTypes: {} }));
vi.mock("@/components/edges", () => ({ edgeTypes: {} }));
vi.mock("@/hooks/useSimulationAnimation", () => ({ useSimulationAnimation: () => {} }));
vi.mock("@/hooks/useDestroyAnimation", () => ({ useDestroyAnimation: () => {} }));
vi.mock("@/hooks/useChaosSimulation", () => ({ useChaosSimulation: () => {} }));
vi.mock("@/hooks/useOnboardingProgress", () => ({ useOnboardingProgress: () => {} }));
vi.mock("@/hooks/useAutoFormat", () => ({
  useAutoFormat: () => ({ autoFormat: () => {}, disabled: false }),
}));
vi.mock("@/components/CloudAuth", () => ({ AccountControls: () => null }));
vi.mock("@/components/panels/GettingStartedChecklist", () => ({
  GettingStartedChecklist: () => null,
}));
vi.mock("@/components/panels/DiagramInfoCard", () => ({ DiagramInfoCard: () => null }));
vi.mock("@/components/panels/NodeDetailPopup", () => ({ NodeDetailPopup: () => null }));
vi.mock("@/components/panels/CanvasStatusBar", () => ({ CanvasStatusBar: () => null }));
vi.mock("@/components/panels/SpotlightSearch", () => ({ SpotlightSearch: () => null }));
vi.mock("@/components/ui/ImportDialog", () => ({ ImportDialog: () => null }));
vi.mock("@/components/ui/TemplateGalleryDialog", () => ({ TemplateGalleryDialog: () => null }));
vi.mock("@/components/ui/LaserPointer", () => ({ LaserPointer: () => null }));

beforeEach(() => {
  useUIStore.setState(useUIStore.getInitialState());
  useDiagramStore.setState(useDiagramStore.getInitialState());
  useDiagramStore.getState().hydrateDiagram({
    nodes: [
      {
        id: "api",
        type: "architecture",
        position: { x: 0, y: 0 },
        data: {
          label: "Legacy API",
          type: "service",
          healthCheckUrl: "https://example.com/health",
          tags: ["critical"],
        },
      },
      {
        id: "worker",
        type: "architecture",
        position: { x: 300, y: 0 },
        data: { label: "Worker", type: "service", tags: ["background"] },
      },
    ],
    edges: [
      { id: "http", source: "api", target: "worker", data: { protocol: "http", tags: ["sync"] } },
      { id: "grpc", source: "worker", target: "api", data: { protocol: "grpc" } },
    ],
  });
});

afterEach(() => {
  cleanup();
  useUIStore.setState(useUIStore.getInitialState());
  useDiagramStore.getState().resetDiagramState();
});

describe("editor filtering controls", () => {
  it("has no tag filtering state or actions", () => {
    const state = useUIStore.getState();
    for (const key of ["hiddenTags", "toggleHiddenTag", "isolateTag", "clearHiddenTags"]) {
      expect(state).not.toHaveProperty(key);
    }
  });

  it("omits the tag overlay for tagged documents while preserving protocol filtering", () => {
    render(<DiagramEditor />);

    expect(screen.queryByTitle("Show tag filter")).not.toBeInTheDocument();
    expect(screen.queryByText("Tags", { exact: true })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Show protocol legend"));
    expect(screen.getByText("Protocols", { exact: true })).toBeInTheDocument();

    const http = screen.getByRole("button", { name: "HTTP/REST" });
    fireEvent.click(http);
    expect(useUIStore.getState().hiddenProtocols).toEqual(new Set(["http"]));
    fireEvent.click(http);
    expect(useUIStore.getState().hiddenProtocols.size).toBe(0);

    fireEvent.doubleClick(http);
    expect(useUIStore.getState().hiddenProtocols).toEqual(new Set(["grpc"]));
    fireEvent.doubleClick(http);
    expect(useUIStore.getState().hiddenProtocols.size).toBe(0);

    fireEvent.doubleClick(screen.getByRole("button", { name: "gRPC" }));
    expect(useUIStore.getState().hiddenProtocols).toEqual(new Set(["http"]));
    fireEvent.click(screen.getByTitle("Show all protocols"));
    expect(useUIStore.getState().hiddenProtocols.size).toBe(0);
  });

  it("omits the health toolbar action even when a document has health URLs", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Navbar />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.queryByRole("button", { name: /health/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Run health checks", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Auto format" })).toBeInTheDocument();
  });
});
