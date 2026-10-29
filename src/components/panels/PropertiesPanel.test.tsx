import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { useDiagramStore } from "@/store/diagramStore";
import { PropertiesPanel } from "./PropertiesPanel";

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
