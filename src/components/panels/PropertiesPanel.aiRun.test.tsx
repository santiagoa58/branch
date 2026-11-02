import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { Edge, Node } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useDiagramStore } from "@/store/diagramStore";
import { PropertiesPanel } from "./PropertiesPanel";

vi.mock("@/components/ui/CodeEditor", () => ({
  CodeEditor: ({ value, readOnly }: { value: string; readOnly?: boolean }) => (
    <textarea aria-label="Contract schema editor" value={value} readOnly={readOnly} />
  ),
}));
vi.mock("@iconify/react", () => ({ Icon: () => <svg aria-hidden="true" /> }));
vi.mock("@/components/ui/IconPickerDialog", () => ({ IconPickerDialog: () => null }));
vi.mock("@/hooks/useDesignPipeline", () => ({
  useDesignPipeline: () => ({ regenerateDecision: vi.fn<(id: string) => Promise<void>>() }),
}));

const nodes: Node[] = [
  {
    id: "vpc",
    type: "group",
    position: { x: 0, y: 0 },
    style: { width: 300, height: 250 },
    data: { label: "Main VPC", groupType: "vpc" },
  },
  {
    id: "api",
    type: "architecture",
    parentId: "vpc",
    extent: "parent",
    position: { x: 20, y: 40 },
    data: { label: "API", type: "service", description: "Serves lists" },
  },
  {
    id: "note",
    type: "comment",
    position: { x: 400, y: 0 },
    data: { text: "Check quotas", color: "yellow" },
  },
  {
    id: "db",
    type: "architecture",
    position: { x: 400, y: 200 },
    data: { label: "Database", type: "database" },
  },
];
const edges: Edge[] = [
  {
    id: "api-db",
    source: "api",
    target: "db",
    type: "architecture",
    data: { protocol: "http", label: "Reads", dataContract: { format: "json", schema: "{}" } },
  },
];

/** Every control a viewer could change something with, by role. */
function editControls(panel: HTMLElement) {
  return [
    ...within(panel).queryAllByRole("textbox"),
    ...within(panel).queryAllByRole("combobox"),
    ...within(panel).queryAllByRole("switch"),
    ...within(panel).queryAllByRole("button", { name: /delete|icon|add|remove|regenerate/i }),
  ];
}

function inspector() {
  return screen.getAllByRole("complementary")[0]!;
}

beforeEach(() => {
  useAiDesignStore.setState(useAiDesignStore.getInitialState());
  useDiagramStore.setState({
    ...useDiagramStore.getInitialState(),
    nodes,
    edges,
    brief: {
      inputs: { prompt: "Lists", scope: "backend", requirements: [], outOfScope: [], answers: [] },
      questions: [],
      requirements: [],
      assumptions: [],
      outOfScope: [],
      ranFrom: {},
    },
  });
  useAiDesignStore.getState().start("d1");
});

afterEach(() => {
  cleanup();
  useAiDesignStore.getState().cancel();
});

describe("the inspector during an AI run", () => {
  it.each([
    ["a component", { selectedNodeId: "api" }, "Component"],
    ["a group", { selectedNodeId: "vpc" }, "Basics"],
    ["a comment", { selectedNodeId: "note" }, null],
    ["a connection", { selectedEdgeId: "api-db" }, "Basics"],
  ] as const)("opens %s read-only, and can still switch tabs and close", (_, selection, tab) => {
    useDiagramStore.setState(selection);
    render(<PropertiesPanel />);
    if (tab) {
      // Tabs only change what is shown, so they stay usable.
      fireEvent.click(within(inspector()).getByRole("button", { name: new RegExp(`^${tab}`) }));
    }

    const controls = editControls(inspector());
    expect(controls.length).toBeGreaterThan(0);
    for (const control of controls) {
      expect(control).toBeDisabled();
    }
    const close = within(inspector()).getAllByRole("button")[0]!;
    expect(close).toBeEnabled();
  });

  it("makes the connection's contract editor read-only", () => {
    useDiagramStore.setState({ selectedEdgeId: "api-db" });
    render(<PropertiesPanel />);
    fireEvent.click(within(inspector()).getByRole("button", { name: /^API/ }));
    expect(
      within(inspector()).getByRole("textbox", { name: "Contract schema editor" }),
    ).toHaveAttribute("readonly");
  });

  it("enables editing again when the run ends", () => {
    useDiagramStore.setState({ selectedNodeId: "api" });
    render(<PropertiesPanel />);
    fireEvent.click(within(inspector()).getByRole("button", { name: /^Component/ }));
    const name = within(inspector()).getByRole("textbox", { name: "Component name" });
    expect(name).toBeDisabled();

    act(() => useAiDesignStore.getState().finish());

    expect(name).toBeEnabled();
  });
});
