import type { Edge, InternalNode, Node, SetCenter } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DesignBrief } from "@/schemas/aiDesign";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useDiagramStore } from "@/store/diagramStore";
import { COMPACT_LAYOUT_QUERY, useUIStore } from "@/store/uiStore";
import { inputsFingerprint, resultFingerprint } from "@/utils/aiDesign/fingerprint";
import { ApiTab } from "./ApiTab";
import { DataModelTab } from "./DataModelTab";
import { DesignTab } from "./DesignTab";

const pipeline = vi.hoisted(() => ({
  update: vi.fn<() => Promise<void>>(),
  regenerateDecision: vi.fn<(nodeId: string) => Promise<void>>(),
  generateDataModel: vi.fn<() => Promise<void>>(),
  retry: vi.fn<(stage: string) => Promise<void>>(),
  cancel: vi.fn<() => void>(),
}));
vi.mock("@/hooks/useDesignPipeline", () => ({ useDesignPipeline: () => pipeline }));

// The React Flow instance the design panel reaches through the editor's provider.
const flow = vi.hoisted(() => ({
  setCenter: vi.fn<SetCenter>(),
  getZoom: () => 0.8,
  nodeLookup: new Map<string, InternalNode>(),
}));
vi.mock("@xyflow/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@xyflow/react")>()),
  useReactFlow: () => flow,
  useStoreApi: () => ({
    getState: () => ({ nodeLookup: flow.nodeLookup, width: 1200, height: 800 }),
  }),
}));

const nodes: Node[] = [
  {
    id: "lists",
    type: "architecture",
    position: { x: 0, y: 0 },
    data: {
      label: "Lists service",
      type: "service",
      decision: {
        choice: "Stateless HTTP service",
        reason: "Lists are read far more than written.",
        benefits: ["Scales horizontally"],
        drawbacks: ["Needs a shared cache"],
      },
    },
  },
  {
    id: "web",
    type: "architecture",
    position: { x: 0, y: 0 },
    data: { label: "Web app", type: "client" },
  },
  {
    id: "region",
    type: "group",
    position: { x: 0, y: 0 },
    data: {
      label: "EU region",
      groupType: "region",
      decision: {
        choice: "Single region",
        reason: "Users are in Europe.",
        benefits: ["Simple operations"],
        drawbacks: ["No failover elsewhere"],
      },
    },
  },
  {
    id: "db",
    type: "architecture",
    position: { x: 0, y: 0 },
    data: { label: "Lists database", type: "database" },
  },
];

const brief: DesignBrief = {
  inputs: {
    prompt: "A shared grocery list",
    scope: "fullstack",
    requirements: [],
    outOfScope: [],
    answers: [],
  },
  questions: [],
  requirements: [],
  assumptions: [],
  outOfScope: [],
  summary: "Households share lists that sync live.",
  api: {
    endpoints: [
      {
        key: "get-list",
        service: "lists",
        calledBy: ["web"],
        method: "GET",
        path: "/lists/{id}",
        summary: "Fetch one list with its items",
        auth: "user",
        style: "request",
        response: { id: "string", items: "Item[]" },
        errors: [
          { status: 401, when: "not signed in" },
          { status: 404, when: "no such list" },
        ],
      },
      {
        key: "add-item",
        service: "lists",
        calledBy: ["web", "ghost"],
        method: "POST",
        path: "/lists/{id}/items",
        summary: "Add an item",
        auth: "user",
        style: "request",
        request: { name: "string" },
        errors: [],
      },
      {
        key: "sync",
        service: "db",
        calledBy: ["lists"],
        method: "GET",
        path: "/sync",
        summary: "Stream changes",
        auth: "service",
        style: "stream",
        errors: [],
      },
    ],
    events: [
      {
        name: "item.changed",
        producer: "lists",
        consumers: ["web", "db"],
        payload: { listId: "string", checked: "boolean" },
      },
    ],
  },
  ranFrom: {},
};

function freshBrief(withModel: boolean): DesignBrief {
  const inputs = inputsFingerprint(brief.inputs);
  const result = resultFingerprint(brief, nodes, []);
  return {
    ...brief,
    ...(withModel
      ? {
          dataModel: {
            entities: [
              {
                name: "List",
                store: "db",
                fields: [
                  { name: "id", type: "uuid", key: "primary" },
                  { name: "title", type: "text" },
                ],
                relations: [{ to: "Item", kind: "one-to-many" }],
              },
            ],
          },
        }
      : {}),
    ranFrom: {
      requirements: inputs,
      components: inputs,
      decisions: result,
      api: result,
      dataModel: result,
    },
  };
}

function load(next: DesignBrief) {
  useDiagramStore.setState({ brief: next, nodes, edges: [] });
}

const highlighted = () => [...useAiDesignStore.getState().highlight].sort();

beforeEach(() => {
  useAiDesignStore.setState(useAiDesignStore.getInitialState());
  useDiagramStore.getState().resetDiagramState();
  for (const fn of Object.values(pipeline)) {
    fn.mockReset();
  }
  pipeline.generateDataModel.mockResolvedValue();
  flow.setCenter.mockReset().mockResolvedValue(true);
  flow.nodeLookup.clear();
});

afterEach(() => {
  cleanup();
});

describe("DesignTab", () => {
  it("lists every node with choice and tradeoffs, and selects on click", async () => {
    const user = userEvent.setup();
    load(brief);
    render(<DesignTab />);

    expect(screen.getByText("Households share lists that sync live.")).toBeVisible();
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(4);

    const lists = screen.getByRole("article", { name: "Lists service" });
    expect(lists).toHaveTextContent("Lists service · Service");
    expect(within(lists).getByText("Stateless HTTP service")).toBeVisible();
    expect(within(lists).getByText("Lists are read far more than written.")).toBeVisible();
    expect(
      within(within(lists).getByRole("region", { name: "Gains" })).getByText("Scales horizontally"),
    ).toBeVisible();
    expect(
      within(within(lists).getByRole("region", { name: "Costs" })).getByText(
        "Needs a shared cache",
      ),
    ).toBeVisible();
    // The tradeoff grid needs a container ancestor to lay out side by side.
    expect(lists).toHaveClass("@container");

    // Groups are listed too; a component without a decision says so.
    expect(screen.getByRole("article", { name: "EU region" })).toHaveTextContent("Single region");
    expect(screen.getByRole("article", { name: "Web app" })).toHaveTextContent(
      "No decision documented yet.",
    );

    await user.click(within(lists).getByRole("button", { name: /Show on canvas/ }));
    expect(useDiagramStore.getState().selectedNodeId).toBe("lists");
  });

  describe("Show on canvas", () => {
    // A selected client and connection, and a service nested two groups deep.
    const canvas: Node[] = [
      {
        id: "region",
        type: "group",
        position: { x: 100, y: 200 },
        data: { label: "EU region", groupType: "region" },
      },
      {
        id: "vpc",
        type: "group",
        parentId: "region",
        extent: "parent",
        position: { x: 20, y: 30 },
        data: { label: "Main VPC", groupType: "vpc" },
      },
      {
        id: "lists",
        type: "architecture",
        parentId: "vpc",
        extent: "parent",
        position: { x: 40, y: 60 },
        measured: { width: 160, height: 80 },
        data: { label: "Lists service", type: "service" },
      },
      {
        id: "web",
        type: "architecture",
        position: { x: 0, y: 0 },
        selected: true,
        data: { label: "Web app", type: "client" },
      },
    ];
    const edge: Edge = {
      id: "web-lists",
      source: "web",
      target: "lists",
      type: "architecture",
      selected: true,
      data: { protocol: "http" },
    };

    function mockScreen(queries: string[]) {
      vi.stubGlobal(
        "matchMedia",
        vi
          .fn<(query: string) => MediaQueryList>()
          .mockImplementation((query) => ({ matches: queries.includes(query) }) as MediaQueryList),
      );
    }

    beforeEach(() => {
      useUIStore.setState(useUIStore.getInitialState());
      useDiagramStore.setState({
        brief,
        nodes: canvas,
        edges: [edge],
        selectedEdgeId: "web-lists",
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      useUIStore.setState(useUIStore.getInitialState());
    });

    async function showOnCanvas(label: string) {
      const user = userEvent.setup();
      render(<DesignTab />);
      await user.click(
        within(screen.getByRole("article", { name: label })).getByRole("button", {
          name: /Show on canvas/,
        }),
      );
    }

    it("selects only that node, in the store and on the canvas", async () => {
      await showOnCanvas("Lists service");

      const state = useDiagramStore.getState();
      expect(state.selectedNodeId).toBe("lists");
      expect(state.selectedEdgeId).toBeNull();
      expect(state.nodes.filter((node) => node.selected).map((node) => node.id)).toEqual(["lists"]);
      expect(state.edges.find((entry) => entry.id === "web-lists")?.selected).toBe(false);
    });

    it("centers the view on the node's absolute position inside its groups", async () => {
      await showOnCanvas("Lists service");

      // region (100, 200) + vpc (20, 30) + lists (40, 60), plus half of 160 × 80.
      expect(flow.setCenter).toHaveBeenCalledExactlyOnceWith(240, 330, {
        zoom: 1.1,
        duration: 400,
      });
    });

    it("prefers React Flow's measured absolute position", async () => {
      const lists = canvas[2]!;
      flow.nodeLookup.set("lists", {
        ...lists,
        measured: { width: 200, height: 100 },
        internals: { positionAbsolute: { x: 500, y: 600 }, z: 0, userNode: lists },
      });
      await showOnCanvas("Lists service");

      expect(flow.setCenter).toHaveBeenCalledExactlyOnceWith(600, 650, {
        zoom: 1.1,
        duration: 400,
      });
    });

    it("jumps without animating when the viewer prefers reduced motion", async () => {
      mockScreen(["(prefers-reduced-motion: reduce)"]);
      await showOnCanvas("Lists service");

      expect(flow.setCenter).toHaveBeenCalledExactlyOnceWith(240, 330, {
        zoom: 1.1,
        duration: 0,
      });
    });

    it("hides the panels that cover the canvas on a compact screen", async () => {
      mockScreen([COMPACT_LAYOUT_QUERY]);
      useUIStore.setState({ leftPanelVisible: false, rightPanelVisible: false });
      useUIStore.getState().openDesignPanel();
      await showOnCanvas("Lists service");

      expect(useUIStore.getState()).toMatchObject({
        leftPanelVisible: false,
        rightPanelVisible: false,
      });
      expect(useDiagramStore.getState().selectedNodeId).toBe("lists");
    });

    it("keeps the panel beside the canvas on a wide screen", async () => {
      useUIStore.getState().openDesignPanel();
      await showOnCanvas("Lists service");

      expect(useUIStore.getState()).toMatchObject({
        rightPanelVisible: true,
        designPanelOpen: true,
      });
    });
  });

  it("explains that nothing is designed yet", () => {
    const { summary: _summary, ...withoutSummary } = brief;
    useDiagramStore.setState({ brief: withoutSummary, nodes: [], edges: [] });
    render(<DesignTab />);
    expect(
      screen.getByText("Components, their choices and tradeoffs appear here after an update."),
    ).toBeVisible();
  });
});

describe("ApiTab", () => {
  it("groups endpoints by service with method, path, auth, style, fields and errors", () => {
    load(brief);
    render(<ApiTab />);

    const lists = screen.getByRole("region", { name: "Lists service" });
    expect(lists).toHaveTextContent("Called by Web app");
    const get = within(lists).getByRole("article", { name: "GET /lists/{id}" });
    expect(within(get).getByText("GET")).toBeVisible();
    expect(within(get).getByText("/lists/{id}")).toBeVisible();
    expect(within(get).getByText("Fetch one list with its items")).toBeVisible();
    expect(within(get).getByText("auth: user")).toBeVisible();
    expect(within(get).getByText("request")).toBeVisible();
    expect(within(get).getByText("items: Item[]")).toBeVisible();
    expect(within(get).queryByText("Request")).not.toBeInTheDocument();
    expect(get).toHaveTextContent("Errors: 401 not signed in · 404 no such list");
    const add = within(lists).getByRole("article", { name: "POST /lists/{id}/items" });
    expect(within(add).getByText("name: string")).toBeVisible();

    // A second service gets its own group, named by its component's label.
    const db = screen.getByRole("region", { name: "Lists database" });
    expect(within(db).getByText("auth: service")).toBeVisible();
    expect(within(db).getByText("stream")).toBeVisible();
    expect(db).toHaveTextContent("Called by Lists service");

    const events = screen.getByRole("region", { name: "Events" });
    expect(within(events).getByText("item.changed")).toBeVisible();
    expect(events).toHaveTextContent("Lists service → Web app, Lists database");
    expect(events).toHaveTextContent("listId: string, checked: boolean");
  });

  it("flags endpoints with unknown components", () => {
    load(brief);
    render(<ApiTab />);
    const add = screen.getByRole("article", { name: "POST /lists/{id}/items" });
    expect(within(add).getByText("Unknown component")).toBeVisible();
    // The caller key stays readable when no component has it.
    expect(screen.getByRole("region", { name: "Lists service" })).toHaveTextContent("ghost");
    const get = screen.getByRole("article", { name: "GET /lists/{id}" });
    expect(within(get).queryByText("Unknown component")).not.toBeInTheDocument();
  });

  it("selecting an endpoint highlights its service and callers", async () => {
    const user = userEvent.setup();
    load(brief);
    const { unmount } = render(<ApiTab />);
    const get = screen.getByRole("button", { name: /GET \/lists\/\{id\}/ });
    const sync = screen.getByRole("button", { name: /GET \/sync/ });

    await user.click(get);
    expect(highlighted()).toEqual(["lists", "web"]);
    expect(get).toHaveAttribute("aria-pressed", "true");

    await user.click(sync);
    expect(highlighted()).toEqual(["db", "lists"]);
    expect(get).toHaveAttribute("aria-pressed", "false");

    await user.click(sync);
    expect(highlighted()).toEqual([]);

    // Leaving the tab clears the endpoint's highlight, but not an update's.
    await user.click(get);
    unmount();
    expect(highlighted()).toEqual([]);
    useAiDesignStore.getState().setHighlight(["web"]);
    render(<ApiTab />);
    cleanup();
    expect(highlighted()).toEqual(["web"]);
  });

  it("explains that no API exists yet", () => {
    const { api: _api, ...withoutApi } = brief;
    useDiagramStore.setState({ brief: withoutApi, nodes, edges: [] });
    render(<ApiTab />);
    expect(screen.getByText("Endpoints and events appear here after an update.")).toBeVisible();
  });
});

describe("DataModelTab", () => {
  it("offers Generate data model, then shows the entities", async () => {
    const user = userEvent.setup();
    load(freshBrief(false));
    render(<DataModelTab />);

    expect(screen.getByText("No data model yet")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Generate data model" }));
    expect(pipeline.generateDataModel).toHaveBeenCalledTimes(1);

    cleanup();
    load(freshBrief(true));
    render(<DataModelTab />);
    expect(screen.queryByText("No data model yet")).not.toBeInTheDocument();
    const entity = screen.getByRole("article", { name: "List" });
    expect(entity).toHaveTextContent("List");
    expect(entity).toHaveTextContent("in Lists database");
    expect(within(entity).getByText("id: uuid")).toBeVisible();
    expect(entity).toHaveTextContent("primary");
    expect(within(entity).getByText("title: text")).toBeVisible();
    expect(entity).toHaveTextContent("one-to-many → Item");
    // Up to date: nothing to regenerate.
    expect(screen.queryByText(/out of date/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Regenerate data model" })).not.toBeInTheDocument();
  });

  it("disables Generate data model until an update has designed the components", async () => {
    const user = userEvent.setup();
    const { components: _components, ...notDesigned } = freshBrief(false).ranFrom;
    load({ ...freshBrief(false), ranFrom: notDesigned });
    render(<DataModelTab />);

    const generate = screen.getByRole("button", { name: "Generate data model" });
    expect(generate).toBeDisabled();
    expect(generate).toHaveAccessibleDescription(
      "Available once an update has designed the components.",
    );
    await user.click(generate);
    expect(pipeline.generateDataModel).not.toHaveBeenCalled();

    // A components run that left no architecture nodes has nothing to model either.
    cleanup();
    useDiagramStore.setState({ brief: freshBrief(false), nodes: [], edges: [] });
    render(<DataModelTab />);
    expect(screen.getByRole("button", { name: "Generate data model" })).toBeDisabled();

    cleanup();
    load(freshBrief(false));
    render(<DataModelTab />);
    expect(screen.getByRole("button", { name: "Generate data model" })).toBeEnabled();
    expect(
      screen.queryByText("Available once an update has designed the components."),
    ).not.toBeInTheDocument();
  });

  it("shows an out-of-date notice with Regenerate when the graph changed", async () => {
    const user = userEvent.setup();
    load(freshBrief(true));
    useDiagramStore.setState({ nodes: [...nodes, { ...nodes[1]!, id: "cache" }] });
    render(<DataModelTab />);

    expect(screen.getByText(/out of date/i)).toBeVisible();
    expect(screen.getByRole("article", { name: "List" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Regenerate data model" }));
    expect(pipeline.generateDataModel).toHaveBeenCalledTimes(1);
  });
});
