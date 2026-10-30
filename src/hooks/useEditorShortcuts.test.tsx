import { StrictMode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { Node } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { CloudState } from "@/services/cloudPersistence";
import { cloudWorkspace } from "@/services/cloudWorkspace";
import { useAnimationStore } from "@/store/animationStore";
import { useDiagramStore } from "@/store/diagramStore";
import { useUIStore } from "@/store/uiStore";
import { useEditorShortcuts } from "./useEditorShortcuts";

type Actions = Parameters<typeof useEditorShortcuts>[0];

function createActions() {
  return {
    addNodeAtCenter: vi.fn<Actions["addNodeAtCenter"]>(),
    selectMode: vi.fn<Actions["selectMode"]>(),
    panMode: vi.fn<Actions["panMode"]>(),
    toggleLaser: vi.fn<Actions["toggleLaser"]>(),
    showShortcuts: vi.fn<Actions["showShortcuts"]>(),
    toggleSimulation: vi.fn<Actions["toggleSimulation"]>(),
    autoFormat: vi.fn<Actions["autoFormat"]>(),
    escape: vi.fn<Actions["escape"]>().mockReturnValue(false),
  } satisfies Actions;
}

function node(id: string, overrides: Partial<Node> = {}): Node {
  return {
    id,
    type: "architecture",
    position: { x: 100, y: 100 },
    data: { label: id, type: "service" },
    ...overrides,
  };
}

let cloud: CloudState;
let canvas: HTMLDivElement;

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = canvas) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function expectNoActions(actions: ReturnType<typeof createActions>) {
  for (const action of Object.values(actions)) {
    expect(action).not.toHaveBeenCalled();
  }
}

beforeEach(() => {
  useDiagramStore.setState(useDiagramStore.getInitialState());
  useAnimationStore.setState(useAnimationStore.getInitialState());
  useUIStore.setState(useUIStore.getInitialState());
  cloud = {
    diagram: null,
    status: "saved",
    dirty: false,
    locked: false,
    transitioning: false,
    message: null,
  };
  vi.spyOn(cloudWorkspace, "getState").mockImplementation(() => cloud);
  vi.spyOn(cloudWorkspace, "schedule").mockImplementation(() => {});
  useDiagramStore.setState({
    nodes: [node("api", { selected: true }), node("database")],
    edges: [{ id: "query", source: "api", target: "database", selected: true }],
    selectedNodeId: "api",
    selectedEdgeId: "query",
  });
  canvas = document.createElement("div");
  canvas.tabIndex = 0;
  document.body.append(canvas);
  canvas.focus();
  window.getSelection()?.removeAllRanges();
});

afterEach(() => {
  cleanup();
  window.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  useDiagramStore.setState(useDiagramStore.getInitialState());
  useAnimationStore.setState(useAnimationStore.getInitialState());
  useUIStore.setState(useUIStore.getInitialState());
});

describe("useEditorShortcuts command dispatch", () => {
  it("routes plain s and Shift+S to distinct actions exactly once", () => {
    const actions = createActions();
    renderHook(() => useEditorShortcuts(actions));

    expect(press("s").defaultPrevented).toBe(true);
    expect(actions.addNodeAtCenter).toHaveBeenCalledExactlyOnceWith("service");
    expect(actions.toggleSimulation).not.toHaveBeenCalled();
    expect(press("S", { shiftKey: true }).defaultPrevented).toBe(true);
    expect(actions.toggleSimulation).toHaveBeenCalledExactlyOnceWith();
    expect(actions.addNodeAtCenter).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["k", "secrets", "group-cluster"],
    ["r", "search", "group-region"],
    ["n", "comment", "group-subnet"],
  ])(
    "does not run the plain %s action when adding its shifted group",
    (key, plainType, groupType) => {
      const actions = createActions();
      renderHook(() => useEditorShortcuts(actions));

      expect(press(key).defaultPrevented).toBe(true);
      expect(press(key.toUpperCase(), { shiftKey: true }).defaultPrevented).toBe(true);
      expect(actions.addNodeAtCenter.mock.calls).toEqual([[plainType], [groupType]]);
      expect(actions.toggleSimulation).not.toHaveBeenCalled();
    },
  );

  it.each([{ ctrlKey: true }, { metaKey: true }])(
    "pastes the live clipboard rather than selecting for %j+V",
    (modifier) => {
      const actions = createActions();
      const paste = vi.spyOn(useDiagramStore.getState(), "pasteNodes");
      renderHook(() => useEditorShortcuts(actions));
      expect(press("v", modifier).defaultPrevented).toBe(false);
      expect(paste).not.toHaveBeenCalled();

      useDiagramStore.setState({ clipboard: { nodes: [node("copied")], edges: [] } });
      expect(press("v", modifier).defaultPrevented).toBe(true);

      expect(paste).toHaveBeenCalledExactlyOnceWith();
      expect(useDiagramStore.getState().nodes).toHaveLength(3);
      expect(useDiagramStore.getState().nodes.filter((item) => item.selected)).toEqual([
        expect.objectContaining({ data: { label: "copied", type: "service" } }),
      ]);
      expect(cloudWorkspace.schedule).toHaveBeenCalledTimes(1);
      expectNoActions(actions);
    },
  );

  it.each([{ ctrlKey: true }, { metaKey: true }])(
    "sends uppercase primary+Shift+Z only to redo for %j",
    (modifier) => {
      const actions = createActions();
      const undo = vi.spyOn(useDiagramStore.getState(), "undo").mockImplementation(() => {});
      const redo = vi.spyOn(useDiagramStore.getState(), "redo").mockImplementation(() => {});
      renderHook(() => useEditorShortcuts(actions));

      expect(press("Z", { ...modifier, shiftKey: true }).defaultPrevented).toBe(true);
      expect(redo).toHaveBeenCalledExactlyOnceWith();
      expect(undo).not.toHaveBeenCalled();
      expect(press("z", modifier).defaultPrevented).toBe(true);
      expect(undo).toHaveBeenCalledExactlyOnceWith();
      expect(redo).toHaveBeenCalledTimes(1);
      expectNoActions(actions);
    },
  );

  it("toggles each panel independently with brackets using current UI state", () => {
    const actions = createActions();
    renderHook(() => useEditorShortcuts(actions));

    expect(press("[").defaultPrevented).toBe(true);
    expect(useUIStore.getState()).toMatchObject({
      leftPanelVisible: false,
      rightPanelVisible: true,
    });
    expect(press("]").defaultPrevented).toBe(true);
    expect(useUIStore.getState()).toMatchObject({
      leftPanelVisible: false,
      rightPanelVisible: false,
    });
    useUIStore.setState({ leftPanelVisible: true });
    press("[");
    expect(useUIStore.getState().leftPanelVisible).toBe(false);
    expectNoActions(actions);
  });

  it("opens help for ? and uses the supplied auto-format callback for both primary modifiers", () => {
    const actions = createActions();
    const applyLayout = vi.spyOn(useDiagramStore.getState(), "applyAutoLayout");
    renderHook(() => useEditorShortcuts(actions));

    expect(press("?", { shiftKey: true }).defaultPrevented).toBe(true);
    expect(actions.showShortcuts).toHaveBeenCalledExactlyOnceWith();
    expect(press("l", { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(press("l", { metaKey: true }).defaultPrevented).toBe(true);
    expect(actions.autoFormat.mock.calls).toEqual([[], []]);
    expect(actions.addNodeAtCenter).not.toHaveBeenCalled();
    expect(applyLayout).not.toHaveBeenCalled();
  });

  it("dispatches selection, pan and laser tools and opens Spotlight without quick-adding a node", () => {
    const actions = createActions();
    renderHook(() => useEditorShortcuts(actions));

    expect(press("v").defaultPrevented).toBe(true);
    expect(press("h").defaultPrevented).toBe(true);
    expect(press("`").defaultPrevented).toBe(true);
    expect(actions.selectMode).toHaveBeenCalledExactlyOnceWith();
    expect(actions.panMode).toHaveBeenCalledExactlyOnceWith();
    expect(actions.toggleLaser).toHaveBeenCalledExactlyOnceWith();
    expect(press("k", { metaKey: true }).defaultPrevented).toBe(true);
    expect(useUIStore.getState().spotlightOpen).toBe(true);
    expect(actions.addNodeAtCenter).not.toHaveBeenCalled();
  });

  it.each([
    ["repeat", { repeat: true }],
    ["composition", { isComposing: true }],
    ["unmatched modifier", { altKey: true }],
  ] as const)("ignores a matching command during %s", (_name, init) => {
    const actions = createActions();
    const before = useDiagramStore.getState();
    renderHook(() => useEditorShortcuts(actions));
    expect(press("s", init).defaultPrevented).toBe(false);
    expect(useDiagramStore.getState()).toBe(before);
    expectNoActions(actions);
  });

  it("does not handle keys already consumed by a descendant", () => {
    const actions = createActions();
    canvas.addEventListener("keydown", (event) => event.preventDefault(), { once: true });
    renderHook(() => useEditorShortcuts(actions));
    expect(press("s").defaultPrevented).toBe(true);
    expectNoActions(actions);
  });

  it("leaves unrelated navigation, browser and native keys untouched", () => {
    const actions = createActions();
    const before = useDiagramStore.getState();
    renderHook(() => useEditorShortcuts(actions));
    for (const key of ["Tab", "Enter", " ", "ArrowLeft", "ArrowDown", "F5", "Home"]) {
      expect(press(key).defaultPrevented).toBe(false);
    }
    expect(press("s", { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(press("v", { ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(false);
    expect(useDiagramStore.getState()).toBe(before);
    expectNoActions(actions);
  });
});

describe("useEditorShortcuts editing and modal scopes", () => {
  it.each([
    ["input", "<input data-target />"],
    ["textarea", "<textarea data-target></textarea>"],
    ["select", "<select data-target><option>Choice</option></select>"],
    [
      "ancestor contenteditable",
      '<div contenteditable="true"><span tabindex="0" data-target>Text</span></div>',
    ],
    ["textbox", '<div role="textbox"><span tabindex="0" data-target>Text</span></div>'],
    ["combobox", '<div role="combobox"><span tabindex="0" data-target>Choice</span></div>'],
    ["CodeMirror", '<div class="cm-editor"><span tabindex="0" data-target>Code</span></div>'],
  ])("leaves editing and graph commands native within %s", (_name, markup) => {
    const actions = createActions();
    document.body.insertAdjacentHTML("beforeend", markup);
    const target = document.querySelector<HTMLElement>("[data-target]");
    if (!target) {
      throw new Error("Expected an editing target");
    }
    target.focus();
    const before = useDiagramStore.getState();
    const ui = useUIStore.getState();
    renderHook(() => useEditorShortcuts(actions));
    for (const [key, init] of [
      ["s", {}],
      ["Delete", {}],
      ["Backspace", {}],
      ["a", { ctrlKey: true }],
      ["c", { metaKey: true }],
      ["v", { ctrlKey: true }],
      ["z", { metaKey: true }],
      ["l", { ctrlKey: true }],
      ["[", {}],
      ["?", { shiftKey: true }],
    ] satisfies [string, KeyboardEventInit][]) {
      expect(press(key, init, target).defaultPrevented).toBe(false);
    }
    expect(useDiagramStore.getState()).toBe(before);
    expect(useUIStore.getState()).toBe(ui);
    expect(useAnimationStore.getState().pendingDeletions.size).toBe(0);
    expect(cloudWorkspace.schedule).not.toHaveBeenCalled();
    expectNoActions(actions);
  });

  it("uses the active editable element for a key dispatched at window", () => {
    const actions = createActions();
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    renderHook(() => useEditorShortcuts(actions));
    expect(press("s", {}, window).defaultPrevented).toBe(false);
    expectNoActions(actions);
    canvas.focus();
    expect(press("s", {}, window).defaultPrevented).toBe(true);
    expect(actions.addNodeAtCenter).toHaveBeenCalledExactlyOnceWith("service");
  });

  it.each([
    ["native dialog", "<dialog open></dialog>"],
    ["ARIA dialog", '<div role="dialog"></div>'],
    ["ARIA modal", '<div aria-modal="true"></div>'],
    ["shortcut blocker", '<div data-editor-shortcuts="blocked"></div>'],
  ])("blocks graph changes behind a %s even before focus leaves canvas", (_name, markup) => {
    const actions = createActions();
    renderHook(() => useEditorShortcuts(actions));
    document.body.insertAdjacentHTML("beforeend", markup);
    expect(document.activeElement).toBe(canvas);
    const before = useDiagramStore.getState();
    const ui = useUIStore.getState();
    for (const [key, init] of [
      ["s", {}],
      ["Delete", {}],
      ["a", { ctrlKey: true }],
      ["d", { metaKey: true }],
      ["z", { metaKey: true }],
      ["l", { ctrlKey: true }],
      ["k", { metaKey: true }],
      ["[", {}],
    ] satisfies [string, KeyboardEventInit][]) {
      expect(press(key, init).defaultPrevented).toBe(false);
    }
    expect(useDiagramStore.getState()).toBe(before);
    expect(useUIStore.getState()).toBe(ui);
    expect(useAnimationStore.getState().pendingDeletions.size).toBe(0);
    expect(cloudWorkspace.schedule).not.toHaveBeenCalled();
    expectNoActions(actions);
    expect(press("Escape").defaultPrevented).toBe(false);
    expect(actions.escape).toHaveBeenCalledExactlyOnceWith();
    expect(actions.selectMode).not.toHaveBeenCalled();
    expect(useDiagramStore.getState()).toBe(before);
  });

  it("allows commands again when a native dialog closes, without remounting", () => {
    const actions = createActions();
    const dialog = document.createElement("dialog");
    dialog.open = true;
    document.body.append(dialog);
    renderHook(() => useEditorShortcuts(actions));
    expect(press("s").defaultPrevented).toBe(false);
    dialog.open = false;
    expect(press("s").defaultPrevented).toBe(true);
    expect(actions.addNodeAtCenter).toHaveBeenCalledExactlyOnceWith("service");
  });

  it.each([true, false])(
    "offers Escape to owned overlays while editing (consumed=%s)",
    (consumed) => {
      const actions = createActions();
      actions.escape.mockReturnValue(consumed);
      const input = document.createElement("textarea");
      document.body.append(input);
      input.focus();
      const before = useDiagramStore.getState();
      renderHook(() => useEditorShortcuts(actions));

      expect(press("Escape", {}, input).defaultPrevented).toBe(consumed);
      expect(actions.escape).toHaveBeenCalledExactlyOnceWith();
      expect(actions.selectMode).not.toHaveBeenCalled();
      expect(useDiagramStore.getState()).toBe(before);
    },
  );

  it("can close an owned overlay even while a modal and cloud lock block graph commands", () => {
    const actions = createActions();
    actions.escape.mockReturnValue(true);
    document.body.insertAdjacentHTML("beforeend", '<div role="dialog"><input /></div>');
    cloud = { ...cloud, locked: true };
    const before = useDiagramStore.getState();
    renderHook(() => useEditorShortcuts(actions));
    expect(press("Escape").defaultPrevented).toBe(true);
    expect(actions.escape).toHaveBeenCalledExactlyOnceWith();
    expect(actions.selectMode).not.toHaveBeenCalled();
    expect(useDiagramStore.getState()).toBe(before);
  });

  it("closes Spotlight first on Escape without clearing graph selection or calling another overlay", () => {
    const actions = createActions();
    renderHook(() => useEditorShortcuts(actions));
    useUIStore.setState({ spotlightOpen: true });
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    const before = useDiagramStore.getState();
    expect(press("Escape", {}, input).defaultPrevented).toBe(true);
    expect(useUIStore.getState().spotlightOpen).toBe(false);
    expect(useDiagramStore.getState()).toBe(before);
    expectNoActions(actions);
  });

  it.each(["locked", "loading"] as const)(
    "reads live cloud %s state without needing a rerender",
    (reason) => {
      const actions = createActions();
      renderHook(() => useEditorShortcuts(actions));
      cloud = reason === "locked" ? { ...cloud, locked: true } : { ...cloud, status: "loading" };
      const before = useDiagramStore.getState();
      for (const [key, init] of [
        ["s", {}],
        ["Delete", {}],
        ["a", { metaKey: true }],
        ["d", { ctrlKey: true }],
        ["z", { metaKey: true }],
        ["l", { ctrlKey: true }],
      ] satisfies [string, KeyboardEventInit][]) {
        expect(press(key, init).defaultPrevented).toBe(false);
      }
      expect(useDiagramStore.getState()).toBe(before);
      expect(cloudWorkspace.schedule).not.toHaveBeenCalled();
      expectNoActions(actions);
      cloud = { ...cloud, locked: false, status: "saved" };
      expect(press("s").defaultPrevented).toBe(true);
      expect(actions.addNodeAtCenter).toHaveBeenCalledExactlyOnceWith("service");
    },
  );
});

describe("useEditorShortcuts graph selection and deletion", () => {
  it("copies selectedNodeId fallback through onNodesChange into the real clipboard", () => {
    const actions = createActions();
    useDiagramStore.setState({
      nodes: [node("api"), node("database")],
      selectedNodeId: "database",
    });
    const onNodesChange = vi.spyOn(useDiagramStore.getState(), "onNodesChange");
    const copy = vi.spyOn(useDiagramStore.getState(), "copySelectedNodes");
    renderHook(() => useEditorShortcuts(actions));

    expect(press("c", { metaKey: true }).defaultPrevented).toBe(true);

    expect(onNodesChange).toHaveBeenCalledExactlyOnceWith([
      { id: "database", type: "select", selected: true },
    ]);
    expect(copy).toHaveBeenCalledExactlyOnceWith();
    const { clipboard, nodes } = useDiagramStore.getState();
    expect(clipboard.nodes).toEqual([expect.objectContaining({ id: "database", selected: true })]);
    expect(clipboard.nodes[0]).not.toBe(nodes[1]);
    expect(clipboard.edges).toEqual([]);
    expect(cloudWorkspace.schedule).not.toHaveBeenCalled();
    expectNoActions(actions);
  });

  it("uses current multiselection rather than a stale selectedNodeId for copy and duplicate", () => {
    const actions = createActions();
    renderHook(() => useEditorShortcuts(actions));
    useDiagramStore.setState({
      nodes: [
        node("api"),
        node("database", { selected: true }),
        node("worker", { selected: true }),
      ],
      selectedNodeId: "api",
    });
    const duplicate = vi
      .spyOn(useDiagramStore.getState(), "duplicateNodes")
      .mockImplementation(() => {});
    expect(press("c", { ctrlKey: true }).defaultPrevented).toBe(true);
    expect(useDiagramStore.getState().clipboard.nodes.map((item) => item.id)).toEqual([
      "database",
      "worker",
    ]);
    expect(press("d", { metaKey: true }).defaultPrevented).toBe(true);
    expect(duplicate).toHaveBeenCalledExactlyOnceWith(["database", "worker"]);
    expect(actions.addNodeAtCenter).not.toHaveBeenCalled();
  });

  it("does not intercept native selected-text copy even while graph nodes are selected", () => {
    const actions = createActions();
    const text = document.createElement("p");
    text.textContent = "Copy this documentation";
    document.body.append(text);
    const range = document.createRange();
    range.selectNodeContents(text);
    window.getSelection()?.addRange(range);
    expect(window.getSelection()?.toString()).toBe("Copy this documentation");
    const before = useDiagramStore.getState();
    const copy = vi.spyOn(before, "copySelectedNodes");
    renderHook(() => useEditorShortcuts(actions));

    expect(press("c", { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(copy).not.toHaveBeenCalled();
    expect(useDiagramStore.getState()).toBe(before);
    expectNoActions(actions);
  });

  it.each(["Delete", "Backspace"])(
    "requests animated multideletion for %s and blocks further commands while pending",
    (key) => {
      const actions = createActions();
      useDiagramStore.setState({
        nodes: [node("api", { selected: true }), node("database", { selected: true })],
      });
      const request = vi.spyOn(useAnimationStore.getState(), "requestDeleteMultiple");
      const deleteNode = vi.spyOn(useDiagramStore.getState(), "deleteNode");
      const deleteSelected = vi.spyOn(useDiagramStore.getState(), "deleteSelectedNodes");
      const onEdgesChange = vi.spyOn(useDiagramStore.getState(), "onEdgesChange");
      renderHook(() => useEditorShortcuts(actions));
      const nodes = useDiagramStore.getState().nodes;

      expect(press(key).defaultPrevented).toBe(true);
      expect(request).toHaveBeenCalledExactlyOnceWith(["api", "database"]);
      expect(useAnimationStore.getState().pendingDeletions).toEqual(new Set(["api", "database"]));
      expect(useDiagramStore.getState().nodes).toBe(nodes);
      expect(deleteNode).not.toHaveBeenCalled();
      expect(deleteSelected).not.toHaveBeenCalled();
      expect(onEdgesChange).not.toHaveBeenCalled();
      expect(press(key).defaultPrevented).toBe(false);
      expect(press("s").defaultPrevented).toBe(false);
      expect(press("a", { ctrlKey: true }).defaultPrevented).toBe(false);
      expect(request).toHaveBeenCalledTimes(1);
      expect(cloudWorkspace.schedule).not.toHaveBeenCalled();
      expectNoActions(actions);
      useAnimationStore.setState({ pendingDeletions: new Set() });
      expect(press("s").defaultPrevented).toBe(true);
      expect(actions.addNodeAtCenter).toHaveBeenCalledExactlyOnceWith("service");
    },
  );

  it("also animates deletion when only selectedNodeId is set", () => {
    const actions = createActions();
    useDiagramStore.setState({
      nodes: [node("api"), node("database")],
      selectedNodeId: "database",
    });
    const request = vi.spyOn(useAnimationStore.getState(), "requestDeleteMultiple");
    renderHook(() => useEditorShortcuts(actions));
    expect(press("Delete").defaultPrevented).toBe(true);
    expect(request).toHaveBeenCalledExactlyOnceWith(["database"]);
  });

  it.each([true, false])(
    "removes a selected edge once through onEdgesChange (React Flow selected=%s)",
    (selected) => {
      const actions = createActions();
      useDiagramStore.setState({
        nodes: [node("api"), node("database")],
        selectedNodeId: null,
        edges: [{ id: "query", source: "api", target: "database", selected }],
        selectedEdgeId: "query",
      });
      const onEdgesChange = vi.spyOn(useDiagramStore.getState(), "onEdgesChange");
      const deleteEdge = vi.spyOn(useDiagramStore.getState(), "deleteEdge");
      const request = vi.spyOn(useAnimationStore.getState(), "requestDeleteMultiple");
      renderHook(() => useEditorShortcuts(actions));

      expect(press("Delete").defaultPrevented).toBe(true);
      expect(onEdgesChange).toHaveBeenCalledExactlyOnceWith([{ id: "query", type: "remove" }]);
      expect(useDiagramStore.getState().edges).toEqual([]);
      expect(useDiagramStore.getState().selectedEdgeId).toBeNull();
      expect(cloudWorkspace.schedule).toHaveBeenCalledTimes(1);
      expect(deleteEdge).not.toHaveBeenCalled();
      expect(request).not.toHaveBeenCalled();
      expect(press("Delete").defaultPrevented).toBe(false);
      expect(onEdgesChange).toHaveBeenCalledTimes(1);
      expect(cloudWorkspace.schedule).toHaveBeenCalledTimes(1);
    },
  );

  it("does not consume copy, paste or deletion without an actionable selection or clipboard", () => {
    const actions = createActions();
    useDiagramStore.setState({
      nodes: [node("api")],
      edges: [],
      selectedNodeId: null,
      selectedEdgeId: null,
    });
    const before = useDiagramStore.getState();
    renderHook(() => useEditorShortcuts(actions));
    expect(press("c", { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(press("v", { metaKey: true }).defaultPrevented).toBe(false);
    expect(press("Delete").defaultPrevented).toBe(false);
    expect(useDiagramStore.getState()).toBe(before);
    expectNoActions(actions);
  });

  it("selects only visible, selectable nodes and Escape clears both node and edge selection", () => {
    const actions = createActions();
    useDiagramStore.setState({
      nodes: [
        node("group", {
          type: "group",
          data: { label: "Cluster", type: "cluster", collapsed: true },
        }),
        node("hidden-child", { parentId: "group", extent: "parent", selected: true }),
        node("visible"),
        node("unselectable", { selectable: false, selected: true }),
      ],
      selectedNodeId: "hidden-child",
    });
    renderHook(() => useEditorShortcuts(actions));
    expect(press("a", { metaKey: true }).defaultPrevented).toBe(true);
    expect(
      useDiagramStore
        .getState()
        .nodes.filter((item) => item.selected)
        .map((item) => item.id),
    ).toEqual(["group", "visible"]);
    expect(useDiagramStore.getState().selectedNodeId).toBeNull();
    expect(useDiagramStore.getState().edges.every((edge) => !edge.selected)).toBe(true);

    useDiagramStore.setState({
      selectedNodeId: "visible",
      selectedEdgeId: "query",
      edges: [{ id: "query", source: "group", target: "visible", selected: true }],
    });
    expect(press("Escape").defaultPrevented).toBe(true);
    expect(actions.escape).toHaveBeenCalledExactlyOnceWith();
    expect(actions.selectMode).toHaveBeenCalledExactlyOnceWith();
    expect(useDiagramStore.getState()).toMatchObject({
      selectedNodeId: null,
      selectedEdgeId: null,
    });
    expect(useDiagramStore.getState().nodes.every((item) => !item.selected)).toBe(true);
    expect(useDiagramStore.getState().edges.every((edge) => !edge.selected)).toBe(true);
    expect(cloudWorkspace.schedule).not.toHaveBeenCalled();
  });

  it("does not delete an invisible collapsed child selected only through selectedNodeId", () => {
    const actions = createActions();
    useDiagramStore.setState({
      nodes: [
        node("group", {
          type: "group",
          data: { label: "Cluster", type: "cluster", collapsed: true },
        }),
        node("child", { parentId: "group", extent: "parent", selected: true }),
      ],
      selectedNodeId: "child",
      edges: [],
      selectedEdgeId: null,
    });
    renderHook(() => useEditorShortcuts(actions));
    expect(press("Delete").defaultPrevented).toBe(false);
    expect(press("c", { metaKey: true }).defaultPrevented).toBe(false);
    expect(useAnimationStore.getState().pendingDeletions.size).toBe(0);
    expect(useDiagramStore.getState().clipboard.nodes).toEqual([]);
  });
});

describe("useEditorShortcuts listener lifecycle", () => {
  it("uses rerendered callbacks without reattaching the keydown listener", () => {
    const original = createActions();
    const latest = createActions();
    latest.escape.mockReturnValue(true);
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { rerender, unmount } = renderHook((actions: Actions) => useEditorShortcuts(actions), {
      initialProps: original,
    });
    const registrations = add.mock.calls.filter(([type]) => type === "keydown");
    expect(registrations).toHaveLength(1);
    rerender(latest);

    press("s");
    press("l", { ctrlKey: true });
    press("Escape");
    expect(latest.addNodeAtCenter).toHaveBeenCalledExactlyOnceWith("service");
    expect(latest.autoFormat).toHaveBeenCalledExactlyOnceWith();
    expect(latest.escape).toHaveBeenCalledExactlyOnceWith();
    expect(latest.selectMode).not.toHaveBeenCalled();
    expectNoActions(original);
    expect(add.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(1);
    unmount();
    expect(remove.mock.calls.filter(([type]) => type === "keydown")).toEqual(registrations);
    expect(press("s").defaultPrevented).toBe(false);
    expect(latest.addNodeAtCenter).toHaveBeenCalledTimes(1);
  });

  it("keeps one effective listener through StrictMode remounts and cleans up on unmount", () => {
    const actions = createActions();
    const { unmount } = renderHook(() => useEditorShortcuts(actions), { wrapper: StrictMode });
    expect(press("s").defaultPrevented).toBe(true);
    expect(actions.addNodeAtCenter).toHaveBeenCalledExactlyOnceWith("service");
    unmount();
    expect(press("s").defaultPrevented).toBe(false);
    expect(actions.addNodeAtCenter).toHaveBeenCalledTimes(1);

    const remounted = renderHook(() => useEditorShortcuts(actions), { wrapper: StrictMode });
    expect(press("s").defaultPrevented).toBe(true);
    expect(actions.addNodeAtCenter).toHaveBeenCalledTimes(2);
    remounted.unmount();
    expect(press("s").defaultPrevented).toBe(false);
    expect(actions.addNodeAtCenter).toHaveBeenCalledTimes(2);
  });
});
