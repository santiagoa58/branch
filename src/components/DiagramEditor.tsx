import { useCallback, useRef, useEffect, useMemo, DragEvent, useState } from "react";
import { ReactFlow, MiniMap, useReactFlow, useStoreApi, Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useDiagramStore } from "@/store/diagramStore";
import { useSimulationStore } from "@/store/simulationStore";
import { useAnimationStore } from "@/store/animationStore";
import { useUIStore } from "@/store/uiStore";
import { nodeTypes } from "@/components/nodes";
import { edgeTypes } from "@/components/edges";
import { NODE_TYPES_CONFIG, GROUP_TYPES_CONFIG } from "@/constants";
import { architectureNodeTypeSchema, groupNodeTypeSchema } from "@/schemas/diagram";
import { paletteNodeTypeSchema } from "@/schemas/ui";
import { ArchitectureNodeType, ArchitectureNode, GroupNodeType, GroupNodeData } from "@/types";
import { traceFlowPath } from "@/utils/graphTraversal";
import { applyGroupCollapse } from "@/utils/groupRollup";
import { cn } from "@/lib/utils";
import {
  CursorArrowRaysIcon,
  HandRaisedIcon,
  MinusIcon,
  PlusIcon,
  ArrowDownTrayIcon,
  DocumentDuplicateIcon,
  ClipboardDocumentIcon,
  ArrowUpTrayIcon,
  BoltIcon,
  ArrowUpCircleIcon,
  ArrowDownCircleIcon,
  PlayCircleIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import { exportSelectedAsSvg, exportSelectedAsPng } from "@/utils/export";
import { ShortcutsHelp } from "@/components/panels/ShortcutsHelp";
import { SimulationPanel } from "@/components/panels/SimulationPanel";
import { GettingStartedChecklist } from "@/components/panels/GettingStartedChecklist";
import { DiagramInfoCard } from "@/components/panels/DiagramInfoCard";
import { ProtocolLegend } from "@/components/panels/ProtocolLegend";
import { NodeDetailPopup } from "@/components/panels/NodeDetailPopup";
import { CanvasStatusBar } from "@/components/panels/CanvasStatusBar";
import { SpotlightSearch } from "@/components/panels/SpotlightSearch";
import { TagFilter } from "@/components/panels/TagFilter";
import { FlowsPanel } from "@/components/panels/FlowsPanel";
import { ImportDialog } from "@/components/ui/ImportDialog";
import { TemplateGalleryDialog } from "@/components/ui/TemplateGalleryDialog";
import { LaserPointer } from "@/components/ui/LaserPointer";
import { useSimulationAnimation } from "@/hooks/useSimulationAnimation";
import { useDestroyAnimation } from "@/hooks/useDestroyAnimation";
import { useChaosSimulation } from "@/hooks/useChaosSimulation";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { useOnboardingStore } from "@/store/onboardingStore";

// Resolve the catalog's Tailwind colors through theme variables so new node
// types automatically receive matching minimap colors.
const MINIMAP_NODE_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(NODE_TYPES_CONFIG).map(([type, config]) => [
    type,
    `var(${config.iconColor.replace("text-", "--color-")})`,
  ]),
);

export function DiagramEditor() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null!);
  const { screenToFlowPosition, zoomIn, zoomOut, getZoom, getIntersectingNodes } = useReactFlow();
  const rfStore = useStoreApi();
  const [zoom, setZoom] = useState(100);
  const [panMode, setPanMode] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; show: boolean }>({
    x: 0,
    y: 0,
    show: false,
  });
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [showSimulationPanel, setShowSimulationPanel] = useState(false);
  const [showFlowsPanel, setShowFlowsPanel] = useState(false);
  const [laserMode, setLaserMode] = useState(false);

  // Simulation & animation hooks
  const simulationMode = useSimulationStore((s) => s.mode);
  const simulationSetMode = useSimulationStore((s) => s.setMode);
  const simulationStartFlow = useSimulationStore((s) => s.startFlowSimulation);
  const toggleNodeFailure = useSimulationStore((s) => s.toggleNodeFailure);
  const toggleProtectedNode = useSimulationStore((s) => s.toggleProtectedNode);
  const requestDelete = useAnimationStore((s) => s.requestDelete);
  const requestDeleteMultiple = useAnimationStore((s) => s.requestDeleteMultiple);

  // Activate GSAP simulation, destroy, and chaos animation hooks
  useSimulationAnimation();
  useDestroyAnimation();
  useChaosSimulation();
  // Track getting-started checklist progress
  useOnboardingProgress();
  const onboardingActiveStep = useOnboardingStore((s) => s.activeStep);

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    setSelectedNode,
    setSelectedEdge,
    deleteSelectedNodes,
    duplicateNodes,
    addNodeToGroup,
    removeNodeFromGroup,
    copySelectedNodes,
    pasteNodes,
    hasClipboardContent,
    bringNodeToFront,
    sendNodeToBack,
  } = useDiagramStore();

  // Display graph — children of collapsed groups hidden, boundary edges
  // aggregated into synthetic rollup edges. The store keeps the real graph;
  // only React Flow sees this derived view.
  const { displayNodes, displayEdges } = useMemo(
    () => applyGroupCollapse(nodes, edges),
    [nodes, edges],
  );

  // Prevent default context menu on the diagram.
  // NOTE: dependencies are intentionally empty — we read the latest store
  // state via `useDiagramStore.getState()` inside the handler so this effect
  // doesn't re-register on every node change (which happens on every drag
  // tick and caused noticeable input lag).
  useEffect(() => {
    const preventContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Only prevent if clicking on the React Flow canvas
      if (target.closest(".react-flow")) {
        e.preventDefault();

        const { nodes: currentNodes, hasClipboardContent: hasClipboardFn } =
          useDiagramStore.getState();
        const hasSelected = currentNodes.some((n) => n.selected);
        const hasClipboard = hasClipboardFn();

        // Show context menu if there are selected nodes or clipboard has content
        if (hasSelected || hasClipboard) {
          setContextMenu({
            x: e.clientX,
            y: e.clientY,
            show: true,
          });
        }
      }
    };

    document.addEventListener("contextmenu", preventContextMenu);
    return () => document.removeEventListener("contextmenu", preventContextMenu);
  }, []);

  // Helper function to add node at viewport center
  const addNodeAtCenter = useCallback(
    (type: ArchitectureNodeType | "comment" | `group-${GroupNodeType}`) => {
      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) {
        return;
      }

      // Calculate center of viewport
      const centerX = bounds.width / 2;
      const centerY = bounds.height / 2;

      const position = screenToFlowPosition({
        x: centerX,
        y: centerY,
      });

      // Check if it's a comment node
      if (type === "comment") {
        const newComment: Node = {
          id: `comment-${Date.now()}`,
          type: "comment",
          position,
          data: {
            text: "Add your note here...",
            color: "yellow",
            createdAt: new Date().toISOString(),
          },
        };

        addNode(newComment);
        return;
      }

      // Check if it's a group type
      if (type.startsWith("group-")) {
        const groupType = groupNodeTypeSchema.parse(type.slice("group-".length));
        const config = GROUP_TYPES_CONFIG[groupType];

        const newGroup: Node<GroupNodeData> = {
          id: `group-${Date.now()}`,
          type: "group",
          position,
          zIndex: -1,
          style: {
            width: 300,
            height: 250,
          },
          data: {
            label: `New ${config.label}`,
            groupType,
            collapsed: false,
          },
        };

        addNode(newGroup);
        return;
      }

      // Regular architecture node
      const nodeType = architectureNodeTypeSchema.parse(type);
      const config = NODE_TYPES_CONFIG[nodeType];

      const newNode: ArchitectureNode = {
        id: `node-${Date.now()}`,
        type: "architecture",
        position,
        data: {
          label: `New ${config.label}`,
          type: nodeType,
        },
      };

      addNode(newNode);
    },
    [screenToFlowPosition, addNode],
  );

  // Handle drag over
  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Handle drop from palette
  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();

      const parsedType = paletteNodeTypeSchema.safeParse(
        event.dataTransfer.getData("application/reactflow"),
      );
      if (!parsedType.success) {
        return;
      }
      const type = parsedType.data;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Check if it's a comment node
      if (type === "comment") {
        const newComment: Node = {
          id: `comment-${Date.now()}`,
          type: "comment",
          position,
          data: {
            text: "Add your note here...",
            color: "yellow",
            createdAt: new Date().toISOString(),
          },
        };

        addNode(newComment);
        return;
      }

      // Check if it's a group type
      if (type.startsWith("group-")) {
        const groupType = groupNodeTypeSchema.parse(type.slice("group-".length));
        const config = GROUP_TYPES_CONFIG[groupType];

        const newGroup: Node<GroupNodeData> = {
          id: `group-${Date.now()}`,
          type: "group",
          position,
          zIndex: -1,
          style: {
            width: 300,
            height: 250,
          },
          data: {
            label: `New ${config.label}`,
            groupType,
            collapsed: false,
          },
        };

        addNode(newGroup);
        return;
      }

      // Regular architecture node
      const nodeType = architectureNodeTypeSchema.parse(type);
      const config = NODE_TYPES_CONFIG[nodeType];

      const newNode: ArchitectureNode = {
        id: `node-${Date.now()}`,
        type: "architecture",
        position,
        data: {
          label: `New ${config.label}`,
          type: nodeType,
        },
      };

      addNode(newNode);
    },
    [screenToFlowPosition, addNode],
  );

  // Handle node click — with simulation mode support
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      // In flow simulation mode: set clicked node as source
      if (simulationMode === "flow") {
        const path = traceFlowPath(nodes, edges, node.id);
        simulationStartFlow(node.id, path);
        return;
      }
      // In failure simulation mode: toggle node failure
      if (simulationMode === "failure") {
        toggleNodeFailure(node.id);
        return;
      }
      // In chaos mode: toggle node protection (Shift+click) or no-op
      if (simulationMode === "chaos") {
        toggleProtectedNode(node.id);
        return;
      }
      setSelectedNode(node.id);
    },
    [
      setSelectedNode,
      simulationMode,
      nodes,
      edges,
      simulationStartFlow,
      toggleNodeFailure,
      toggleProtectedNode,
    ],
  );

  // Handle edge click
  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: { id: string }) => {
      setSelectedEdge(edge.id);
    },
    [setSelectedEdge],
  );

  // Handle pane click (deselect)
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
    setContextMenu({ x: 0, y: 0, show: false });
  }, [setSelectedNode, setSelectedEdge]);

  // Handle export selected as SVG
  const handleExportSelectedSvg = useCallback(async () => {
    const selectedNodes = nodes.filter((n) => n.selected);
    if (selectedNodes.length === 0) {
      return;
    }

    try {
      await exportSelectedAsSvg(selectedNodes);
      setContextMenu({ x: 0, y: 0, show: false });
    } catch (error) {
      console.error("Failed to export selection:", error);
    }
  }, [nodes]);

  // Handle export selected as PNG
  const handleExportSelectedPng = useCallback(async () => {
    const selectedNodes = nodes.filter((n) => n.selected);
    if (selectedNodes.length === 0) {
      return;
    }

    try {
      await exportSelectedAsPng(selectedNodes);
      setContextMenu({ x: 0, y: 0, show: false });
    } catch (error) {
      console.error("Failed to export selection:", error);
    }
  }, [nodes]);

  // Handle copy selected nodes
  const handleCopy = useCallback(() => {
    copySelectedNodes();
    setContextMenu({ x: 0, y: 0, show: false });
  }, [copySelectedNodes]);

  // Handle paste nodes at context menu position
  const handlePaste = useCallback(() => {
    const position = screenToFlowPosition({
      x: contextMenu.x,
      y: contextMenu.y,
    });
    pasteNodes(position);
    setContextMenu({ x: 0, y: 0, show: false });
  }, [pasteNodes, screenToFlowPosition, contextMenu.x, contextMenu.y]);

  // Update zoom display
  const onMoveEnd = useCallback(() => {
    setZoom(Math.round(getZoom() * 100));
  }, [getZoom]);

  // Handle node drag stop - auto-parent to group if dropped inside
  const onNodeDragStop = useCallback(
    (_: MouseEvent | TouchEvent, node: Node) => {
      // If node is already parented and has extent='parent', it's constrained - don't modify
      if (node.parentId && node.extent === "parent") {
        return;
      }

      // Groups can be nested inside other groups, but never inside themselves
      // or one of their own descendants (that would create a parentId cycle).
      const isInDraggedSubtree = (candidateId: string): boolean => {
        let current = nodes.find((n) => n.id === candidateId);
        while (current) {
          if (current.id === node.id) {
            return true;
          }
          const parentId = current.parentId;
          current = parentId ? nodes.find((n) => n.id === parentId) : undefined;
        }
        return false;
      };

      // Use React Flow's internal nodeLookup to get authoritative positionAbsolute
      // values. This is more reliable than node.position from the callback or the
      // Zustand store, which can both be stale at this point.
      const { nodeLookup } = rfStore.getState();
      const dims = (n: Node) => ({
        width: n.measured?.width ?? n.width ?? ((n.style?.width as number) || 300),
        height: n.measured?.height ?? n.height ?? ((n.style?.height as number) || 250),
      });
      const absPos = (n: Node) => nodeLookup.get(n.id)?.internals.positionAbsolute ?? n.position;

      const nodeAbsPos = absPos(node);
      const nodeDims = dims(node);
      const nodeArea = nodeDims.width * nodeDims.height;
      const nodeCenter = {
        x: nodeAbsPos.x + nodeDims.width / 2,
        y: nodeAbsPos.y + nodeDims.height / 2,
      };

      // Candidate parents: intersecting groups that are larger than the dragged
      // node (a region dragged across a small VPC must not nest into it).
      const intersectingGroups = getIntersectingNodes(node).filter((n) => {
        if (n.type !== "group" || isInDraggedSubtree(n.id)) {
          return false;
        }
        const d = dims(n);
        return d.width * d.height > nodeArea;
      });

      if (intersectingGroups.length > 0) {
        // Parent to the innermost (smallest) candidate, preferring groups that
        // contain the dragged node's center — that's the one visually under it.
        const containsCenter = (n: Node) => {
          const p = absPos(n);
          const d = dims(n);
          return (
            nodeCenter.x >= p.x &&
            nodeCenter.x <= p.x + d.width &&
            nodeCenter.y >= p.y &&
            nodeCenter.y <= p.y + d.height
          );
        };
        const pickSmallest = (candidates: Node[]) =>
          candidates.reduce((best, c) => {
            const da = dims(c);
            const db = dims(best);
            return da.width * da.height < db.width * db.height ? c : best;
          });
        const containing = intersectingGroups.filter(containsCenter);
        const targetGroup = pickSmallest(containing.length > 0 ? containing : intersectingGroups);

        // Only update if not already parented to this group
        if (node.parentId !== targetGroup.id) {
          const groupAbsPos = absPos(targetGroup);
          const relativePosition = {
            x: nodeAbsPos.x - groupAbsPos.x,
            y: nodeAbsPos.y - groupAbsPos.y,
          };
          addNodeToGroup(node.id, targetGroup.id, relativePosition);
        }
      } else if (node.parentId && !node.extent) {
        // Only remove from group if node doesn't have extent constraint
        removeNodeFromGroup(node.id);
      }
    },
    [nodes, addNodeToGroup, removeNodeFromGroup, getIntersectingNodes, rfStore],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { selectedNodeId, selectedEdgeId, deleteEdge, undo, redo } = useDiagramStore.getState();

      // Ignore shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      // Node creation shortcuts (lowercase keys)
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        switch (event.key.toLowerCase()) {
          case "s":
            event.preventDefault();
            addNodeAtCenter("service");
            return;
          case "d":
            event.preventDefault();
            addNodeAtCenter("database");
            return;
          case "q":
            event.preventDefault();
            addNodeAtCenter("queue");
            return;
          case "c":
            event.preventDefault();
            addNodeAtCenter("cache");
            return;
          case "g":
            event.preventDefault();
            addNodeAtCenter("gateway");
            return;
          case "e":
            event.preventDefault();
            addNodeAtCenter("external");
            return;
          case "t":
            event.preventDefault();
            addNodeAtCenter("storage");
            return;
          case "l":
            event.preventDefault();
            addNodeAtCenter("client");
            return;
          case "n":
            event.preventDefault();
            addNodeAtCenter("comment");
            return;
          // Tier 1: Cloud Infrastructure shortcuts
          case "f":
            event.preventDefault();
            addNodeAtCenter("lambda");
            return;
          case "b":
            event.preventDefault();
            addNodeAtCenter("loadbalancer");
            return;
          case "y":
            event.preventDefault();
            addNodeAtCenter("cdn");
            return;
          case "a":
            event.preventDefault();
            addNodeAtCenter("auth");
            return;
          case "p":
            event.preventDefault();
            addNodeAtCenter("container");
            return;
          case "z":
            event.preventDefault();
            addNodeAtCenter("dns");
            return;
          // Tier 2: AI/ML shortcuts
          case "m":
            event.preventDefault();
            addNodeAtCenter("llm");
            return;
          case "x":
            event.preventDefault();
            addNodeAtCenter("vectordb");
            return;
          case "w":
            event.preventDefault();
            addNodeAtCenter("mlpipeline");
            return;
          case "i":
            event.preventDefault();
            addNodeAtCenter("embedding");
            return;
          // Tier 3: Cloud Services shortcuts
          case "k":
            event.preventDefault();
            addNodeAtCenter("secrets");
            return;
          case "u":
            event.preventDefault();
            addNodeAtCenter("eventbus");
            return;
          case "j":
            event.preventDefault();
            addNodeAtCenter("datalake");
            return;
          case "r":
            event.preventDefault();
            addNodeAtCenter("search");
            return;
          case "o":
            event.preventDefault();
            addNodeAtCenter("notification");
            return;
        }
      }

      // Group creation shortcuts (Shift + key)
      if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
        switch (event.key.toUpperCase()) {
          case "V":
            event.preventDefault();
            addNodeAtCenter("group-vpc");
            return;
          case "K":
            event.preventDefault();
            addNodeAtCenter("group-cluster");
            return;
          case "R":
            event.preventDefault();
            addNodeAtCenter("group-region");
            return;
          case "N":
            event.preventDefault();
            addNodeAtCenter("group-subnet");
            return;
        }
      }

      // Toggle modes: V for select, H for hand/pan, ` for laser
      if (event.key === "v" || event.key === "V") {
        setPanMode(false);
        setLaserMode(false);
        return;
      }
      if (event.key === "h" || event.key === "H") {
        setPanMode(true);
        setLaserMode(false);
        return;
      }
      if (event.key === "`") {
        setLaserMode((prev) => {
          if (!prev) {
            setPanMode(false);
          }
          return !prev;
        });
        return;
      }

      // Show shortcuts: ?
      if (event.key === "?" && !event.shiftKey) {
        event.preventDefault();
        setShowShortcuts(true);
        return;
      }

      // Spotlight: Cmd/Ctrl + K
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        useUIStore.getState().setSpotlightOpen(true);
        return;
      }

      // Toggle simulation panel: Shift+S
      if (event.shiftKey && event.key === "S" && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        setShowSimulationPanel((prev) => {
          if (prev) {
            simulationSetMode("idle");
          } else {
            simulationSetMode("flow");
          }
          return !prev;
        });
        return;
      }

      // Delete - handle both single and multi-selection (with shatter animation)
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();

        // Check for multi-selected nodes
        const selectedNodes = nodes.filter((n) => n.selected);

        if (selectedNodes.length > 0) {
          requestDeleteMultiple(selectedNodes.map((n) => n.id));
        } else if (selectedNodeId) {
          requestDelete(selectedNodeId);
        } else if (selectedEdgeId) {
          deleteEdge(selectedEdgeId);
        }
      }

      // Duplicate: Cmd/Ctrl + D
      if ((event.ctrlKey || event.metaKey) && event.key === "d") {
        event.preventDefault();

        const selectedNodes = nodes.filter((n) => n.selected);
        if (selectedNodes.length > 0) {
          duplicateNodes(selectedNodes.map((n) => n.id));
        } else if (selectedNodeId) {
          duplicateNodes([selectedNodeId]);
        }
      }

      // Undo: Ctrl/Cmd + Z
      if ((event.ctrlKey || event.metaKey) && event.key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      }

      // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
      if (
        (event.ctrlKey || event.metaKey) &&
        (event.key === "y" || (event.key === "z" && event.shiftKey))
      ) {
        event.preventDefault();
        redo();
      }

      // Copy: Ctrl/Cmd + C
      if ((event.ctrlKey || event.metaKey) && event.key === "c") {
        const selectedNodes = nodes.filter((n) => n.selected);
        if (selectedNodes.length > 0) {
          event.preventDefault();
          const { copySelectedNodes } = useDiagramStore.getState();
          copySelectedNodes();
        }
      }

      // Paste: Ctrl/Cmd + V
      if ((event.ctrlKey || event.metaKey) && event.key === "v") {
        const { hasClipboardContent, pasteNodes } = useDiagramStore.getState();
        if (hasClipboardContent()) {
          event.preventDefault();
          pasteNodes(); // Paste with default offset
        }
      }

      // Auto-layout: Ctrl/Cmd + L
      if ((event.ctrlKey || event.metaKey) && event.key === "l") {
        event.preventDefault();
        const { applyAutoLayout } = useDiagramStore.getState();
        applyAutoLayout("TB"); // Default to top-to-bottom
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    nodes,
    deleteSelectedNodes,
    duplicateNodes,
    addNodeAtCenter,
    requestDeleteMultiple,
    requestDelete,
    simulationSetMode,
  ]);

  return (
    <div
      className="flex-1 relative bg-white dark:bg-zinc-950 overflow-hidden"
      data-onboarding-pulse={onboardingActiveStep === "connect-nodes" ? "connect-nodes" : undefined}
    >
      {/* Grid Background */}
      <div className="absolute inset-0 bg-grid-pattern opacity-50 dark:opacity-60 pointer-events-none z-0" />

      {/* Context Menu */}
      {contextMenu.show && (
        <>
          <button
            type="button"
            aria-label="Close context menu"
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu({ x: 0, y: 0, show: false })}
          />
          <div
            className="fixed z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl overflow-hidden animate-slide-in min-w-48"
            style={{
              left: `${contextMenu.x}px`,
              top: `${contextMenu.y}px`,
            }}
          >
            <div className="p-1">
              {/* Copy/Paste Section */}
              {nodes.filter((n) => n.selected).length > 0 && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="w-full text-left px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white rounded-md flex items-center gap-2"
                >
                  <DocumentDuplicateIcon className="w-3.5 h-3.5" />
                  Copy
                  <span className="ml-auto text-zinc-400 dark:text-zinc-500">Ctrl+C</span>
                </button>
              )}
              {hasClipboardContent() && (
                <button
                  type="button"
                  onClick={handlePaste}
                  className="w-full text-left px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white rounded-md flex items-center gap-2"
                >
                  <ClipboardDocumentIcon className="w-3.5 h-3.5" />
                  Paste
                  <span className="ml-auto text-zinc-400 dark:text-zinc-500">Ctrl+V</span>
                </button>
              )}
              {/* Divider */}
              {nodes.filter((n) => n.selected).length > 0 && (
                <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
              )}
              {/* Layer Order Section - only for single selected group */}
              {nodes.filter((n) => n.selected && n.type === "group").length === 1 &&
                (() => {
                  const groupNode = nodes.find((n) => n.selected && n.type === "group")!;
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          bringNodeToFront(groupNode.id);
                          setContextMenu({ x: 0, y: 0, show: false });
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white rounded-md flex items-center gap-2"
                      >
                        <ArrowUpCircleIcon className="w-3.5 h-3.5" />
                        Bring to Front
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          sendNodeToBack(groupNode.id);
                          setContextMenu({ x: 0, y: 0, show: false });
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white rounded-md flex items-center gap-2"
                      >
                        <ArrowDownCircleIcon className="w-3.5 h-3.5" />
                        Send to Back
                      </button>
                      <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-700" />
                    </>
                  );
                })()}
              {/* Export Section */}
              {nodes.filter((n) => n.selected).length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      void handleExportSelectedSvg();
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white rounded-md flex items-center gap-2"
                  >
                    <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                    Export Selection as SVG
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleExportSelectedPng();
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white rounded-md flex items-center gap-2"
                  >
                    <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                    Export Selection as PNG
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Toolbar Overlay */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur border border-zinc-200 dark:border-zinc-800 rounded-full p-1.5 flex gap-1 shadow-lg shadow-black/20 dark:shadow-black/50 z-20">
        <button
          type="button"
          onClick={() => {
            setPanMode(false);
            setLaserMode(false);
          }}
          className={cn(
            "p-2 rounded-full transition-colors",
            !panMode && !laserMode
              ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
              : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100",
          )}
          title="Select (V)"
        >
          <CursorArrowRaysIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setPanMode(true);
            setLaserMode(false);
          }}
          className={cn(
            "p-2 rounded-full transition-colors",
            panMode
              ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
              : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100",
          )}
          title="Pan (H)"
        >
          <HandRaisedIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          aria-label={laserMode ? "Disable laser pointer" : "Enable laser pointer"}
          onClick={() => {
            setLaserMode(!laserMode);
            setPanMode(false);
          }}
          className={cn(
            "p-2 rounded-full transition-colors",
            laserMode
              ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
              : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100",
          )}
          title="Laser Pointer (`)"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="3" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="21" />
            <line x1="3" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="21" y2="12" />
            <line x1="5.6" y1="5.6" x2="7.8" y2="7.8" />
            <line x1="16.2" y1="16.2" x2="18.4" y2="18.4" />
            <line x1="5.6" y1="18.4" x2="7.8" y2="16.2" />
            <line x1="16.2" y1="7.8" x2="18.4" y2="5.6" />
          </svg>
        </button>
        <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800 my-auto mx-1" />
        <button
          type="button"
          onClick={() => {
            void zoomOut();
          }}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          title="Zoom Out"
        >
          <MinusIcon className="w-4 h-4" />
        </button>
        <span className="text-xs font-medium text-muted-foreground flex items-center px-2">
          {zoom}%
        </span>
        <button
          type="button"
          onClick={() => {
            void zoomIn();
          }}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          title="Zoom In"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800 my-auto mx-1" />
        <button
          type="button"
          onClick={() => setShowShortcuts(true)}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          title="Keyboard Shortcuts (?)"
        >
          <span className="text-xs font-semibold">?</span>
        </button>
        <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800 my-auto mx-1" />
        <button
          type="button"
          onClick={() => setShowImportDialog(true)}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          title="Import Diagram"
        >
          <ArrowUpTrayIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setShowTemplateGallery(true)}
          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          title="Starter Templates"
        >
          <Squares2X2Icon className="w-4 h-4" />
        </button>
        <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-800 my-auto mx-1" />
        <button
          type="button"
          onClick={() => {
            setShowSimulationPanel((v) => !v);
            if (!showSimulationPanel) {
              simulationSetMode("flow");
            } else {
              simulationSetMode("idle");
            }
          }}
          className={cn(
            "p-2 rounded-full transition-colors",
            showSimulationPanel
              ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
              : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100",
            onboardingActiveStep === "run-flow-sim" &&
              "onboarding-pulse text-amber-600 dark:text-amber-400",
          )}
          title="Simulation Mode (Shift+S)"
        >
          <BoltIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setShowFlowsPanel((v) => !v)}
          className={cn(
            "p-2 rounded-full transition-colors",
            showFlowsPanel
              ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
              : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100",
          )}
          title="Saved Flows"
        >
          <PlayCircleIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Import Dialog */}
      <ImportDialog isOpen={showImportDialog} onClose={() => setShowImportDialog(false)} />
      {/* Starter template gallery */}
      <TemplateGalleryDialog
        isOpen={showTemplateGallery}
        onClose={() => setShowTemplateGallery(false)}
      />
      {/* Shortcuts Help Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <button
            type="button"
            aria-label="Close keyboard shortcuts"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowShortcuts(false)}
          />
          <div className="relative">
            <ShortcutsHelp onClose={() => setShowShortcuts(false)} />
          </div>
        </div>
      )}

      {/* React Flow Canvas */}
      <div ref={reactFlowWrapper} className={cn("w-full h-full", laserMode && "cursor-none")}>
        <LaserPointer active={laserMode} containerRef={reactFlowWrapper} />
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onMoveEnd={onMoveEnd}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{
            type: "architecture",
          }}
          fitView
          snapToGrid
          snapGrid={[10, 10]}
          proOptions={{ hideAttribution: true }}
          style={{ background: "transparent" }}
          selectionOnDrag={!panMode}
          panOnDrag={panMode ? true : [1, 2]}
          panOnScroll
          zoomOnScroll={false}
          zoomOnPinch
          multiSelectionKeyCode="Shift"
          deleteKeyCode={null}
        >
          <MiniMap
            pannable
            zoomable
            nodeStrokeWidth={2}
            maskColor="rgb(9 9 11 / 0.6)"
            className="bg-white/90! dark:bg-zinc-900/80! backdrop-blur-md border! border-zinc-200! dark:border-zinc-800! rounded-lg! shadow-lg right-4! bottom-4!"
            style={{ width: 180, height: 120 }}
            nodeColor={(node) => {
              if (node.type === "group") {
                return "rgb(82 82 91 / 0.4)";
              }
              if (node.type === "comment") {
                return "#fbbf24";
              }
              const t = (node.data as { type?: string } | undefined)?.type;
              return (t && MINIMAP_NODE_COLORS[t]) || "#3f3f46";
            }}
          />
        </ReactFlow>
      </div>

      {/* Canvas overlays — diagram info, protocol legend, node detail, status bar */}
      <DiagramInfoCard />
      <ProtocolLegend />
      <TagFilter />
      <NodeDetailPopup />
      <CanvasStatusBar />
      <SpotlightSearch />

      {/* Animation overlay for shatter/destroy effects */}
      <div id="animation-overlay" className="fixed inset-0 pointer-events-none z-100" />

      {/* Simulation floating panel */}
      {showSimulationPanel && (
        <SimulationPanel
          onClose={() => {
            setShowSimulationPanel(false);
            simulationSetMode("idle");
          }}
        />
      )}

      {/* Saved flows sidebar (anchored to the canvas right edge) */}
      {showFlowsPanel && (
        <div className="absolute top-0 right-0 h-full z-30">
          <FlowsPanel onClose={() => setShowFlowsPanel(false)} />
        </div>
      )}

      {/* Empty-canvas call to action */}
      {nodes.length === 0 && !showTemplateGallery && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto text-center px-8 py-7 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-sm">
            <Squares2X2Icon className="w-6 h-6 mx-auto text-zinc-400 dark:text-zinc-600" />
            <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Blank canvas
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 max-w-57.5">
              Start from a pre-designed architecture, or drag components from the left palette.
            </p>
            <button
              type="button"
              onClick={() => setShowTemplateGallery(true)}
              className="mt-4 text-xs font-medium px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors"
            >
              Browse starter templates
            </button>
          </div>
        </div>
      )}

      {/* Getting-started onboarding checklist (hidden while the sim bar is up) */}
      <GettingStartedChecklist hidden={showSimulationPanel} />
    </div>
  );
}
