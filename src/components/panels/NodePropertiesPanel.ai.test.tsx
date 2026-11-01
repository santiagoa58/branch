import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
const CONDITION = "Writes outgrow a single primary";

const decision = {
  choice: "Postgres as the system of record",
  reason: "Relational data with strong consistency",
  benefits: [],
  drawbacks: [],
  considered: [],
  revisitWhen: [CONDITION, "  ", "Reads need global replicas"],
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
] as const)("%s inspector revisit conditions", (_name, node, renderPanel) => {
  it("shows Require this on revisit-when items only when a brief exists", () => {
    hydrate(node, null);
    const { unmount } = renderPanel();
    expect(screen.getByRole("textbox", { name: "Revisit when 1" })).toHaveValue(CONDITION);
    expect(screen.queryByRole("button", { name: /Require this/ })).toBeNull();
    unmount();

    hydrate(
      node,
      createBrief("Design a database", "backend", [], [], () => NEW_ID),
    );
    renderPanel();
    // The blank row has nothing to require.
    expect(screen.getAllByRole("button", { name: /Require this/ })).toHaveLength(2);
    expect(screen.getByRole("button", { name: `Require this: ${CONDITION}` })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Require this: Reads need global replicas" }),
    ).toBeVisible();
  });

  it("Require this adds the condition as a requirement line and marks it Required", () => {
    hydrate(
      node,
      createBrief("Design a database", "backend", [], [], () => NEW_ID),
    );
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: `Require this: ${CONDITION}` }));

    expect(useDiagramStore.getState().brief?.inputs.requirements).toEqual([
      { id: NEW_ID, kind: "functional", text: CONDITION },
    ]);
    expect(screen.queryByRole("button", { name: `Require this: ${CONDITION}` })).toBeNull();
    expect(screen.getAllByText("Required")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Require this: Reads need global replicas" }),
    ).toBeVisible();
  });

  it("shows Required for a condition already in the requirements, ignoring case and spacing", () => {
    hydrate(
      node,
      createBrief(
        "Design a database",
        "backend",
        [{ kind: "functional", text: `  ${CONDITION.toUpperCase()} ` }],
        [],
        () => NEW_ID,
      ),
    );
    renderPanel();

    expect(screen.getAllByText("Required")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: `Require this: ${CONDITION}` })).toBeNull();
    expect(requirementTexts()).toHaveLength(1);
  });
});

describe("Regenerate reasoning", () => {
  it("calls the pipeline for this node", () => {
    hydrate(
      serviceNode,
      createBrief("Design a database", "backend", [], [], () => NEW_ID),
    );
    renderNodePanel();

    fireEvent.click(screen.getByRole("button", { name: "Regenerate reasoning" }));

    expect(pipeline.regenerateDecision).toHaveBeenCalledExactlyOnceWith("db");
  });

  it("is hidden for diagrams without a brief", () => {
    hydrate(serviceNode, null);
    renderNodePanel();

    expect(screen.queryByRole("button", { name: "Regenerate reasoning" })).toBeNull();
  });

  it("is disabled while an AI run is in progress", () => {
    hydrate(
      serviceNode,
      createBrief("Design a database", "backend", [], [], () => NEW_ID),
    );
    useAiDesignStore.setState({ running: true });
    renderNodePanel();

    expect(screen.getByRole("button", { name: "Regenerate reasoning" })).toBeDisabled();
  });
});
