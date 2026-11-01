import { useCallback, useRef, useEffect, useMemo, DragEvent, useState } from "react";
import { ReactFlow, MiniMap, useReactFlow, useStoreApi, Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useDiagramStore } from "@/store/diagramStore";
import { useSimulationStore } from "@/store/simulationStore";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useUIStore } from "@/store/uiStore";

import { nodeTypes } from "@/components/nodes";
import { edgeTypes } from "@/components/edges";
import { NODE_TYPES_CONFIG, GROUP_TYPES_CONFIG } from "@/constants";
import { architectureNodeTypeSchema, groupNodeTypeSchema } from "@/schemas/diagram";
import { paletteNodeTypeSchema, type PaletteNodeType } from "@/schemas/ui";
import { ArchitectureNode, GroupNodeData } from "@/types";
import { traceFlowPath } from "@/utils/graphTraversal";
import { applyGroupCollapse } from "@/utils/groupRollup";
import { cn } from "@/lib/utils";
import {
  ArrowDownTrayIcon,
  DocumentDuplicateIcon,
  ClipboardDocumentIcon,
  ArrowUpCircleIcon,
  ArrowDownCircleIcon,
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
import { FlowsPanel } from "@/components/panels/FlowsPanel";
import { ImportDialog } from "@/components/ui/ImportDialog";
import { TemplateGalleryDialog } from "@/components/ui/TemplateGalleryDialog";
import { LaserPointer } from "@/components/ui/LaserPointer";
import { ToolbarButton, ToolbarDivider } from "@/components/ui/ToolbarButton";
import {
  Activity,
  FileUp,
  Hand,
  Keyboard,
  LayoutTemplate,
  Minus,
  MousePointer2,
  Plus,
  Presentation,
  Route,
} from "lucide-react";
import { useSimulationAnimation } from "@/hooks/useSimulationAnimation";
import { useDestroyAnimation } from "@/hooks/useDestroyAnimation";
import { useChaosSimulation } from "@/hooks/useChaosSimulation";
import { useTrafficSimulation } from "@/hooks/useTrafficSimulation";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { useAutoFormat } from "@/hooks/useAutoFormat";
import { useEditorShortcuts } from "@/hooks/useEditorShortcuts";
import { useOnboardingStore } from "@/store/onboardingStore";

// Resolve the catalog's Tailwind colors through theme variables so new node
// types automatically receive matching minimap colors.
const MINIMAP_NODE_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(NODE_TYPES_CONFIG).map(([type, config]) => [
    type,
    `var(${config.iconColor.replace("text-", "--color-")})`,
  ]),
);

/**
 * Toolbar controls a phone doesn't need: pinch zooms, there's no keyboard, and presenting or
 * importing happen on larger screens. Keyed to the top bar's own width, not the window's.
 */
const PHONE_HIDDEN = "@max-md:hidden";

/** Builds the node a palette item creates; drop, keyboard quick-add and taps all share it. */
function createPaletteNode(type: PaletteNodeType, position: { x: number; y: number }): Node {
  if (type === "comment") {
    return {
      id: `comment-${Date.now()}`,
      type: "comment",
      position,
      data: { text: "Add your note here...", color: "yellow", createdAt: new Date().toISOString() },
    };
  }
  if (type.startsWith("group-")) {
    const groupType = groupNodeTypeSchema.parse(type.slice("group-".length));
    const group: Node<GroupNodeData> = {
      id: `group-${Date.now()}`,
      type: "group",
      position,
      zIndex: -1,
      style: { width: 300, height: 250 },
      data: { label: `New ${GROUP_TYPES_CONFIG[groupType].label}`, groupType, collapsed: false },
    };
    return group;
  }
  const nodeType = architectureNodeTypeSchema.parse(type);
  const node: ArchitectureNode = {
    id: `node-${Date.now()}`,
    type: "architecture",
    position,
    data: { label: `New ${NODE_TYPES_CONFIG[nodeType].label}`, type: nodeType },
  };
  return node;
}

export function DiagramEditor() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null!);
  const { screenToFlowPosition, zoomIn, zoomOut, getZoom, getIntersectingNodes } = useReactFlow();
  const rfStore = useStoreApi();
  const { autoFormat } = useAutoFormat();
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

  // Activate GSAP simulation, destroy, and chaos animation hooks
  useSimulationAnimation();
  useDestroyAnimation();
  useChaosSimulation();
  useTrafficSimulation();
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

    addNodeToGroup,
    removeNodeFromGroup,
    copySelectedNodes,
    pasteNodes,
    hasClipboardContent,
    bringNodeToFront,
    sendNodeToBack,
  } = useDiagramStore();
  const aiRunning = useAiDesignStore((state) => state.running);

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

  // Add a palette component at the center of the visible canvas (keyboard quick-add and taps)
  const addNodeAtCenter = useCallback(
    (type: PaletteNodeType) => {
      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) {
        return;
      }
      const position = screenToFlowPosition({
        x: bounds.left + bounds.width / 2,
        y: bounds.top + bounds.height / 2,
      });
      addNode(createPaletteNode(type, position));
    },
    [screenToFlowPosition, addNode],
  );

  // A palette item chosen by click or tap lands at the center of the view.
  const pendingPaletteAdd = useUIStore((s) => s.pendingPaletteAdd);
  useEffect(() => {
    if (pendingPaletteAdd) {
      addNodeAtCenter(pendingPaletteAdd);
      useUIStore.getState().completePaletteAdd();
    }
  }, [pendingPaletteAdd, addNodeAtCenter]);

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
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNode(createPaletteNode(parsedType.data, position));
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
      // In traffic or failure mode: take the component down or bring it back
      if (simulationMode === "traffic" || simulationMode === "failure") {
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
  useEditorShortcuts({
    addNodeAtCenter,
    selectMode: () => {
      setPanMode(false);
      setLaserMode(false);
    },
    panMode: () => {
      setPanMode(true);
      setLaserMode(false);
    },
    toggleLaser: () => {
      setLaserMode(!laserMode);
      setPanMode(false);
    },
    showShortcuts: () => setShowShortcuts(true),
    toggleSimulation: () => {
      setShowSimulationPanel(!showSimulationPanel);
      simulationSetMode(showSimulationPanel ? "idle" : "traffic");
    },
    autoFormat,
    escape: () => {
      if (showShortcuts) {
        setShowShortcuts(false);
      } else if (showImportDialog) {
        setShowImportDialog(false);
      } else if (showTemplateGallery) {
        setShowTemplateGallery(false);
      } else if (contextMenu.show) {
        setContextMenu((menu) => ({ ...menu, show: false }));
      } else {
        return false;
      }
      return true;
    },
  });

  return (
    <div
      className="flex-1 relative bg-white dark:bg-zinc-950 overflow-hidden"
      data-onboarding-pulse={onboardingActiveStep === "connect-nodes" ? "connect-nodes" : undefined}
    >
      {/* The canvas is inert while an AI run edits the diagram. Panels that must stay usable
          during a run (the AI design panel) render as siblings of this wrapper. */}
      <div className="absolute inset-0 overflow-hidden" inert={aiRunning}>
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
              data-editor-shortcuts="blocked"
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

        {/*
        Top bar: diagram card, toolbar and legend share one row so they can never overlap.
        Equal flexible side slots keep the toolbar centered while space allows; on a narrow
        canvas the toolbar wraps to a second line instead of running off the edge.
      */}
        <div className="@container absolute top-4 inset-x-4 z-20 flex flex-wrap items-start gap-x-3 gap-y-2 pointer-events-none">
          <div className="flex flex-1 basis-0 justify-start">
            <DiagramInfoCard />
          </div>
          {/* Toolbar: tools, zoom, then actions. Every control names itself and its shortcut. */}
          <div className="pointer-events-auto shrink-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur border border-zinc-200 dark:border-zinc-800 rounded-full p-1.5 flex items-center gap-1 shadow-lg shadow-black/20 dark:shadow-black/50">
            <ToolbarButton
              label="Select"
              shortcut="V"
              active={!panMode && !laserMode}
              onClick={() => {
                setPanMode(false);
                setLaserMode(false);
              }}
            >
              <MousePointer2 className="size-4" aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton
              label="Pan"
              shortcut="H"
              active={panMode}
              onClick={() => {
                setPanMode(true);
                setLaserMode(false);
              }}
            >
              <Hand className="size-4" aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton
              className={PHONE_HIDDEN}
              label="Laser pointer for presenting"
              shortcut="`"
              active={laserMode}
              onClick={() => {
                setLaserMode(!laserMode);
                setPanMode(false);
              }}
            >
              <Presentation className="size-4" aria-hidden="true" />
            </ToolbarButton>
            <ToolbarDivider className={PHONE_HIDDEN} />
            <ToolbarButton
              className={PHONE_HIDDEN}
              label="Zoom out"
              shortcut="−"
              onClick={() => void zoomOut()}
            >
              <Minus className="size-4" aria-hidden="true" />
            </ToolbarButton>
            <span
              className={cn(
                "text-xs font-medium text-muted-foreground tabular-nums flex items-center px-1",
                PHONE_HIDDEN,
              )}
            >
              {zoom}%
            </span>
            <ToolbarButton
              className={PHONE_HIDDEN}
              label="Zoom in"
              shortcut="+"
              onClick={() => void zoomIn()}
            >
              <Plus className="size-4" aria-hidden="true" />
            </ToolbarButton>
            <ToolbarDivider />
            <ToolbarButton
              className={PHONE_HIDDEN}
              label="Import diagram"
              onClick={() => setShowImportDialog(true)}
            >
              <FileUp className="size-4" aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton label="Starter templates" onClick={() => setShowTemplateGallery(true)}>
              <LayoutTemplate className="size-4" aria-hidden="true" />
            </ToolbarButton>
            <ToolbarDivider />
            <ToolbarButton
              label="Simulate requests and failures"
              showLabel="Simulate"
              shortcut="⇧S"
              active={showSimulationPanel}
              className={cn(
                onboardingActiveStep === "run-flow-sim" &&
                  "onboarding-pulse text-amber-600 dark:text-amber-400",
              )}
              onClick={() => {
                setShowSimulationPanel((v) => !v);
                simulationSetMode(showSimulationPanel ? "idle" : "traffic");
              }}
            >
              <Activity className="size-4" aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton
              label="Saved request flows"
              active={showFlowsPanel}
              onClick={() => setShowFlowsPanel((v) => !v)}
            >
              <Route className="size-4" aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton
              className={PHONE_HIDDEN}
              label="Keyboard shortcuts"
              shortcut="?"
              onClick={() => setShowShortcuts(true)}
            >
              <Keyboard className="size-4" aria-hidden="true" />
            </ToolbarButton>
          </div>
          <div className="flex flex-1 basis-0 justify-end">
            <ProtocolLegend />
          </div>
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
            <dialog
              open
              aria-modal="true"
              aria-label="Keyboard shortcuts"
              className="relative border-0 bg-transparent p-0"
            >
              <ShortcutsHelp onClose={() => setShowShortcuts(false)} />
            </dialog>
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
    </div>
  );
}
