import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useDiagramStore } from "@/store/diagramStore";
import { diagramDataSchema } from "@/schemas/diagram";
import { PropertiesPanel } from "./PropertiesPanel";

vi.mock("@/components/ui/CodeEditor", () => ({ CodeEditor: () => null }));

describe("property input validation", () => {
  beforeEach(() => {
    useDiagramStore.getState().resetDiagramState();
    useDiagramStore.setState({
      nodes: [
        {
          id: "s",
          type: "architecture",
          position: { x: 0, y: 0 },
          data: { label: "API", type: "service" },
        },
      ],
      selectedNodeId: "s",
    });
  });

  afterEach(() => {
    cleanup();
    useDiagramStore.getState().resetDiagramState();
  });

  it("keeps valid state when the DOM supplies an unsupported node type", () => {
    render(<PropertiesPanel />);
    const select = screen
      .getAllByRole("combobox")
      .find((element) => element instanceof HTMLSelectElement && element.value === "service");
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error("Node type selector not rendered");
    }
    select.add(new Option("Unsupported", "unsupported"));
    fireEvent.change(select, { target: { value: "unsupported" } });
    expect(useDiagramStore.getState().nodes[0]?.data["type"]).toBe("service");
    expect(() => useDiagramStore.getState().saveDiagram()).not.toThrow();
  });

  it("uses theme-aware text for edge flow labels and hints", () => {
    useDiagramStore.setState({
      selectedNodeId: null,
      selectedEdgeId: "edge",
      edges: [{ id: "edge", source: "s", target: "s", data: { protocol: "http" } }],
    });
    render(<PropertiesPanel />);

    for (const label of ["Animated Flow", "Fire & Forget", "Two-way Flow"]) {
      expect(screen.getByText(label)).toHaveClass("text-foreground");
    }
    for (const hint of ["Show data passing", "Non-blocking call", "Request/Response"]) {
      expect(screen.getByText(hint)).toHaveClass("text-muted-foreground");
    }
  });

  it("edits and persists custom architecture attributes", () => {
    render(<PropertiesPanel />);
    fireEvent.change(screen.getByLabelText("Attribute key"), {
      target: { value: "Cache TTL" },
    });
    fireEvent.change(screen.getByLabelText("Attribute value"), {
      target: { value: "60s" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add attribute" }));
    expect(useDiagramStore.getState().nodes[0]?.data["metadata"]).toEqual({
      "Cache TTL": "60s",
    });
    fireEvent.change(screen.getByLabelText("Value for Cache TTL"), {
      target: { value: "120s" },
    });
    expect(useDiagramStore.getState().nodes[0]?.data["metadata"]).toEqual({
      "Cache TTL": "120s",
    });
    expect(diagramDataSchema.safeParse(useDiagramStore.getState().exportDiagram()).success).toBe(
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove Cache TTL" }));
    expect(useDiagramStore.getState().nodes[0]?.data["metadata"]).toEqual({});
  });

  it("applies supported node type changes", () => {
    render(<PropertiesPanel />);
    const select = screen
      .getAllByRole("combobox")
      .find((element) => element instanceof HTMLSelectElement && element.value === "service");
    if (!select) {
      throw new Error("Node type selector not rendered");
    }
    fireEvent.change(select, { target: { value: "database" } });
    expect(useDiagramStore.getState().nodes[0]?.data["type"]).toBe("database");
  });
});
