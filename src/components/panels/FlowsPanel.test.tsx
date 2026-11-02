import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { cloudWorkspace } from "@/services/cloudWorkspace";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useDiagramStore } from "@/store/diagramStore";
import type { NamedFlow } from "@/types/simulation";
import { FlowsPanel } from "./FlowsPanel";

const flows: NamedFlow[] = [
  {
    id: "checkout",
    name: "Checkout",
    sourceNodeId: "api",
    createdAt: "2026-01-01T00:00:00.000Z",
    color: "#3b82f6",
    speed: 1,
  },
  {
    id: "refund",
    name: "Refund",
    sourceNodeId: "api",
    createdAt: "2026-01-02T00:00:00.000Z",
    color: "#ef4444",
    speed: 1,
  },
];

beforeEach(() => {
  useAiDesignStore.setState(useAiDesignStore.getInitialState());
  cloudWorkspace.reset();
  useDiagramStore.setState({
    ...useDiagramStore.getInitialState(),
    nodes: [
      {
        id: "api",
        type: "architecture",
        position: { x: 0, y: 0 },
        data: { label: "API", type: "service" },
      },
    ],
    flows,
    saveDiagram: vi.fn<() => void>(),
  });
});

afterEach(() => {
  cleanup();
  cloudWorkspace.reset();
  useDiagramStore.setState(useDiagramStore.getInitialState());
  vi.restoreAllMocks();
});

describe("saved-flow deletion", () => {
  it("does not delete before confirmation or when cancelled", async () => {
    const user = userEvent.setup();
    render(<FlowsPanel />);
    await user.click(screen.getByRole("button", { name: "Delete flow: Checkout" }));
    const dialog = screen.getByRole("dialog", { name: "Delete saved flow?" });
    expect(dialog).toHaveTextContent("Checkout");
    expect(useDiagramStore.getState().flows).toEqual(flows);

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Delete saved flow?" })).not.toBeInTheDocument();
    expect(useDiagramStore.getState().flows).toEqual(flows);
  });

  it("deletes only the selected saved flow after explicit confirmation", async () => {
    const user = userEvent.setup();
    render(<FlowsPanel />);
    await user.click(screen.getByRole("button", { name: "Delete flow: Refund" }));
    expect(useDiagramStore.getState().flows).toHaveLength(2);
    const dialog = screen.getByRole("dialog", { name: "Delete saved flow?" });
    expect(dialog).toHaveTextContent('Delete "Refund"?');
    await user.click(within(dialog).getByRole("button", { name: "Delete flow" }));
    expect(useDiagramStore.getState().flows.map((flow) => flow.id)).toEqual(["checkout"]);
    expect(screen.queryByRole("dialog", { name: "Delete saved flow?" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete flow: Checkout" })).toBeVisible();
  });

  it("cancels with Escape without deleting the flow", async () => {
    const user = userEvent.setup();
    render(<FlowsPanel />);
    await user.click(screen.getByRole("button", { name: "Delete flow: Checkout" }));
    await user.keyboard("{Escape}");
    expect(useDiagramStore.getState().flows).toEqual(flows);
    expect(screen.queryByRole("dialog", { name: "Delete saved flow?" })).not.toBeInTheDocument();
  });
});
