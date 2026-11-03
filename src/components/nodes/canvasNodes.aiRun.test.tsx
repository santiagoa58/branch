import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReactFlowProvider, type NodeProps } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type {
  ArchitectureNode as ArchitectureFlowNode,
  CommentNode as CommentFlowNode,
  GroupNode as GroupFlowNode,
} from "@/types";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useDiagramStore } from "@/store/diagramStore";
import { ArchitectureNode } from "./ArchitectureNode";
import { CommentNode } from "./CommentNode";
import { GroupNode } from "./GroupNode";

vi.mock("@iconify/react", () => ({ Icon: () => <svg aria-hidden="true" /> }));
vi.mock("@/components/ui/IconPickerDialog", () => ({
  IconPickerDialog: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <dialog open aria-label="Choose component icon" /> : null,
}));

const base = {
  type: "architecture",
  selected: true,
  dragging: false,
  draggable: true,
  selectable: true,
  deletable: true,
  isConnectable: true,
  zIndex: 0,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
} as const;

function renderInFlow(element: React.ReactElement) {
  return render(<ReactFlowProvider>{element}</ReactFlowProvider>);
}

beforeEach(() => {
  useAiDesignStore.setState(useAiDesignStore.getInitialState());
  useAiDesignStore.getState().start("d1");
});

afterEach(() => {
  cleanup();
  useAiDesignStore.getState().cancel();
});

describe("canvas nodes during an AI run", () => {
  it("does not open the label editor or the icon picker on double-click", () => {
    const props: NodeProps<ArchitectureFlowNode> = {
      ...base,
      id: "api",
      data: { label: "API", type: "service" },
    };
    renderInFlow(<ArchitectureNode {...props} />);

    fireEvent.doubleClick(screen.getByText("API"));
    fireEvent.doubleClick(screen.getByTitle("Double-click to change icon"));

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => useAiDesignStore.getState().finish());
    fireEvent.doubleClick(screen.getByText("API"));
    expect(screen.getByRole("textbox")).toHaveValue("API");
  });

  it("hides a selected group's resizer and disables collapsing", () => {
    useDiagramStore.setState({ nodes: [] });
    const props: NodeProps<GroupFlowNode> = {
      ...base,
      type: "group",
      id: "vpc",
      data: { label: "Main VPC", groupType: "vpc", collapsed: false },
    };
    const { container } = renderInFlow(<GroupNode {...props} />);

    expect(container.querySelector(".react-flow__resize-control")).toBeNull();
    expect(screen.getByTitle("Collapse group")).toBeDisabled();

    act(() => useAiDesignStore.getState().finish());
    expect(container.querySelector(".react-flow__resize-control")).not.toBeNull();
    expect(screen.getByTitle("Collapse group")).toBeEnabled();
  });

  it("disables minimizing a comment", () => {
    const props: NodeProps<CommentFlowNode> = {
      ...base,
      type: "comment",
      id: "note",
      data: { text: "Check quotas", color: "yellow" },
    };
    renderInFlow(<CommentNode {...props} />);

    expect(screen.getByTitle("Minimize comment")).toBeDisabled();
  });
});
