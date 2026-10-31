import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { GROUP_TYPES_CONFIG, NODE_TYPES_CONFIG } from "@/constants";
import { NodePalette } from "./NodePalette";
import { useUIStore } from "@/store/uiStore";

afterEach(cleanup);

describe("architecture node palette", () => {
  it("exposes every configured architecture node", () => {
    const { container } = render(<NodePalette />);
    expect(container.querySelectorAll('[draggable="true"]')).toHaveLength(
      // Every node type, every group type, and the comment note.
      Object.keys(NODE_TYPES_CONFIG).length + Object.keys(GROUP_TYPES_CONFIG).length + 1,
    );
    for (const config of Object.values(NODE_TYPES_CONFIG)) {
      expect(screen.getAllByText(config.label).length).toBeGreaterThan(0);
    }
  });

  it("finds nodes by description and technology keywords", () => {
    render(<NodePalette />);
    const input = screen.getByPlaceholderText("Search components...");
    fireEvent.change(input, { target: { value: "  Zustand  " } });
    expect(screen.getByText(NODE_TYPES_CONFIG.statestore.label)).toBeTruthy();
    expect(screen.queryByText(NODE_TYPES_CONFIG.database.label)).toBeNull();
  });

  it("uses the existing drag payload for new node types without inventing shortcuts", () => {
    render(<NodePalette />);
    const node = screen.getByText(NODE_TYPES_CONFIG.agent.label).closest('[draggable="true"]');
    if (!node) {
      throw new Error("AI agent palette entry missing");
    }
    expect(node.querySelector("kbd")).toBeNull();
    const payload = new Map<string, string>();
    const dataTransfer = {
      setData: (type: string, value: string) => payload.set(type, value),
      effectAllowed: "none",
    };
    fireEvent.dragStart(node, { dataTransfer });
    expect(payload.get("application/reactflow")).toBe("agent");
    expect(dataTransfer.effectAllowed).toBe("move");
  });

  it("adds a component by click or tap, since touch screens can't drag", () => {
    render(<NodePalette />);
    fireEvent.click(screen.getByRole("button", { name: "Add Relational Database" }));
    expect(useUIStore.getState().pendingPaletteAdd).toBe("database");
    fireEvent.click(screen.getByRole("button", { name: "Add Shard" }));
    expect(useUIStore.getState().pendingPaletteAdd).toBe("group-shard");
    useUIStore.setState({ pendingPaletteAdd: null });
  });
});
