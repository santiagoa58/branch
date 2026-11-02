import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Node } from "@xyflow/react";
import type { DesignBrief } from "@/schemas/aiDesign";
import { cloudWorkspace } from "@/services/cloudWorkspace";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useDiagramStore } from "@/store/diagramStore";
import { createBrief } from "@/utils/aiDesign/inputs";
import { NodePropertiesPanel } from "./NodePropertiesPanel";
import type { InspectorTab } from "./InspectorTabs";
import { PropertiesPanel } from "./PropertiesPanel";

const pipeline = vi.hoisted(() => ({
  update: vi.fn<() => Promise<void>>(),
  regenerateDecision: vi.fn<(nodeId: string) => Promise<void>>(),
  generateDataModel: vi.fn<() => Promise<void>>(),
  retry: vi.fn<(stage: string) => Promise<void>>(),
  cancel: vi.fn<() => void>(),
}));
vi.mock("@/hooks/useDesignPipeline", () => ({ useDesignPipeline: () => pipeline }));

// The icon picker and Iconify loader have their own tests; inspector tests stay offline.
vi.mock("@iconify/react", () => ({ Icon: () => <svg aria-hidden="true" /> }));

const NEW_ID = "00000000-0000-4000-8000-000000000000";
const ASSUMPTION = "Writes fit on a single primary";

const decision = {
  choice: "Postgres as the system of record",
  reason: "Relational data with strong consistency",
  benefits: [],
  drawbacks: [],
  considered: [],
  revisitWhen: [ASSUMPTION, "  ", "Reads come from one region"],
};

const serviceNode: Node = {
  id: "db",
  type: "architecture",
  position: { x: 0, y: 0 },
  data: { label: "Database", type: "database", decision },
};
const groupNode: Node = {
  id: "region",
  type: "group",
  position: { x: 0, y: 0 },
  data: { label: "Region", groupType: "vpc", decision },
};

function hydrate(node: Node, brief: DesignBrief | null) {
  useDiagramStore.getState().hydrateDiagram({ nodes: [node], edges: [], ...(brief && { brief }) });
}

function requirementTexts(): string[] {
  return (useDiagramStore.getState().brief?.inputs.requirements ?? []).map((line) => line.text);
}

function renderNodePanel() {
  return render(
    <NodePropertiesPanel
      node={serviceNode}
      activeTab="design"
      onTabChange={vi.fn<(tab: InspectorTab) => void>()}
    />,
  );
}

function renderGroupPanel() {
  useDiagramStore.getState().setSelectedNode("region");
  return render(<PropertiesPanel />);
}

beforeEach(() => {
  useAiDesignStore.setState(useAiDesignStore.getInitialState());
  useDiagramStore.getState().resetDiagramState();
  vi.spyOn(cloudWorkspace, "schedule").mockImplementation(() => {});
  vi.spyOn(crypto, "randomUUID").mockReturnValue(NEW_ID);
  for (const fn of Object.values(pipeline)) {
    fn.mockReset();
  }
  pipeline.regenerateDecision.mockResolvedValue();
});

afterEach(() => {
  cleanup();
  useDiagramStore.getState().resetDiagramState();
  vi.restoreAllMocks();
});

describe.each([
  ["node", serviceNode, renderNodePanel],
  ["group", groupNode, renderGroupPanel],
] as const)("%s inspector decision assumptions", (_name, node, renderPanel) => {
  it("shows the items as assumptions with Make this a requirement only when a brief exists", () => {
    hydrate(node, null);
    const { unmount } = renderPanel();
    expect(screen.getByRole("textbox", { name: "Revisit when 1" })).toHaveValue(ASSUMPTION);
    expect(screen.queryByRole("button", { name: /Make this a requirement/ })).toBeNull();
    unmount();

    hydrate(
      node,
      createBrief("Design a database", "backend", [], [], () => NEW_ID),
    );
    renderPanel();
    expect(screen.getByRole("group", { name: "Assumes" })).toHaveAccessibleDescription(
      /Make one a requirement/,
    );
    expect(screen.getByRole("textbox", { name: "Assumes 1" })).toHaveValue(ASSUMPTION);
    // The blank row has nothing to make a requirement.
    expect(screen.getAllByRole("button", { name: /Make this a requirement/ })).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: `Make this a requirement: ${ASSUMPTION}` }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Make this a requirement: Reads come from one region" }),
    ).toBeVisible();
  });

  it("Make this a requirement adds the assumption as a requirement line and marks it Required", () => {
    hydrate(
      node,
      createBrief("Design a database", "backend", [], [], () => NEW_ID),
    );
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: `Make this a requirement: ${ASSUMPTION}` }));

    expect(useDiagramStore.getState().brief?.inputs.requirements).toEqual([
      { id: NEW_ID, kind: "functional", text: ASSUMPTION },
    ]);
    expect(
      screen.queryByRole("button", { name: `Make this a requirement: ${ASSUMPTION}` }),
    ).toBeNull();
    expect(screen.getAllByText("Required")).toHaveLength(1);
    // The button was replaced by the tag; focus moves there rather than falling to the page.
    expect(screen.getByText("Required")).toHaveFocus();
    expect(
      screen.getByRole("button", { name: "Make this a requirement: Reads come from one region" }),
    ).toBeVisible();
  });

  it("shows Required for an assumption already in the requirements, ignoring case and spacing", () => {
    hydrate(
      node,
      createBrief(
        "Design a database",
        "backend",
        [{ kind: "functional", text: `  ${ASSUMPTION.toUpperCase()} ` }],
        [],
        () => NEW_ID,
      ),
    );
    renderPanel();

    expect(screen.getAllByText("Required")).toHaveLength(1);
    expect(
      screen.queryByRole("button", { name: `Make this a requirement: ${ASSUMPTION}` }),
    ).toBeNull();
    expect(requirementTexts()).toHaveLength(1);
  });
});

describe.each([
  ["node", serviceNode, renderNodePanel],
  ["group", groupNode, renderGroupPanel],
] as const)("%s inspector Regenerate reasoning", (_name, node, renderPanel) => {
  it("calls the pipeline for this node", () => {
    hydrate(
      node,
      createBrief("Design a database", "backend", [], [], () => NEW_ID),
    );
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Regenerate reasoning" }));

    expect(pipeline.regenerateDecision).toHaveBeenCalledExactlyOnceWith(node.id);
  });

  it("is hidden for diagrams without a brief", () => {
    hydrate(node, null);
    renderPanel();

    expect(screen.queryByRole("button", { name: "Regenerate reasoning" })).toBeNull();
  });

  it("is disabled while an AI run is in progress", () => {
    hydrate(
      node,
      createBrief("Design a database", "backend", [], [], () => NEW_ID),
    );
    renderPanel();
    // Selection is locked during a run, so the run starts after the inspector is open.
    act(() => useAiDesignStore.setState({ running: true }));

    expect(screen.getByRole("button", { name: "Regenerate reasoning" })).toBeDisabled();
  });
});
