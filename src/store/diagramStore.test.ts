import { describe, it, expect, beforeEach, vi } from "vite-plus/test";
import { useDiagramStore } from "@/store/diagramStore";
import { useAnimationStore } from "@/store/animationStore";
import { useSimulationStore } from "@/store/simulationStore";
import { cloudWorkspace } from "@/services/cloudWorkspace";
import { applyGroupCollapse } from "@/utils/groupRollup";
import type { Node, Edge } from "@xyflow/react";

function itemAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`Expected item at index ${index}`);
  }
  return item;
}

// Reset store before each test
beforeEach(() => {
  useDiagramStore.setState({
    nodes: [],
    edges: [],
    selectedNodeId: null,
    selectedEdgeId: null,
    clipboard: { nodes: [], edges: [] },
    history: [],
    historyIndex: -1,
  });
  vi.clearAllMocks();
});

describe("diagramStore", () => {
  describe("Initial State", () => {
    it("should have empty initial state", () => {
      const state = useDiagramStore.getState();
      expect(state.nodes).toEqual([]);
      expect(state.edges).toEqual([]);
      expect(state.selectedNodeId).toBeNull();
      expect(state.selectedEdgeId).toBeNull();
      expect(state.clipboard.nodes).toEqual([]);
      expect(state.clipboard.edges).toEqual([]);
    });
  });

  describe("retired health monitoring", () => {
    it("has no health results or health actions", () => {
      const state = useDiagramStore.getState();
      for (const key of [
        "healthCheckResults",
        "runNodeHealthCheck",
        "runAllHealthChecks",
        "clearHealthResults",
        "getNodeHealthResult",
      ]) {
        expect(state).not.toHaveProperty(key);
      }
    });

    it("round trips deprecated document fields without issuing health requests", () => {
      const fetcher = vi.spyOn(globalThis, "fetch");
      try {
        const data = {
          nodes: [
            {
              id: "legacy",
              type: "architecture",
              position: { x: 0, y: 0 },
              data: {
                label: "Legacy service",
                type: "service",
                healthCheckUrl: "https://example.com/health",
                status: "warning",
                port: "3000",
                technology: "Node.js",
                tags: ["critical"],
                iconColor: "#123456",
                accentColor: "#234567",
                backgroundColor: "#345678",
              },
            },
          ],
          edges: [
            {
              id: "legacy-edge",
              source: "legacy",
              target: "legacy",
              data: { protocol: "http", tags: ["critical"] },
            },
          ],
          flows: [],
        };

        useDiagramStore.getState().hydrateDiagram(data);

        expect(useDiagramStore.getState().exportDiagram()).toEqual(data);
        expect(fetcher).not.toHaveBeenCalled();
      } finally {
        fetcher.mockRestore();
      }
    });
  });

  describe("resetDiagramState", () => {
    it("clears private document and ephemeral state without scheduling a save", () => {
      const schedule = vi.spyOn(cloudWorkspace, "schedule").mockImplementation(() => {});
      try {
        const node: Node = {
          id: "private",
          type: "architecture",
          position: { x: 0, y: 0 },
          data: { label: "Private", type: "service" },
        };
        const edge: Edge = { id: "private-edge", source: "private", target: "private" };
        useDiagramStore.setState({
          nodes: [node],
          edges: [edge],
          flows: [
            {
              id: "private-flow",
              name: "Private flow",
              sourceNodeId: "private",
              edgeIds: ["private-edge"],
              createdAt: "2026-10-30T12:00:00.000Z",
            },
          ],
          clipboard: { nodes: [node], edges: [edge] },
          selectedNodeId: node.id,
          selectedEdgeId: edge.id,
          history: [{ nodes: [node], edges: [edge] }],
          historyIndex: 0,
        });
        useSimulationStore.getState().setMode("failure");
        useSimulationStore.getState().toggleNodeFailure(node.id);
        useAnimationStore.setState({ pendingDeletions: new Set([node.id]) });

        useDiagramStore.getState().resetDiagramState();

        expect(useDiagramStore.getState()).toMatchObject({
          nodes: [],
          edges: [],
          flows: [],
          clipboard: { nodes: [], edges: [] },
          selectedNodeId: null,
          selectedEdgeId: null,
          history: [],
          historyIndex: -1,
        });
        expect(useSimulationStore.getState()).toMatchObject({ mode: "idle", failedNodeIds: [] });
        expect(useAnimationStore.getState().pendingDeletions.size).toBe(0);
        expect(schedule).not.toHaveBeenCalled();
      } finally {
        schedule.mockRestore();
        useDiagramStore.getState().resetDiagramState();
      }
    });
  });

  describe("Node Operations", () => {
    const createTestNode = (id: string, type = "architecture"): Node => ({
      id,
      type,
      position: { x: 100, y: 100 },
      data: { label: `Test Node ${id}`, type: "service" },
    });

    describe("addNode", () => {
      it("should add a node to the store", () => {
        const node = createTestNode("node-1");
        useDiagramStore.getState().addNode(node);

        const state = useDiagramStore.getState();
        expect(state.nodes).toHaveLength(1);
        expect(state.nodes[0]).toEqual(node);
      });

      it("should add multiple nodes", () => {
        const node1 = createTestNode("node-1");
        const node2 = createTestNode("node-2");

        useDiagramStore.getState().addNode(node1);
        useDiagramStore.getState().addNode(node2);

        const state = useDiagramStore.getState();
        expect(state.nodes).toHaveLength(2);
      });

      it("should save to history after adding node", () => {
        const node = createTestNode("node-1");
        useDiagramStore.getState().addNode(node);

        const state = useDiagramStore.getState();
        expect(state.history.length).toBeGreaterThan(0);
      });
    });

    describe("updateNodeData", () => {
      it("should update node data", () => {
        const node = createTestNode("node-1");
        useDiagramStore.getState().addNode(node);

        useDiagramStore.getState().updateNodeData("node-1", { label: "Updated Label" });

        const state = useDiagramStore.getState();
        expect(itemAt(state.nodes, 0).data["label"]).toBe("Updated Label");
      });

      it("should preserve existing data when updating", () => {
        const node = createTestNode("node-1");
        useDiagramStore.getState().addNode(node);

        useDiagramStore.getState().updateNodeData("node-1", { description: "New description" });

        const state = useDiagramStore.getState();
        expect(itemAt(state.nodes, 0).data["label"]).toBe("Test Node node-1");
        expect(itemAt(state.nodes, 0).data["description"]).toBe("New description");
      });

      it("should not modify other nodes", () => {
        const node1 = createTestNode("node-1");
        const node2 = createTestNode("node-2");
        useDiagramStore.getState().addNode(node1);
        useDiagramStore.getState().addNode(node2);

        useDiagramStore.getState().updateNodeData("node-1", { label: "Updated" });

        const state = useDiagramStore.getState();
        expect(itemAt(state.nodes, 1).data["label"]).toBe("Test Node node-2");
      });
    });

    describe("deleteNode", () => {
      it("should delete a node", () => {
        const node = createTestNode("node-1");
        useDiagramStore.getState().addNode(node);
        useDiagramStore.getState().deleteNode("node-1");

        const state = useDiagramStore.getState();
        expect(state.nodes).toHaveLength(0);
      });

      it("should delete connected edges when node is deleted", () => {
        const node1 = createTestNode("node-1");
        const node2 = createTestNode("node-2");
        useDiagramStore.setState({
          nodes: [node1, node2],
          edges: [{ id: "edge-1", source: "node-1", target: "node-2" }],
        });

        useDiagramStore.getState().deleteNode("node-1");

        const state = useDiagramStore.getState();
        expect(state.nodes).toHaveLength(1);
        expect(state.edges).toHaveLength(0);
      });

      it("should clear selectedNodeId if deleted node was selected", () => {
        const node = createTestNode("node-1");
        useDiagramStore.setState({
          nodes: [node],
          selectedNodeId: "node-1",
        });

        useDiagramStore.getState().deleteNode("node-1");

        const state = useDiagramStore.getState();
        expect(state.selectedNodeId).toBeNull();
      });
    });

    describe("deleteSelectedNodes", () => {
      it("should delete all selected nodes", () => {
        const node1 = { ...createTestNode("node-1"), selected: true };
        const node2 = { ...createTestNode("node-2"), selected: true };
        const node3 = { ...createTestNode("node-3"), selected: false };

        useDiagramStore.setState({ nodes: [node1, node2, node3] });
        useDiagramStore.getState().deleteSelectedNodes();

        const state = useDiagramStore.getState();
        expect(state.nodes).toHaveLength(1);
        expect(itemAt(state.nodes, 0).id).toBe("node-3");
      });

      it("should do nothing if no nodes are selected", () => {
        const node1 = { ...createTestNode("node-1"), selected: false };
        useDiagramStore.setState({ nodes: [node1] });

        useDiagramStore.getState().deleteSelectedNodes();

        const state = useDiagramStore.getState();
        expect(state.nodes).toHaveLength(1);
      });
    });
  });

  describe("Edge Operations", () => {
    const createTestNodes = (): Node[] => [
      {
        id: "node-1",
        type: "architecture",
        position: { x: 0, y: 0 },
        data: { label: "Node 1", type: "service" },
      },
      {
        id: "node-2",
        type: "architecture",
        position: { x: 200, y: 0 },
        data: { label: "Node 2", type: "database" },
      },
    ];

    describe("onConnect", () => {
      it("should create an edge when connecting nodes", () => {
        const nodes = createTestNodes();
        useDiagramStore.setState({ nodes });

        useDiagramStore.getState().onConnect({
          source: "node-1",
          target: "node-2",
          sourceHandle: null,
          targetHandle: null,
        });

        const state = useDiagramStore.getState();
        expect(state.edges).toHaveLength(1);
        expect(itemAt(state.edges, 0).source).toBe("node-1");
        expect(itemAt(state.edges, 0).target).toBe("node-2");
      });

      it("should set default protocol based on target node type", () => {
        const nodes = createTestNodes();
        useDiagramStore.setState({ nodes });

        useDiagramStore.getState().onConnect({
          source: "node-1",
          target: "node-2",
          sourceHandle: null,
          targetHandle: null,
        });

        const state = useDiagramStore.getState();
        // Database nodes default to 'sql' protocol
        expect(itemAt(state.edges, 0).data?.["protocol"]).toBe("sql");
      });
    });

    describe("updateEdgeData", () => {
      it("should update edge data", () => {
        useDiagramStore.setState({
          nodes: createTestNodes(),
          edges: [{ id: "edge-1", source: "node-1", target: "node-2", data: { protocol: "http" } }],
        });

        useDiagramStore.getState().updateEdgeData("edge-1", { protocol: "grpc" });

        const state = useDiagramStore.getState();
        expect(itemAt(state.edges, 0).data?.["protocol"]).toBe("grpc");
      });
    });

    describe("deleteEdge", () => {
      it("should delete an edge", () => {
        useDiagramStore.setState({
          nodes: createTestNodes(),
          edges: [{ id: "edge-1", source: "node-1", target: "node-2" }],
        });

        useDiagramStore.getState().deleteEdge("edge-1");

        const state = useDiagramStore.getState();
        expect(state.edges).toHaveLength(0);
      });

      it("should clear selectedEdgeId if deleted edge was selected", () => {
        useDiagramStore.setState({
          nodes: createTestNodes(),
          edges: [{ id: "edge-1", source: "node-1", target: "node-2" }],
          selectedEdgeId: "edge-1",
        });

        useDiagramStore.getState().deleteEdge("edge-1");

        const state = useDiagramStore.getState();
        expect(state.selectedEdgeId).toBeNull();
      });
    });
  });

  describe("Clipboard Operations", () => {
    const createTestNodes = (): Node[] => [
      {
        id: "node-1",
        type: "architecture",
        position: { x: 0, y: 0 },
        data: { label: "Node 1", type: "service" },
        selected: true,
      },
      {
        id: "node-2",
        type: "architecture",
        position: { x: 200, y: 0 },
        data: { label: "Node 2", type: "service" },
        selected: false,
      },
    ];

    describe("copySelectedNodes", () => {
      it("should copy selected nodes to clipboard", () => {
        useDiagramStore.setState({ nodes: createTestNodes() });
        useDiagramStore.getState().copySelectedNodes();

        const state = useDiagramStore.getState();
        expect(state.clipboard.nodes).toHaveLength(1);
        expect(itemAt(state.clipboard.nodes, 0).id).toBe("node-1");
      });

      it("should copy edges between selected nodes", () => {
        const nodes = [
          {
            id: "node-1",
            type: "architecture",
            position: { x: 0, y: 0 },
            data: { label: "Node 1" },
            selected: true,
          },
          {
            id: "node-2",
            type: "architecture",
            position: { x: 200, y: 0 },
            data: { label: "Node 2" },
            selected: true,
          },
        ];
        const edges = [{ id: "edge-1", source: "node-1", target: "node-2" }];

        useDiagramStore.setState({ nodes, edges });
        useDiagramStore.getState().copySelectedNodes();

        const state = useDiagramStore.getState();
        expect(state.clipboard.edges).toHaveLength(1);
      });

      it("should not copy edges to non-selected nodes", () => {
        const nodes = [
          {
            id: "node-1",
            type: "architecture",
            position: { x: 0, y: 0 },
            data: { label: "Node 1" },
            selected: true,
          },
          {
            id: "node-2",
            type: "architecture",
            position: { x: 200, y: 0 },
            data: { label: "Node 2" },
            selected: false,
          },
        ];
        const edges = [{ id: "edge-1", source: "node-1", target: "node-2" }];

        useDiagramStore.setState({ nodes, edges });
        useDiagramStore.getState().copySelectedNodes();

        const state = useDiagramStore.getState();
        expect(state.clipboard.edges).toHaveLength(0);
      });

      it("should do nothing if no nodes are selected", () => {
        const nodes = createTestNodes().map((n) => ({ ...n, selected: false }));
        useDiagramStore.setState({ nodes });
        useDiagramStore.getState().copySelectedNodes();

        const state = useDiagramStore.getState();
        expect(state.clipboard.nodes).toHaveLength(0);
      });
    });

    describe("pasteNodes", () => {
      it("should paste nodes from clipboard with new IDs", () => {
        const clipboard = {
          nodes: [
            {
              id: "node-1",
              type: "architecture",
              position: { x: 0, y: 0 },
              data: { label: "Node 1" },
            },
          ],
          edges: [],
        };
        useDiagramStore.setState({ clipboard });

        useDiagramStore.getState().pasteNodes();

        const state = useDiagramStore.getState();
        expect(state.nodes).toHaveLength(1);
        expect(itemAt(state.nodes, 0).id).not.toBe("node-1"); // New ID generated
      });

      it("should offset pasted nodes", () => {
        const clipboard = {
          nodes: [
            {
              id: "node-1",
              type: "architecture",
              position: { x: 100, y: 100 },
              data: { label: "Node 1" },
            },
          ],
          edges: [],
        };
        useDiagramStore.setState({ clipboard });

        useDiagramStore.getState().pasteNodes();

        const state = useDiagramStore.getState();
        expect(itemAt(state.nodes, 0).position.x).toBe(150); // 100 + 50 offset
        expect(itemAt(state.nodes, 0).position.y).toBe(150);
      });

      it("should select pasted nodes", () => {
        const clipboard = {
          nodes: [
            {
              id: "node-1",
              type: "architecture",
              position: { x: 0, y: 0 },
              data: { label: "Node 1" },
            },
          ],
          edges: [],
        };
        useDiagramStore.setState({ clipboard });

        useDiagramStore.getState().pasteNodes();

        const state = useDiagramStore.getState();
        expect(itemAt(state.nodes, 0).selected).toBe(true);
      });

      it("should do nothing if clipboard is empty", () => {
        useDiagramStore.setState({ clipboard: { nodes: [], edges: [] } });
        useDiagramStore.getState().pasteNodes();

        const state = useDiagramStore.getState();
        expect(state.nodes).toHaveLength(0);
      });
    });

    describe("hasClipboardContent", () => {
      it("should return true when clipboard has nodes", () => {
        useDiagramStore.setState({
          clipboard: {
            nodes: [{ id: "node-1", type: "architecture", position: { x: 0, y: 0 }, data: {} }],
            edges: [],
          },
        });

        expect(useDiagramStore.getState().hasClipboardContent()).toBe(true);
      });

      it("should return false when clipboard is empty", () => {
        useDiagramStore.setState({ clipboard: { nodes: [], edges: [] } });
        expect(useDiagramStore.getState().hasClipboardContent()).toBe(false);
      });
    });
  });

  describe("History (Undo/Redo)", () => {
    const createTestNode = (id: string): Node => ({
      id,
      type: "architecture",
      position: { x: 100, y: 100 },
      data: { label: `Node ${id}`, type: "service" },
    });

    describe("saveToHistory", () => {
      it("should save current state to history", () => {
        const node = createTestNode("node-1");
        useDiagramStore.setState({ nodes: [node], edges: [] });
        useDiagramStore.getState().saveToHistory();

        const state = useDiagramStore.getState();
        expect(state.history).toHaveLength(1);
        expect(state.historyIndex).toBe(0);
      });

      it("should trim history when exceeding MAX_HISTORY_LENGTH", () => {
        // Fill history with 50 states (MAX_HISTORY_LENGTH)
        for (let i = 0; i < 55; i++) {
          useDiagramStore.setState({
            nodes: [createTestNode(`node-${i}`)],
            history: useDiagramStore.getState().history,
            historyIndex: useDiagramStore.getState().historyIndex,
          });
          useDiagramStore.getState().saveToHistory();
        }

        const state = useDiagramStore.getState();
        expect(state.history.length).toBeLessThanOrEqual(50);
      });
    });

    describe("undo", () => {
      it("should restore previous state", () => {
        // Add first node and save
        useDiagramStore.setState({ nodes: [createTestNode("node-1")], edges: [] });
        useDiagramStore.getState().saveToHistory();

        // Add second node and save
        useDiagramStore.setState({
          nodes: [...useDiagramStore.getState().nodes, createTestNode("node-2")],
        });
        useDiagramStore.getState().saveToHistory();

        // Undo
        useDiagramStore.getState().undo();

        const state = useDiagramStore.getState();
        expect(state.nodes).toHaveLength(1);
        expect(itemAt(state.nodes, 0).id).toBe("node-1");
      });

      it("should not undo when at beginning of history", () => {
        useDiagramStore.setState({ nodes: [createTestNode("node-1")], edges: [] });
        useDiagramStore.getState().saveToHistory();

        const beforeState = useDiagramStore.getState();
        useDiagramStore.getState().undo();
        const afterState = useDiagramStore.getState();

        expect(afterState.historyIndex).toBe(beforeState.historyIndex);
      });
    });

    describe("redo", () => {
      it("should restore next state after undo", () => {
        // Setup history
        useDiagramStore.setState({ nodes: [createTestNode("node-1")], edges: [] });
        useDiagramStore.getState().saveToHistory();
        useDiagramStore.setState({
          nodes: [...useDiagramStore.getState().nodes, createTestNode("node-2")],
        });
        useDiagramStore.getState().saveToHistory();

        // Undo then redo
        useDiagramStore.getState().undo();
        useDiagramStore.getState().redo();

        const state = useDiagramStore.getState();
        expect(state.nodes).toHaveLength(2);
      });

      it("should not redo when at end of history", () => {
        useDiagramStore.setState({ nodes: [createTestNode("node-1")], edges: [] });
        useDiagramStore.getState().saveToHistory();

        const beforeState = useDiagramStore.getState();
        useDiagramStore.getState().redo();
        const afterState = useDiagramStore.getState();

        expect(afterState.historyIndex).toBe(beforeState.historyIndex);
      });
    });

    describe("canUndo / canRedo", () => {
      it("canUndo should return false when history is empty", () => {
        expect(useDiagramStore.getState().canUndo()).toBe(false);
      });

      it("canUndo should return true when there is history", () => {
        useDiagramStore.setState({ nodes: [createTestNode("node-1")], edges: [] });
        useDiagramStore.getState().saveToHistory();
        useDiagramStore.setState({ nodes: [createTestNode("node-2")], edges: [] });
        useDiagramStore.getState().saveToHistory();

        expect(useDiagramStore.getState().canUndo()).toBe(true);
      });

      it("canRedo should return false when at end of history", () => {
        useDiagramStore.setState({ nodes: [createTestNode("node-1")], edges: [] });
        useDiagramStore.getState().saveToHistory();

        expect(useDiagramStore.getState().canRedo()).toBe(false);
      });

      it("canRedo should return true after undo", () => {
        useDiagramStore.setState({ nodes: [createTestNode("node-1")], edges: [] });
        useDiagramStore.getState().saveToHistory();
        useDiagramStore.setState({ nodes: [createTestNode("node-2")], edges: [] });
        useDiagramStore.getState().saveToHistory();
        useDiagramStore.getState().undo();

        expect(useDiagramStore.getState().canRedo()).toBe(true);
      });
    });
  });

  describe("Selection", () => {
    describe("setSelectedNode", () => {
      it("should set selectedNodeId", () => {
        useDiagramStore.getState().setSelectedNode("node-1");
        expect(useDiagramStore.getState().selectedNodeId).toBe("node-1");
      });

      it("should clear selectedEdgeId when selecting a node", () => {
        useDiagramStore.setState({ selectedEdgeId: "edge-1" });
        useDiagramStore.getState().setSelectedNode("node-1");

        const state = useDiagramStore.getState();
        expect(state.selectedNodeId).toBe("node-1");
        expect(state.selectedEdgeId).toBeNull();
      });
    });

    describe("setSelectedEdge", () => {
      it("should set selectedEdgeId", () => {
        useDiagramStore.getState().setSelectedEdge("edge-1");
        expect(useDiagramStore.getState().selectedEdgeId).toBe("edge-1");
      });

      it("should clear selectedNodeId when selecting an edge", () => {
        useDiagramStore.setState({ selectedNodeId: "node-1" });
        useDiagramStore.getState().setSelectedEdge("edge-1");

        const state = useDiagramStore.getState();
        expect(state.selectedEdgeId).toBe("edge-1");
        expect(state.selectedNodeId).toBeNull();
      });
    });
  });

  describe("Group Operations", () => {
    const createGroupNode = (id: string): Node => ({
      id,
      type: "group",
      position: { x: 0, y: 0 },
      data: { label: "Test Group", groupType: "vpc", collapsed: false },
      style: { width: 300, height: 250 },
    });

    const createChildNode = (id: string, parentId: string): Node => ({
      id,
      type: "architecture",
      position: { x: 50, y: 50 },
      data: { label: "Child Node", type: "service", parentId },
      parentId,
      extent: "parent",
    });

    describe("toggleGroupCollapse", () => {
      it("should toggle collapsed state", () => {
        const group = createGroupNode("group-1");
        const child = createChildNode("node-1", "group-1");

        useDiagramStore.setState({ nodes: [group, child], edges: [] });
        useDiagramStore.getState().toggleGroupCollapse("group-1");

        const state = useDiagramStore.getState();
        const updatedGroup = state.nodes.find((n) => n.id === "group-1");
        expect(updatedGroup?.data["collapsed"]).toBe(true);
      });

      it("should hide child nodes in the derived display graph when collapsing", () => {
        const group = createGroupNode("group-1");
        const child = createChildNode("node-1", "group-1");

        useDiagramStore.setState({ nodes: [group, child], edges: [] });
        useDiagramStore.getState().toggleGroupCollapse("group-1");

        const state = useDiagramStore.getState();
        const { displayNodes } = applyGroupCollapse(state.nodes, state.edges);
        expect(displayNodes.find((n) => n.id === "node-1")?.hidden).toBe(true);
      });

      it("should show child nodes in the derived display graph when expanding", () => {
        const group = {
          ...createGroupNode("group-1"),
          data: { ...createGroupNode("group-1").data, collapsed: true },
        };
        const child = { ...createChildNode("node-1", "group-1"), hidden: true };

        useDiagramStore.setState({ nodes: [group, child], edges: [] });
        useDiagramStore.getState().toggleGroupCollapse("group-1");

        const state = useDiagramStore.getState();
        const { displayNodes } = applyGroupCollapse(state.nodes, state.edges);
        expect(displayNodes.find((n) => n.id === "node-1")?.hidden).toBe(false);
      });
    });

    describe("addNodeToGroup", () => {
      it("should add node to group", () => {
        const group = createGroupNode("group-1");
        const node: Node = {
          id: "node-1",
          type: "architecture",
          position: { x: 500, y: 500 },
          data: { label: "Test Node", type: "service" },
        };

        useDiagramStore.setState({ nodes: [group, node], edges: [] });
        useDiagramStore.getState().addNodeToGroup("node-1", "group-1");

        const state = useDiagramStore.getState();
        const updatedNode = state.nodes.find((n) => n.id === "node-1");
        expect(updatedNode?.parentId).toBe("group-1");
        expect(updatedNode?.data["parentId"]).toBe("group-1");
      });

      it("should nest a group into another group, moving its whole subtree after the new parent", () => {
        const inner = { ...createGroupNode("group-inner"), position: { x: 500, y: 500 } };
        const innerChild = createChildNode("node-1", "group-inner");
        const outer = { ...createGroupNode("group-outer"), style: { width: 900, height: 700 } };

        // inner + its child come BEFORE outer in the array on purpose
        useDiagramStore.setState({ nodes: [inner, innerChild, outer], edges: [] });
        useDiagramStore.getState().addNodeToGroup("group-inner", "group-outer", { x: 100, y: 100 });

        const state = useDiagramStore.getState();
        const updatedInner = state.nodes.find((n) => n.id === "group-inner");
        expect(updatedInner?.parentId).toBe("group-outer");
        expect(updatedInner?.extent).toBe("parent");

        // React Flow requires parents before children: outer < inner < inner's child
        const order = state.nodes.map((n) => n.id);
        expect(order.indexOf("group-outer")).toBeLessThan(order.indexOf("group-inner"));
        expect(order.indexOf("group-inner")).toBeLessThan(order.indexOf("node-1"));

        // The grandchild must keep its parent (and its relative position is untouched)
        const grandchild = state.nodes.find((n) => n.id === "node-1");
        expect(grandchild?.parentId).toBe("group-inner");
        expect(grandchild?.position).toEqual({ x: 50, y: 50 });
      });
    });

    describe("removeNodeFromGroup", () => {
      it("should remove node from group", () => {
        const group = createGroupNode("group-1");
        const child = createChildNode("node-1", "group-1");

        useDiagramStore.setState({ nodes: [group, child], edges: [] });
        useDiagramStore.getState().removeNodeFromGroup("node-1");

        const state = useDiagramStore.getState();
        const updatedNode = state.nodes.find((n) => n.id === "node-1");
        expect(updatedNode?.parentId).toBeUndefined();
        expect(updatedNode?.data["parentId"]).toBeUndefined();
      });
    });
  });

  describe("Diagram Import/Export", () => {
    describe("exportDiagram", () => {
      it("should return current diagram data", () => {
        const nodes: Node[] = [
          {
            id: "node-1",
            type: "architecture",
            position: { x: 0, y: 0 },
            data: { label: "Test", type: "service" },
          },
        ];
        const edges: Edge[] = [];

        useDiagramStore.setState({ nodes, edges });
        const exported = useDiagramStore.getState().exportDiagram();

        expect(exported.nodes).toEqual(nodes);
        expect(exported.edges).toEqual(edges);
      });
    });

    describe("importDiagram", () => {
      it("should replace current diagram with imported data", () => {
        useDiagramStore.setState({
          nodes: [{ id: "old-node", type: "architecture", position: { x: 0, y: 0 }, data: {} }],
          edges: [],
        });

        const importData = {
          nodes: [
            {
              id: "new-node",
              type: "architecture",
              position: { x: 100, y: 100 },
              data: { label: "Imported", type: "service" as const },
            },
          ],
          edges: [],
        };

        useDiagramStore.getState().importDiagram(importData);

        const state = useDiagramStore.getState();
        expect(state.nodes).toHaveLength(1);
        expect(itemAt(state.nodes, 0).id).toBe("new-node");
      });

      it("should clear selection after import", () => {
        useDiagramStore.setState({ selectedNodeId: "old-node", selectedEdgeId: "old-edge" });

        useDiagramStore.getState().importDiagram({ nodes: [], edges: [] });

        const state = useDiagramStore.getState();
        expect(state.selectedNodeId).toBeNull();
        expect(state.selectedEdgeId).toBeNull();
      });
    });

    describe("clearDiagram", () => {
      it("should clear all nodes and edges", () => {
        useDiagramStore.setState({
          nodes: [{ id: "node-1", type: "architecture", position: { x: 0, y: 0 }, data: {} }],
          edges: [{ id: "edge-1", source: "node-1", target: "node-2" }],
        });

        useDiagramStore.getState().clearDiagram();

        const state = useDiagramStore.getState();
        expect(state.nodes).toHaveLength(0);
        expect(state.edges).toHaveLength(0);
      });
    });
  });

  describe("duplicateNodes", () => {
    it("should duplicate selected nodes with new IDs", () => {
      const node: Node = {
        id: "node-1",
        type: "architecture",
        position: { x: 100, y: 100 },
        data: { label: "Test", type: "service" },
      };

      useDiagramStore.setState({ nodes: [node], edges: [] });
      useDiagramStore.getState().duplicateNodes(["node-1"]);

      const state = useDiagramStore.getState();
      expect(state.nodes).toHaveLength(2);
      expect(state.nodes.some((n) => n.id !== "node-1")).toBe(true);
    });

    it("should offset duplicated nodes", () => {
      const node: Node = {
        id: "node-1",
        type: "architecture",
        position: { x: 100, y: 100 },
        data: { label: "Test", type: "service" },
      };

      useDiagramStore.setState({ nodes: [node], edges: [] });
      useDiagramStore.getState().duplicateNodes(["node-1"]);

      const state = useDiagramStore.getState();
      const duplicatedNode = state.nodes.find((n) => n.id !== "node-1");
      expect(duplicatedNode?.position.x).toBe(150);
      expect(duplicatedNode?.position.y).toBe(150);
    });

    it("should duplicate edges between duplicated nodes", () => {
      const nodes: Node[] = [
        { id: "node-1", type: "architecture", position: { x: 0, y: 0 }, data: { label: "Node 1" } },
        {
          id: "node-2",
          type: "architecture",
          position: { x: 200, y: 0 },
          data: { label: "Node 2" },
        },
      ];
      const edges: Edge[] = [{ id: "edge-1", source: "node-1", target: "node-2" }];

      useDiagramStore.setState({ nodes, edges });
      useDiagramStore.getState().duplicateNodes(["node-1", "node-2"]);

      const state = useDiagramStore.getState();
      expect(state.edges.length).toBeGreaterThan(1);
    });

    it("should include group children when duplicating a group", () => {
      const group: Node = {
        id: "group-1",
        type: "group",
        position: { x: 0, y: 0 },
        data: { label: "Group", groupType: "vpc" },
      };
      const child: Node = {
        id: "child-1",
        type: "architecture",
        position: { x: 50, y: 50 },
        data: { label: "Child", type: "service" },
        parentId: "group-1",
      };

      useDiagramStore.setState({ nodes: [group, child], edges: [] });
      useDiagramStore.getState().duplicateNodes(["group-1"]);

      const state = useDiagramStore.getState();
      // Should have original group, original child, duplicated group, duplicated child
      expect(state.nodes).toHaveLength(4);
    });
  });
});
