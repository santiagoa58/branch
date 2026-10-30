import { create } from "zustand";
import {
  Connection,
  EdgeChange,
  NodeChange,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Node,
  Edge,
} from "@xyflow/react";
import { ArchitectureNodeData, ArchitectureEdgeData, GroupNodeData, DiagramData } from "@/types";
import type { NamedFlow } from "@/types/simulation";
import { useAnimationStore } from "@/store/animationStore";
import { useSimulationStore } from "@/store/simulationStore";
import { traceFlowPath } from "@/utils/graphTraversal";
import { getDefaultProtocolForNode, MAX_HISTORY_LENGTH } from "@/constants";
import { autoLayoutDiagram } from "@/utils/layout";
import { checkHealth, HealthCheckResult } from "@/services/healthCheck";
import { cloudWorkspace, setDiagramHydrator } from "@/services/cloudWorkspace";
import { diagramDataSchema } from "@/schemas/diagram";

// Undefined explicitly removes a field; persisted schemas still require core fields.
type DataPatch<T> = { [K in keyof T]?: T[K] | undefined };

function mergeDataPatch(data: Record<string, unknown>, patch: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries({ ...data, ...patch }).filter(([, value]) => value !== undefined),
  );
}

interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

interface ClipboardState {
  nodes: Node[];
  edges: Edge[];
}

interface HealthCheckResults {
  [nodeId: string]: HealthCheckResult & { timestamp: number; loading?: boolean };
}

interface DiagramStore {
  // State
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;

  /** Saved playable flow scenarios. Persisted with the diagram. */
  flows: NamedFlow[];

  // Clipboard
  clipboard: ClipboardState;

  // History
  history: HistoryState[];
  historyIndex: number;

  // Health check (transient state, not persisted)
  healthCheckResults: HealthCheckResults;

  // Actions
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  addNode: (node: Node) => void;
  updateNodeData: (id: string, data: DataPatch<ArchitectureNodeData>) => void;
  deleteNode: (id: string) => void;
  duplicateNodes: (nodeIds: string[]) => void;
  deleteSelectedNodes: () => void;

  // Clipboard actions
  copySelectedNodes: () => void;
  pasteNodes: (position?: { x: number; y: number }) => void;
  hasClipboardContent: () => boolean;

  // Group actions
  updateGroupData: (id: string, data: DataPatch<GroupNodeData>) => void;
  toggleGroupCollapse: (id: string) => void;
  addNodeToGroup: (
    nodeId: string,
    groupId: string,
    relativePosition?: { x: number; y: number },
  ) => void;
  removeNodeFromGroup: (nodeId: string) => void;
  bringNodeToFront: (id: string) => void;
  sendNodeToBack: (id: string) => void;

  updateEdgeData: (id: string, data: DataPatch<ArchitectureEdgeData>) => void;
  deleteEdge: (id: string) => void;

  setSelectedNode: (id: string | null) => void;
  setSelectedEdge: (id: string | null) => void;

  // Layout actions
  applyAutoLayout: () => boolean;

  // Health check actions
  runNodeHealthCheck: (nodeId: string) => Promise<void>;
  runAllHealthChecks: () => Promise<void>;
  clearHealthResults: () => void;
  getNodeHealthResult: (
    nodeId: string,
  ) => (HealthCheckResult & { timestamp: number; loading?: boolean }) | null;

  // History actions
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  saveToHistory: () => void;

  // Persistence
  saveDiagram: () => void;
  hydrateDiagram: (data: unknown) => void;
  exportDiagram: () => DiagramData;
  importDiagram: (data: unknown) => void;
  clearDiagram: () => void;
  /** Reset in-memory state without persisting — use when switching diagrams. */
  resetDiagramState: () => void;

  // Named flows
  addFlow: (flow: Omit<NamedFlow, "id" | "createdAt">) => NamedFlow;
  updateFlow: (id: string, patch: Partial<Omit<NamedFlow, "id" | "createdAt">>) => void;
  deleteFlow: (id: string) => void;
  /** Trigger flow simulation for the named flow. Returns true on success. */
  playFlow: (id: string) => boolean;
}

// Capture the document contents and identity at the edit, not when a timer fires.
const debouncedSave = (saveFn: () => void) => saveFn();

// UI locks must also cover delayed callbacks and direct store actions.
function setIfEditable(
  partial: Partial<DiagramStore> | ((state: DiagramStore) => Partial<DiagramStore>),
) {
  if (!cloudWorkspace.getState().locked) {
    useDiagramStore.setState(partial);
  }
}

export const useDiagramStore = create<DiagramStore>((set, get) => ({
  // Initial state
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  flows: [],
  clipboard: { nodes: [], edges: [] },
  history: [],
  historyIndex: -1,
  healthCheckResults: {},

  // Node changes (drag, select, etc.)
  onNodesChange: (changes) => {
    setIfEditable((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    }));

    // Auto-save on position changes
    const hasPositionChange = changes.some(
      (change) => change.type === "position" && change.dragging === false,
    );
    if (hasPositionChange) {
      get().saveToHistory();
      debouncedSave(get().saveDiagram);
    }
  },

  // Edge changes
  onEdgesChange: (changes) => {
    setIfEditable((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }));

    const hasRemove = changes.some((c) => c.type === "remove");
    if (hasRemove) {
      get().saveToHistory();
      debouncedSave(get().saveDiagram);
    }
  },

  // New connection
  onConnect: (connection) => {
    // Get target node to determine default protocol
    const state = get();
    const targetNode = state.nodes.find((n) => n.id === connection.target);
    const targetNodeType = (targetNode?.data as ArchitectureNodeData)?.type;
    const defaultProtocol = targetNodeType ? getDefaultProtocolForNode(targetNodeType) : "http";

    const newEdge: Edge = {
      ...connection,
      id: `edge-${Date.now()}`,
      type: "architecture",
      source: connection.source,
      target: connection.target,
      data: {
        protocol: defaultProtocol,
        animated: false,
      },
    };

    setIfEditable((state) => ({
      edges: addEdge(newEdge, state.edges),
    }));

    get().saveToHistory();
    debouncedSave(get().saveDiagram);
  },

  // Add new node
  addNode: (node) => {
    setIfEditable((state) => ({
      nodes: [...state.nodes, node],
    }));
    get().saveToHistory();
    debouncedSave(get().saveDiagram);
  },

  // Update node data
  updateNodeData: (id, data) => {
    setIfEditable((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, data: mergeDataPatch(node.data, data) } : node,
      ),
    }));
    get().saveToHistory();
    debouncedSave(get().saveDiagram);
  },

  // Delete node
  deleteNode: (id) => {
    setIfEditable((state) => ({
      nodes: state.nodes.filter((node) => node.id !== id),
      edges: state.edges.filter((edge) => edge.source !== id && edge.target !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
    }));
    get().saveToHistory();
    debouncedSave(get().saveDiagram);
  },

  // Delete selected nodes
  deleteSelectedNodes: () => {
    const { nodes } = get();
    const selectedNodeIds = nodes.filter((n) => n.selected).map((n) => n.id);

    if (selectedNodeIds.length === 0) {
      return;
    }

    setIfEditable((state) => ({
      nodes: state.nodes.filter((node) => !selectedNodeIds.includes(node.id)),
      edges: state.edges.filter(
        (edge) => !selectedNodeIds.includes(edge.source) && !selectedNodeIds.includes(edge.target),
      ),
      selectedNodeId: null,
    }));
    get().saveToHistory();
    debouncedSave(get().saveDiagram);
  },

  // Duplicate nodes
  duplicateNodes: (nodeIds) => {
    const { nodes, edges } = get();

    // Start with selected nodes
    const nodesToDuplicateIds = new Set(nodeIds);

    // If a group is selected, also include all its children (even if not explicitly selected)
    const selectedGroupIds = new Set(
      nodes.filter((n) => nodeIds.includes(n.id) && n.type === "group").map((n) => n.id),
    );
    nodes.forEach((node) => {
      if (node.parentId && selectedGroupIds.has(node.parentId)) {
        nodesToDuplicateIds.add(node.id);
      }
    });

    const nodesToDuplicate = nodes.filter((n) => nodesToDuplicateIds.has(n.id));

    if (nodesToDuplicate.length === 0) {
      return;
    }

    // Create a map of old IDs to new IDs
    const idMap = new Map<string, string>();

    // First pass: generate new IDs for all nodes
    nodesToDuplicate.forEach((node) => {
      const newId =
        node.type === "group"
          ? `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          : `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      idMap.set(node.id, newId);
    });

    // Separate into three categories:
    // 1. Root nodes (no parent at all)
    // 2. Child nodes whose parent IS being duplicated (need parentId remapping to new parent)
    // 3. Child nodes whose parent is NOT being duplicated (keep original parentId)
    const rootNodes = nodesToDuplicate.filter((n) => !n.parentId);
    const childNodesWithNewParent = nodesToDuplicate.filter(
      (n) => n.parentId && nodesToDuplicateIds.has(n.parentId),
    );
    const childNodesKeepingParent = nodesToDuplicate.filter(
      (n) => n.parentId && !nodesToDuplicateIds.has(n.parentId),
    );

    const newNodes: Node[] = [];

    // Process root nodes first (groups and standalone nodes) - apply offset
    rootNodes.forEach((node) => {
      const newId = idMap.get(node.id);
      if (!newId) {
        return;
      }

      const detachedNode = structuredClone(node);
      delete detachedNode.parentId;
      delete detachedNode.extent;
      delete detachedNode.data["parentId"];

      newNodes.push({
        ...detachedNode,
        id: newId,
        position: {
          x: node.position.x + 50,
          y: node.position.y + 50,
        },
        selected: false,
      });
    });

    // Process child nodes whose parent IS being duplicated - remap to new parent
    childNodesWithNewParent.forEach((node) => {
      const newId = idMap.get(node.id)!;
      const newParentId = idMap.get(node.parentId!)!;

      newNodes.push({
        ...node,
        id: newId,
        // Keep relative position for child nodes (they're positioned relative to parent)
        position: node.position,
        selected: false,
        parentId: newParentId,
        extent: "parent" as const,
        data: {
          ...node.data,
          parentId: newParentId,
        },
      });
    });

    // Process child nodes whose parent is NOT being duplicated - keep original parent, offset position
    childNodesKeepingParent.forEach((node) => {
      const newId = idMap.get(node.id)!;

      newNodes.push({
        ...node,
        id: newId,
        // Apply offset but keep within same parent
        position: {
          x: node.position.x + 50,
          y: node.position.y + 50,
        },
        selected: false,
        parentId: node.parentId,
        extent: "parent" as const,
        data: {
          ...node.data,
          parentId: node.parentId,
        },
      } as Node);
    });

    // Duplicate edges between duplicated nodes
    const newEdges: Edge[] = [];
    edges.forEach((edge) => {
      if (idMap.has(edge.source) && idMap.has(edge.target)) {
        newEdges.push({
          ...edge,
          id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          source: idMap.get(edge.source)!,
          target: idMap.get(edge.target)!,
        });
      }
    });

    // Track which new node IDs keep their existing parent (before we modified parentIds)
    const newIdsKeepingParent = new Set(childNodesKeepingParent.map((n) => idMap.get(n.id)!));

    // Add new nodes and edges, deselect old ones
    // IMPORTANT: React Flow requires parent nodes to come BEFORE child nodes
    setIfEditable((state) => {
      const existingNodes = state.nodes.map((n) => ({ ...n, selected: false }));

      // Separate new nodes by category using tracked IDs
      const nodesKeepingExistingParent = newNodes.filter((n) => newIdsKeepingParent.has(n.id));
      const nodesWithNewOrNoParent = newNodes.filter((n) => !newIdsKeepingParent.has(n.id));

      // Start with existing nodes
      let resultNodes = [...existingNodes];

      // Insert nodes keeping existing parent right after their parent
      nodesKeepingExistingParent.forEach((newNode) => {
        const parentIndex = resultNodes.findIndex((n) => n.id === newNode.parentId);
        if (parentIndex !== -1) {
          // Find the last child of this parent to insert after
          let insertIndex = parentIndex + 1;
          while (
            insertIndex < resultNodes.length &&
            resultNodes[insertIndex]?.parentId === newNode.parentId
          ) {
            insertIndex++;
          }
          resultNodes.splice(insertIndex, 0, { ...newNode, selected: true });
        } else {
          resultNodes.push({ ...newNode, selected: true });
        }
      });

      // Add nodes with new parent or no parent at the end
      // These are already in correct order (roots/groups first, then their children)
      resultNodes = [
        ...resultNodes,
        ...nodesWithNewOrNoParent.map((n) => ({ ...n, selected: true })),
      ];

      return {
        nodes: resultNodes,
        edges: [...state.edges, ...newEdges],
        selectedNodeId: null,
      };
    });

    get().saveToHistory();
    debouncedSave(get().saveDiagram);
  },

  // Copy selected nodes to clipboard
  copySelectedNodes: () => {
    const { nodes, edges } = get();
    const selectedNodes = nodes.filter((n) => n.selected);

    if (selectedNodes.length === 0) {
      return;
    }

    // Start with selected nodes
    const nodesToCopy = new Set(selectedNodes.map((n) => n.id));

    // If a group is selected, also include all its children (even if not explicitly selected)
    const selectedGroupIds = new Set(
      selectedNodes.filter((n) => n.type === "group").map((n) => n.id),
    );
    nodes.forEach((node) => {
      if (node.parentId && selectedGroupIds.has(node.parentId)) {
        nodesToCopy.add(node.id);
      }
    });

    // Get all nodes to copy (including auto-included children)
    const allNodesToCopy = nodes.filter((n) => nodesToCopy.has(n.id));

    // Copy edges that connect only copied nodes
    const selectedEdges = edges.filter(
      (edge) => nodesToCopy.has(edge.source) && nodesToCopy.has(edge.target),
    );

    // Deep clone to avoid reference issues
    setIfEditable({
      clipboard: {
        nodes: structuredClone(allNodesToCopy),
        edges: structuredClone(selectedEdges),
      },
    });
  },

  // Paste nodes from clipboard
  pasteNodes: (position) => {
    const { clipboard } = get();

    if (clipboard.nodes.length === 0) {
      return;
    }

    // Create a map of old IDs to new IDs
    const idMap = new Map<string, string>();

    // First pass: generate new IDs for all nodes
    clipboard.nodes.forEach((node) => {
      const newId =
        node.type === "group"
          ? `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          : `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      idMap.set(node.id, newId);
    });

    // Separate root nodes (no parent or parent not in clipboard) from child nodes
    const clipboardNodeIds = new Set(clipboard.nodes.map((n) => n.id));
    const rootNodes = clipboard.nodes.filter(
      (n) => !n.parentId || !clipboardNodeIds.has(n.parentId),
    );
    const childNodes = clipboard.nodes.filter(
      (n) => n.parentId && clipboardNodeIds.has(n.parentId),
    );

    // Calculate offset based on root nodes only
    let offsetX = 50;
    let offsetY = 50;

    if (position && rootNodes.length > 0) {
      // Calculate the center of root nodes (not children, as they have relative positions)
      const minX = Math.min(...rootNodes.map((n) => n.position.x));
      const minY = Math.min(...rootNodes.map((n) => n.position.y));
      const maxX = Math.max(...rootNodes.map((n) => n.position.x));
      const maxY = Math.max(...rootNodes.map((n) => n.position.y));
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      // Offset to center pasted nodes around the click position
      offsetX = position.x - centerX;
      offsetY = position.y - centerY;
    }

    const newNodes: Node[] = [];

    // Process root nodes first (groups and standalone nodes)
    rootNodes.forEach((node) => {
      const newId = idMap.get(node.id);
      if (!newId) {
        return;
      }

      const detachedNode = structuredClone(node);
      delete detachedNode.parentId;
      delete detachedNode.extent;
      delete detachedNode.data["parentId"];

      newNodes.push({
        ...detachedNode,
        id: newId,
        position: {
          x: node.position.x + offsetX,
          y: node.position.y + offsetY,
        },
        selected: false,
      });
    });

    // Process child nodes - keep their relative positions, update parentId
    childNodes.forEach((node) => {
      const newId = idMap.get(node.id)!;
      const newParentId = idMap.get(node.parentId!)!;

      newNodes.push({
        ...node,
        id: newId,
        // Keep relative position for child nodes (they're positioned relative to parent)
        position: node.position,
        selected: false,
        parentId: newParentId,
        extent: "parent" as const,
        data: {
          ...node.data,
          parentId: newParentId,
        },
      });
    });

    // Create new edges with updated source/target IDs
    const newEdges: Edge[] = [];
    clipboard.edges.forEach((edge) => {
      if (idMap.has(edge.source) && idMap.has(edge.target)) {
        newEdges.push({
          ...edge,
          id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          source: idMap.get(edge.source)!,
          target: idMap.get(edge.target)!,
        });
      }
    });

    // Add new nodes and edges, deselect old ones and select new ones
    // IMPORTANT: React Flow requires parent nodes to come BEFORE child nodes
    // newNodes is already ordered correctly (roots first, then children)
    setIfEditable((state) => ({
      nodes: [
        ...state.nodes.map((n) => ({ ...n, selected: false })),
        ...newNodes.map((n) => ({ ...n, selected: true })),
      ],
      edges: [...state.edges, ...newEdges],
      selectedNodeId: null,
    }));

    get().saveToHistory();
    debouncedSave(get().saveDiagram);
  },

  // Check if clipboard has content
  hasClipboardContent: () => {
    const { clipboard } = get();
    return clipboard.nodes.length > 0;
  },

  // Bring node to front (increase zIndex above all other group nodes)
  bringNodeToFront: (id) => {
    setIfEditable((state) => {
      const groupNodes = state.nodes.filter((n) => n.type === "group");
      const maxZ = groupNodes.reduce((max, n) => Math.max(max, n.zIndex ?? -1), -1);
      return {
        nodes: state.nodes.map((n) => (n.id === id ? { ...n, zIndex: maxZ + 1 } : n)),
      };
    });
    get().saveToHistory();
    debouncedSave(get().saveDiagram);
  },

  // Send node to back (decrease zIndex below all other group nodes)
  sendNodeToBack: (id) => {
    setIfEditable((state) => {
      const groupNodes = state.nodes.filter((n) => n.type === "group");
      const minZ = groupNodes.reduce((min, n) => Math.min(min, n.zIndex ?? -1), -1);
      return {
        nodes: state.nodes.map((n) => (n.id === id ? { ...n, zIndex: minZ - 1 } : n)),
      };
    });
    get().saveToHistory();
    debouncedSave(get().saveDiagram);
  },

  // Update group data
  updateGroupData: (id, data) => {
    setIfEditable((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, data: mergeDataPatch(node.data, data) } : node,
      ),
    }));
    get().saveToHistory();
    debouncedSave(get().saveDiagram);
  },

  // Toggle group collapse. Only flips the flag — child/edge visibility and
  // boundary-edge roll-up are DERIVED at render time (utils/groupRollup.ts),
  // so nodes added or edges drawn while collapsed stay consistent.
  toggleGroupCollapse: (id) => {
    const { nodes } = get();
    const groupNode = nodes.find((n) => n.id === id);
    if (!groupNode) {
      return;
    }

    const isCollapsing = !(groupNode.data as GroupNodeData).collapsed;

    setIfEditable((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, collapsed: isCollapsing } } : node,
      ),
    }));
    get().saveToHistory();
    debouncedSave(get().saveDiagram);
  },

  // Add node to group
  addNodeToGroup: (nodeId, groupId, relativePosition?) => {
    setIfEditable((state) => {
      const groupNode = state.nodes.find((n) => n.id === groupId);
      const targetNode = state.nodes.find((n) => n.id === nodeId);
      if (!groupNode || !targetNode) {
        return state;
      }

      // Use live dimensions from React Flow when available, then fall back.
      const groupWidth =
        groupNode.measured?.width ?? groupNode.width ?? ((groupNode.style?.width as number) || 300);
      const groupHeight =
        groupNode.measured?.height ??
        groupNode.height ??
        ((groupNode.style?.height as number) || 250);
      const nodeWidth =
        targetNode.measured?.width ??
        targetNode.width ??
        ((targetNode.style?.width as number) || 140);
      const nodeHeight =
        targetNode.measured?.height ??
        targetNode.height ??
        ((targetNode.style?.height as number) || 100);
      const padding = 20;

      // relativePosition is pre-computed by the caller using React Flow's internal
      // positionAbsolute values (the authoritative source). If not provided, fall back
      // to center of group.
      const rawX = relativePosition?.x ?? (groupWidth - nodeWidth) / 2;
      const rawY = relativePosition?.y ?? (groupHeight - nodeHeight) / 2;
      const maxX = Math.max(padding, groupWidth - nodeWidth - padding);
      const maxY = Math.max(padding, groupHeight - nodeHeight - padding);
      const relativeX = Math.max(padding, Math.min(rawX, maxX));
      const relativeY = Math.max(padding, Math.min(rawY, maxY));

      // Update the target node with parent relationship
      // @xyflow/react v12 uses parentId, NOT parentNode
      const updatedNode = {
        ...targetNode,
        position: { x: relativeX, y: relativeY },
        data: { ...targetNode.data, parentId: groupId },
        parentId: groupId, // v12 uses parentId
        extent: "parent" as const,
      };

      // IMPORTANT: React Flow requires parent nodes to come BEFORE child nodes
      // in the array. When the moved node is itself a group, its whole subtree
      // must move with it so its own children stay after it.
      const subtreeIds = new Set<string>([nodeId]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const n of state.nodes) {
          if (n.parentId && subtreeIds.has(n.parentId) && !subtreeIds.has(n.id)) {
            subtreeIds.add(n.id);
            grew = true;
          }
        }
      }
      const descendants = state.nodes.filter((n) => n.id !== nodeId && subtreeIds.has(n.id));
      const nodesWithoutSubtree = state.nodes.filter((n) => !subtreeIds.has(n.id));
      const parentIndex = nodesWithoutSubtree.findIndex((n) => n.id === groupId);

      // Insert the subtree right after its new parent (descendants keep their
      // original relative order, which is already parent-before-child).
      const reorderedNodes = [
        ...nodesWithoutSubtree.slice(0, parentIndex + 1),
        updatedNode,
        ...descendants,
        ...nodesWithoutSubtree.slice(parentIndex + 1),
      ];

      return { nodes: reorderedNodes };
    });
    get().saveToHistory();
    debouncedSave(get().saveDiagram);
  },

  // Remove node from group
  removeNodeFromGroup: (nodeId) => {
    setIfEditable((state) => {
      const node = state.nodes.find((n) => n.id === nodeId);
      const parentNode = node?.parentId ? state.nodes.find((n) => n.id === node.parentId) : null;

      if (!node || !parentNode) {
        return state;
      }

      // Convert relative position back to absolute position
      const absolutePosition = {
        x: node.position.x + parentNode.position.x,
        y: node.position.y + parentNode.position.y,
      };

      return {
        nodes: state.nodes.map((currentNode) => {
          if (currentNode.id !== nodeId) {
            return currentNode;
          }

          const detachedNode = {
            ...currentNode,
            position: absolutePosition,
            data: { ...currentNode.data },
          };
          delete detachedNode.parentId;
          delete detachedNode.extent;
          delete detachedNode.data["parentId"];
          return detachedNode;
        }),
      };
    });
    get().saveToHistory();
    debouncedSave(get().saveDiagram);
  },

  // Update edge data
  updateEdgeData: (id, data) => {
    setIfEditable((state) => ({
      edges: state.edges.map((edge) =>
        edge.id === id ? { ...edge, data: mergeDataPatch(edge.data ?? {}, data) } : edge,
      ),
    }));
    get().saveToHistory();
    debouncedSave(get().saveDiagram);
  },

  // Delete edge
  deleteEdge: (id) => {
    setIfEditable((state) => ({
      edges: state.edges.filter((edge) => edge.id !== id),
      selectedEdgeId: state.selectedEdgeId === id ? null : state.selectedEdgeId,
    }));
    get().saveToHistory();
    debouncedSave(get().saveDiagram);
  },

  // Selection
  setSelectedNode: (id) => {
    setIfEditable({ selectedNodeId: id, selectedEdgeId: null });
  },

  setSelectedEdge: (id) => {
    setIfEditable({ selectedEdgeId: id, selectedNodeId: null });
  },

  // Save current state to history
  saveToHistory: () => {
    const { nodes, edges, history, historyIndex } = get();

    // Remove any future states if we're not at the end
    const newHistory = history.slice(0, historyIndex + 1);

    // Add current state
    newHistory.push({
      nodes: structuredClone(nodes),
      edges: structuredClone(edges),
    });

    // Trim history if too long
    if (newHistory.length > MAX_HISTORY_LENGTH) {
      newHistory.shift();
    }

    setIfEditable({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  // Check if undo is possible
  canUndo: () => {
    const { historyIndex } = get();
    return historyIndex > 0;
  },

  // Check if redo is possible
  canRedo: () => {
    const { history, historyIndex } = get();
    return historyIndex < history.length - 1;
  },

  // Undo
  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      if (!prevState) {
        return;
      }
      setIfEditable({
        nodes: prevState.nodes,
        edges: prevState.edges,
        historyIndex: historyIndex - 1,
      });
      debouncedSave(get().saveDiagram);
    }
  },

  // Redo
  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      if (!nextState) {
        return;
      }
      setIfEditable({
        nodes: nextState.nodes,
        edges: nextState.edges,
        historyIndex: historyIndex + 1,
      });
      debouncedSave(get().saveDiagram);
    }
  },

  saveDiagram: () => {
    const { nodes, edges, flows } = get();
    cloudWorkspace.schedule({ nodes, edges, flows });
  },

  hydrateDiagram: (input) => {
    const data = diagramDataSchema.parse(input);
    set({
      nodes: data.nodes,
      edges: data.edges,
      flows: data.flows ?? [],
      selectedNodeId: null,
      selectedEdgeId: null,
      healthCheckResults: {},
      history: [{ nodes: data.nodes, edges: data.edges }],
      historyIndex: 0,
    });
    useSimulationStore.getState().setMode("idle");
  },

  // Export diagram data
  exportDiagram: () => {
    const { nodes, edges, flows } = get();
    return diagramDataSchema.parse({ nodes, edges, flows });
  },

  // Import diagram data
  importDiagram: (data) => {
    const validated = diagramDataSchema.parse(data);
    setIfEditable({
      nodes: validated.nodes,
      edges: validated.edges,
      flows: validated.flows ?? [],
      selectedNodeId: null,
      selectedEdgeId: null,
    });
    get().saveToHistory();
    get().saveDiagram();
  },

  // Clear diagram
  clearDiagram: () => {
    setIfEditable({
      nodes: [],
      edges: [],
      flows: [],
      selectedNodeId: null,
      selectedEdgeId: null,
    });
    get().saveToHistory();
    get().saveDiagram();
  },

  // Reset in-memory state without persisting — safe to call when switching diagrams
  resetDiagramState: () => {
    useSimulationStore.getState().setMode("idle");
    useAnimationStore.setState({ pendingDeletions: new Set() });
    set({
      nodes: [],
      edges: [],
      flows: [],
      clipboard: { nodes: [], edges: [] },
      healthCheckResults: {},
      selectedNodeId: null,
      selectedEdgeId: null,
      history: [],
      historyIndex: -1,
    });
  },

  // ── Named flows ────────────────────────────────────────────
  addFlow: (partial) => {
    const flow: NamedFlow = {
      id: `flow-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      ...partial,
    };
    setIfEditable((state) => ({ flows: [...state.flows, flow] }));
    debouncedSave(get().saveDiagram);
    return flow;
  },

  updateFlow: (id, patch) => {
    setIfEditable((state) => ({
      flows: state.flows.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
    debouncedSave(get().saveDiagram);
  },

  deleteFlow: (id) => {
    setIfEditable((state) => ({ flows: state.flows.filter((f) => f.id !== id) }));
    debouncedSave(get().saveDiagram);
  },

  playFlow: (id) => {
    const { flows, nodes, edges } = get();
    const flow = flows.find((f) => f.id === id);
    if (!flow) {
      return false;
    }
    // Guard against a deleted source — the FlowsPanel surfaces this via a broken badge.
    if (!nodes.some((n) => n.id === flow.sourceNodeId)) {
      return false;
    }

    const sim = useSimulationStore.getState();
    if (sim.mode !== "flow") {
      sim.setMode("flow");
    }
    if (flow.speed) {
      sim.setSpeed(flow.speed);
    }
    const path = traceFlowPath(nodes, edges, flow.sourceNodeId);
    sim.startFlowSimulation(flow.sourceNodeId, path);
    return true;
  },

  applyAutoLayout: () => {
    const cloud = cloudWorkspace.getState();
    const { nodes, edges, history, historyIndex } = get();
    if (
      nodes.length === 0 ||
      cloud.locked ||
      cloud.status === "loading" ||
      useAnimationStore.getState().pendingDeletions.size > 0
    ) {
      return false;
    }

    const formatted = autoLayoutDiagram(nodes, edges);
    if (JSON.stringify(formatted) === JSON.stringify(nodes)) {
      return false;
    }

    get().saveToHistory();
    const before = get().history[get().historyIndex]!;
    // History stores post-edit snapshots. Refresh the current baseline (including
    // measured dimensions), then add exactly one new state for undo and redo.
    const nextHistory = [
      ...history.slice(0, Math.max(0, historyIndex)),
      before,
      { nodes: structuredClone(formatted), edges: structuredClone(edges) },
    ].slice(-MAX_HISTORY_LENGTH);
    setIfEditable({
      nodes: formatted,
      history: nextHistory,
      historyIndex: nextHistory.length - 1,
    });
    debouncedSave(get().saveDiagram);
    return true;
  },

  // Health check actions
  runNodeHealthCheck: async (nodeId: string) => {
    const { nodes, healthCheckResults } = get();
    const node = nodes.find((n) => n.id === nodeId);

    if (!node || node.type !== "architecture") {
      return;
    }

    const nodeData = node.data as ArchitectureNodeData;
    const url = nodeData.healthCheckUrl;

    if (!url) {
      return;
    }

    // Set loading state
    setIfEditable({
      healthCheckResults: {
        ...healthCheckResults,
        [nodeId]: {
          status: "error",
          latency: 0,
          timestamp: Date.now(),
          loading: true,
        },
      },
    });

    // Perform health check
    const result = await checkHealth(url);

    // Update with result
    setIfEditable({
      healthCheckResults: {
        ...get().healthCheckResults,
        [nodeId]: {
          ...result,
          timestamp: Date.now(),
          loading: false,
        },
      },
    });
  },

  runAllHealthChecks: async () => {
    const { nodes } = get();
    const architectureNodes = nodes.filter(
      (n) => n.type === "architecture" && (n.data as ArchitectureNodeData).healthCheckUrl,
    );

    // Run all checks in parallel
    await Promise.all(architectureNodes.map((node) => get().runNodeHealthCheck(node.id)));
  },

  clearHealthResults: () => {
    setIfEditable({ healthCheckResults: {} });
  },

  getNodeHealthResult: (nodeId: string) => {
    return get().healthCheckResults[nodeId] || null;
  },
}));

setDiagramHydrator((data) => useDiagramStore.getState().hydrateDiagram(data));
