import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { cloudWorkspace } from "@/services/cloudWorkspace";
import { useDiagramStore } from "@/store/diagramStore";
import { diagramDataSchema } from "@/schemas/diagram";
import { PropertiesPanel } from "./PropertiesPanel";

vi.mock("@/components/ui/CodeEditor", () => ({
  CodeEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea
      aria-label="Contract schema editor"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

// The picker and SVG loader have their own tests; inspector tests must stay offline.
vi.mock("@iconify/react", () => ({ Icon: () => <svg aria-hidden="true" /> }));
vi.mock("@/components/ui/IconPickerDialog", () => ({
  IconPickerDialog: ({
    isOpen,
    onSelect,
    onClose,
  }: {
    isOpen: boolean;
    onSelect: (icon: string) => void;
    onClose: () => void;
  }) =>
    isOpen ? (
      <dialog open aria-label="Choose component icon">
        <button
          type="button"
          onClick={() => {
            onSelect("logos:postgresql");
            onClose();
          }}
        >
          PostgreSQL
        </button>
      </dialog>
    ) : null,
}));

const decision = {
  choice: "Cache frequent reads in Redis",
  reason: "Reduce database load",
  benefits: ["Fewer database reads"],
  drawbacks: ["Potential stale reads"],
  considered: [{ option: "Read replicas", whyNot: "More operational work" }],
  revisitWhen: ["Reads must be strongly consistent"],
};
// Each entry is the accessible name of an input and the value it holds for `decision`.
const decisionInputs = [
  ["Chosen approach", decision.choice],
  ["Why", decision.reason],
  ["Benefits 1", "Fewer database reads"],
  ["Drawbacks 1", "Potential stale reads"],
  ["Option 1", "Read replicas"],
  ["Why not option 1", "More operational work"],
  ["Revisit when 1", "Reads must be strongly consistent"],
] as const;
const addButtons = ["Add benefit", "Add drawback", "Add option", "Add revisit trigger"];

function fillDecision() {
  for (const name of addButtons) {
    fireEvent.click(screen.getByRole("button", { name }));
  }
  for (const [name, value] of decisionInputs) {
    fireEvent.change(screen.getByRole("textbox", { name }), { target: { value } });
  }
}

function expectDecisionInputs() {
  for (const [name, value] of decisionInputs) {
    expect(screen.getByRole("textbox", { name })).toHaveValue(value);
  }
}
const legacyFields = {
  status: "warning",
  healthCheckUrl: "https://example.com/retired-health",
  port: "8080",
  technology: "Legacy runtime",
  tags: ["retired-tag"],
  iconColor: "#123456",
  accentColor: "#234567",
  backgroundColor: "#345678",
};

function chooseSection(name: string) {
  fireEvent.click(screen.getByRole("button", { name }));
  expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "true");
}

function addAttribute(name: string, value: string, unit = "") {
  fireEvent.change(screen.getByLabelText("Attribute name"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Attribute value"), { target: { value } });
  fireEvent.change(screen.getByLabelText("Attribute unit"), { target: { value: unit } });
  fireEvent.click(screen.getByRole("button", { name: "Add attribute" }));
}

function selectEdge() {
  useDiagramStore.setState({
    selectedNodeId: null,
    selectedEdgeId: "edge",
    edges: [{ id: "edge", source: "s", target: "s", data: { protocol: "http" } }],
  });
}

beforeEach(() => {
  useDiagramStore.getState().resetDiagramState();
  vi.spyOn(cloudWorkspace, "getState").mockReturnValue({
    diagram: null,
    status: "saved",
    dirty: false,
    locked: false,
    transitioning: false,
    message: null,
  });
  vi.spyOn(cloudWorkspace, "schedule").mockImplementation(() => {});
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected network request"));
  useDiagramStore.getState().hydrateDiagram({
    nodes: [
      {
        id: "s",
        type: "architecture",
        position: { x: 0, y: 0 },
        data: { label: "API", type: "service" },
      },
    ],
    edges: [],
  });
  useDiagramStore.getState().setSelectedNode("s");
});

afterEach(() => {
  cleanup();
  useDiagramStore.getState().resetDiagramState();
  const requests = vi.mocked(globalThis.fetch).mock.calls;
  vi.restoreAllMocks();
  // oxlint-disable-next-line vitest/no-standalone-expect -- Enforce offline behavior for every test, including cleanup.
  expect(requests).toHaveLength(0);
});

describe("node properties", () => {
  it("opens directly on Decision with reasoning and unit-aware attributes", () => {
    render(<PropertiesPanel />);
    expect(screen.getByRole("button", { name: "Decision" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    for (const name of ["Chosen approach", "Why"]) {
      expect(screen.getByRole("textbox", { name })).toBeVisible();
    }
    for (const name of addButtons) {
      expect(screen.getByRole("button", { name })).toBeVisible();
    }
    for (const label of ["Attribute name", "Attribute value", "Attribute unit"]) {
      expect(screen.getByLabelText(label)).toBeVisible();
    }
    expect(screen.queryByLabelText("Component name")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Why" })).not.toBeInTheDocument();
  });

  it("keeps valid state when the DOM supplies an unsupported component type", () => {
    render(<PropertiesPanel />);
    chooseSection("Component");
    const select = screen.getByLabelText<HTMLSelectElement>("Component type");
    select.add(new Option("Unsupported", "unsupported"));
    fireEvent.change(select, { target: { value: "unsupported" } });
    expect(useDiagramStore.getState().nodes[0]?.data["type"]).toBe("service");
    expect(cloudWorkspace.schedule).not.toHaveBeenCalled();
    expect(() => useDiagramStore.getState().exportDiagram()).not.toThrow();
  });

  it("edits component name, supported type, and responsibility without changing tabs", () => {
    render(<PropertiesPanel />);
    chooseSection("Component");
    fireEvent.change(screen.getByLabelText("Component name"), {
      target: { value: "Orders database" },
    });
    fireEvent.change(screen.getByLabelText("Component type"), { target: { value: "database" } });
    fireEvent.change(screen.getByLabelText("Responsibility"), {
      target: { value: "Own order records" },
    });
    expect(useDiagramStore.getState().nodes[0]?.data).toMatchObject({
      label: "Orders database",
      type: "database",
      description: "Own order records",
    });
    expect(screen.getByRole("heading", { name: "Orders database" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Component" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(cloudWorkspace.schedule).toHaveBeenLastCalledWith(
      useDiagramStore.getState().exportDiagram(),
    );
  });

  it("preserves the chosen approach across tab changes and resets a new selection to Decision", () => {
    useDiagramStore.setState((state) => ({
      nodes: [
        ...state.nodes,
        {
          id: "second",
          type: "architecture",
          position: { x: 200, y: 0 },
          data: { label: "Database", type: "database", decision: { choice: "Use Postgres" } },
        },
      ],
    }));
    render(<PropertiesPanel />);
    fireEvent.change(screen.getByLabelText("Chosen approach"), {
      target: { value: decision.choice },
    });
    chooseSection("Component");
    fireEvent.change(screen.getByLabelText("Component name"), { target: { value: "Read API" } });
    expect(screen.getByRole("button", { name: "Component" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    chooseSection("Decision");
    expect(screen.getByLabelText("Chosen approach")).toHaveValue(decision.choice);
    chooseSection("Component");

    act(() => useDiagramStore.getState().setSelectedNode("second"));
    expect(screen.getByRole("button", { name: "Decision" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Chosen approach")).toHaveValue("Use Postgres");
    expect(screen.queryByLabelText("Component name")).not.toBeInTheDocument();
    expect(useDiagramStore.getState().nodes[0]?.data).toMatchObject({
      label: "Read API",
      decision: { choice: decision.choice },
    });
  });

  it("edits and removes structured attributes with separate values and units", () => {
    render(<PropertiesPanel />);
    addAttribute("Cache TTL", "60", "s");
    expect(useDiagramStore.getState().nodes[0]?.data).toMatchObject({
      attributes: [{ name: "Cache TTL", value: "60", unit: "s" }],
      metadata: {},
    });
    fireEvent.change(screen.getByLabelText("Value for Cache TTL"), { target: { value: "120" } });
    fireEvent.change(screen.getByLabelText("Unit for Cache TTL"), { target: { value: "ms" } });
    addAttribute("Eviction policy", "LRU");
    expect(useDiagramStore.getState().nodes[0]?.data["attributes"]).toEqual([
      { name: "Cache TTL", value: "120", unit: "ms" },
      { name: "Eviction policy", value: "LRU" },
    ]);
    expect(screen.getByLabelText("Attribute name")).toHaveValue("");
    expect(screen.getByLabelText("Attribute value")).toHaveValue("");
    expect(screen.getByLabelText("Attribute unit")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Remove Cache TTL" }));
    expect(screen.queryByLabelText("Value for Cache TTL")).not.toBeInTheDocument();
    expect(useDiagramStore.getState().nodes[0]?.data["attributes"]).toEqual([
      { name: "Eviction policy", value: "LRU" },
    ]);
  });

  it("requires units for new numeric attributes and preserves valid state on invalid edits", () => {
    render(<PropertiesPanel />);
    addAttribute("Replicas", "3");
    expect(screen.getByRole("alert")).toHaveTextContent("Choose an explicit unit");
    expect(useDiagramStore.getState().nodes[0]?.data["attributes"]).toBeUndefined();
    expect(cloudWorkspace.schedule).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Attribute unit"), { target: { value: "replicas" } });
    fireEvent.click(screen.getByRole("button", { name: "Add attribute" }));
    fireEvent.change(screen.getByLabelText("Unit for Replicas"), { target: { value: "" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Choose an explicit unit");
    expect(screen.getByLabelText("Unit for Replicas")).toHaveAttribute("aria-invalid", "true");
    expect(useDiagramStore.getState().nodes[0]?.data["attributes"]).toEqual([
      { name: "Replicas", value: "3", unit: "replicas" },
    ]);
    fireEvent.change(screen.getByLabelText("Unit for Replicas"), { target: { value: "count" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(useDiagramStore.getState().nodes[0]?.data["attributes"]).toEqual([
      { name: "Replicas", value: "3", unit: "count" },
    ]);
  });

  it("preserves reasoning, choice and units in save snapshots, undo/redo, and schema round trips", () => {
    render(<PropertiesPanel />);
    fillDecision();
    addAttribute("Cache TTL", "60", "s");
    fireEvent.change(screen.getByLabelText("Unit for Cache TTL"), { target: { value: "ms" } });
    expect(useDiagramStore.getState().canUndo()).toBe(true);
    act(() => useDiagramStore.getState().undo());
    expect(screen.getByLabelText("Unit for Cache TTL")).toHaveValue("s");
    expect(useDiagramStore.getState().nodes[0]?.data["decision"]).toEqual(decision);
    act(() => useDiagramStore.getState().redo());
    expect(screen.getByLabelText("Unit for Cache TTL")).toHaveValue("ms");

    const exported = useDiagramStore.getState().exportDiagram();
    const roundTripped = diagramDataSchema.parse(JSON.parse(JSON.stringify(exported)));
    expect(roundTripped).toEqual(exported);
    expect(roundTripped.nodes[0]?.data).toMatchObject({
      decision,
      attributes: [{ name: "Cache TTL", value: "60", unit: "ms" }],
    });
    expect(cloudWorkspace.schedule).toHaveBeenLastCalledWith(roundTripped);
    act(() => {
      useDiagramStore.getState().hydrateDiagram(roundTripped);
      useDiagramStore.getState().setSelectedNode("s");
    });
    expectDecisionInputs();
    expect(screen.getByLabelText("Value for Cache TTL")).toHaveValue("60");
    expect(screen.getByLabelText("Unit for Cache TTL")).toHaveValue("ms");
  });

  it("records chosen-approach edits in undo history", () => {
    render(<PropertiesPanel />);
    fireEvent.change(screen.getByLabelText("Chosen approach"), { target: { value: "Redis" } });
    fireEvent.change(screen.getByLabelText("Chosen approach"), { target: { value: "Postgres" } });
    act(() => useDiagramStore.getState().undo());
    expect(screen.getByLabelText("Chosen approach")).toHaveValue("Redis");
    act(() => useDiagramStore.getState().redo());
    expect(screen.getByLabelText("Chosen approach")).toHaveValue("Postgres");
  });

  it.each(["Decision", "Component", "More"])(
    "omits retired monitoring, badges, raw Iconify IDs and color controls from %s",
    (section) => {
      useDiagramStore.setState((state) => ({
        nodes: state.nodes.map((node) => ({
          ...node,
          data: { ...node.data, ...legacyFields, iconifyIcon: "logos:postgresql" },
        })),
      }));
      const { container } = render(<PropertiesPanel />);
      chooseSection(section);
      const retiredControl =
        /status|health|port|technology|tags?|accent|background|iconify|colou?r/i;
      expect(screen.queryByLabelText(retiredControl)).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText(retiredControl)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: retiredControl })).not.toBeInTheDocument();
      expect(
        screen.queryByText(
          /^(status|health check|port|technology|tags|accent|background|icon color)$/i,
        ),
      ).not.toBeInTheDocument();
      expect(container.querySelector('input[type="color"]')).not.toBeInTheDocument();
      for (const value of [
        legacyFields.status,
        legacyFields.healthCheckUrl,
        legacyFields.port,
        legacyFields.technology,
        ...legacyFields.tags,
        legacyFields.iconColor,
        legacyFields.accentColor,
        legacyFields.backgroundColor,
        "logos:postgresql",
      ]) {
        expect(screen.queryByDisplayValue(value)).not.toBeInTheDocument();
        expect(screen.queryByText(value, { exact: true })).not.toBeInTheDocument();
      }
    },
  );

  it("chooses a custom icon by human-friendly name and can reset to the default", () => {
    useDiagramStore.setState((state) => ({
      nodes: state.nodes.map((node) => ({ ...node, data: { ...node.data, iconColor: "#123456" } })),
    }));
    render(<PropertiesPanel />);
    chooseSection("Component");
    const iconSection = within(screen.getByRole("region", { name: "Component icon" }));
    expect(iconSection.getByText("Default service icon")).toBeVisible();
    expect(iconSection.queryByRole("button", { name: "Use default icon" })).not.toBeInTheDocument();
    fireEvent.click(iconSection.getByRole("button", { name: "Choose icon" }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Choose component icon" })).getByRole("button", {
        name: "PostgreSQL",
      }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(iconSection.getByText("PostgreSQL")).toBeVisible();
    expect(screen.queryByText("logos:postgresql")).not.toBeInTheDocument();
    expect(useDiagramStore.getState().nodes[0]?.data).toMatchObject({
      iconifyIcon: "logos:postgresql",
      iconColor: "",
    });
    expect(iconSection.getByRole("button", { name: "Change icon" })).toBeVisible();
    fireEvent.click(iconSection.getByRole("button", { name: "Use default icon" }));
    expect(iconSection.getByText("Default service icon")).toBeVisible();
    expect(iconSection.getByRole("button", { name: "Choose icon" })).toBeVisible();
    expect(useDiagramStore.getState().nodes[0]?.data).toMatchObject({
      iconifyIcon: "",
      iconColor: "",
    });
  });
});

describe("group and connection properties", () => {
  it("defaults groups to Decision and retains reasoning without color controls on any tab", () => {
    useDiagramStore.getState().hydrateDiagram({
      nodes: [
        {
          id: "group",
          type: "group",
          position: { x: 0, y: 0 },
          data: {
            label: "Private network",
            groupType: "vpc",
            color: "blue",
            accentColor: "#234567",
            backgroundColor: "#345678",
          },
        },
      ],
      edges: [],
    });
    useDiagramStore.getState().setSelectedNode("group");
    const { container } = render(<PropertiesPanel />);
    expect(screen.getByRole("button", { name: "Decision" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Chosen approach")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Chosen approach"), {
      target: { value: "Isolate private workloads" },
    });
    for (const section of ["Basics", "More", "Decision"]) {
      chooseSection(section);
      expect(screen.queryByLabelText(/colou?r|accent|background/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/^(color|accent|background)( color)?$/i)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /colou?r|accent|background/i }),
      ).not.toBeInTheDocument();
      expect(container.querySelector('input[type="color"]')).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue("#234567")).not.toBeInTheDocument();
      expect(screen.queryByDisplayValue("#345678")).not.toBeInTheDocument();
    }
    expect(screen.getByLabelText("Chosen approach")).toHaveValue("Isolate private workloads");
    expect(useDiagramStore.getState().nodes[0]?.data["decision"]).toEqual({
      choice: "Isolate private workloads",
    });
  });

  it("uses theme-aware text for edge flow labels and hints", () => {
    selectEdge();
    render(<PropertiesPanel />);
    expect(screen.getByRole("button", { name: "Basics" })).toHaveAttribute("aria-pressed", "true");
    for (const label of ["Animated Flow", "Fire & Forget", "Two-way Flow"]) {
      expect(screen.getByText(label)).toHaveClass("text-foreground");
      expect(screen.getByText(label)).toBeVisible();
    }
    for (const hint of ["Show data passing", "Non-blocking call", "Request/Response"]) {
      expect(screen.getByText(hint)).toHaveClass("text-muted-foreground");
    }
  });

  it("retains connection reasoning alongside separate request and response contracts", () => {
    selectEdge();
    render(<PropertiesPanel />);
    chooseSection("Decision");
    fillDecision();
    chooseSection("API");
    expect(screen.getByText("Data Contract")).toBeVisible();
    fireEvent.change(screen.getByPlaceholderText("e.g., TaskCreatedEvent"), {
      target: { value: "ReadRequest" },
    });
    fireEvent.change(screen.getByLabelText("Contract schema editor"), {
      target: { value: '{"id":"string"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Response" }));
    fireEvent.change(screen.getByPlaceholderText("e.g., TaskCreatedResponse"), {
      target: { value: "ReadResponse" },
    });
    fireEvent.change(screen.getByLabelText("Contract schema editor"), {
      target: { value: '{"result":"string"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Request" }));
    expect(screen.getByPlaceholderText("e.g., TaskCreatedEvent")).toHaveValue("ReadRequest");
    expect(screen.getByLabelText("Contract schema editor")).toHaveValue('{"id":"string"}');
    chooseSection("Decision");
    expectDecisionInputs();
    expect(useDiagramStore.getState().edges[0]?.data).toMatchObject({
      decision,
      dataContract: { format: "json", schemaName: "ReadRequest", schema: '{"id":"string"}' },
      responseContract: {
        format: "json",
        schemaName: "ReadResponse",
        schema: '{"result":"string"}',
      },
    });
    expect(diagramDataSchema.safeParse(useDiagramStore.getState().exportDiagram()).success).toBe(
      true,
    );
  });
});
