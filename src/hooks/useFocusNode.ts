import { useCallback } from "react";
import { useReactFlow, useStoreApi, type EdgeChange, type NodeChange } from "@xyflow/react";
import { useDiagramStore } from "@/store/diagramStore";
import { useUIStore } from "@/store/uiStore";
import {
  absolutePosition,
  COLLAPSED_GROUP_HEIGHT,
  COLLAPSED_GROUP_WIDTH,
  getVisibleRepresentative,
} from "@/utils/groupRollup";
import { leafSize } from "@/utils/layout/geometry";

/** Zoom a focused node is shown at, unless the view is already closer. */
const FOCUS_ZOOM = 1.1;
/** Share of the viewport a node too large for that zoom may fill instead. */
const FOCUS_FILL = 0.8;
const FOCUS_DURATION_MS = 400;

/** Selects exactly `nodeId`, as a click on the canvas would, in React Flow's flags and the inspector. */
function selectOnly(nodeId: string) {
  const diagram = useDiagramStore.getState();
  const nodeChanges: NodeChange[] = diagram.nodes
    .filter((node) => Boolean(node.selected) !== (node.id === nodeId))
    .map((node) => ({ id: node.id, type: "select", selected: node.id === nodeId }));
  if (nodeChanges.length > 0) {
    diagram.onNodesChange(nodeChanges);
  }
  const edgeChanges: EdgeChange[] = diagram.edges
    .filter((edge) => edge.selected)
    .map((edge) => ({ id: edge.id, type: "select", selected: false }));
  if (edgeChanges.length > 0) {
    diagram.onEdgesChange(edgeChanges);
  }
  diagram.setSelectedNode(nodeId);
}

/**
 * Selects one node and smoothly centers the view on it: the shared "jump to node" path for
 * Spotlight and the design panel. On a compact screen it hides the panels covering the canvas.
 */
export function useFocusNode(): (nodeId: string) => void {
  const { setCenter, getZoom } = useReactFlow();
  const rfStore = useStoreApi();

  return useCallback(
    (nodeId: string) => {
      const byId = new Map(useDiagramStore.getState().nodes.map((node) => [node.id, node]));
      const node = byId.get(nodeId);
      if (!node) {
        return;
      }
      selectOnly(nodeId);

      // A child of a collapsed group is hidden; the outermost collapsed group stands in for it.
      const shownId = getVisibleRepresentative(nodeId, byId);
      const shown = byId.get(shownId) ?? node;
      const { nodeLookup, width, height } = rfStore.getState();
      const internal = nodeLookup.get(shownId);
      // Child positions are parent-relative. React Flow's measured absolute position is
      // authoritative; before it has measured, add up the parent chain.
      const position = internal?.internals.positionAbsolute ?? absolutePosition(shown, byId);
      const size = internal
        ? leafSize(internal)
        : shown.type === "group" && shown.data["collapsed"] === true
          ? { width: COLLAPSED_GROUP_WIDTH, height: COLLAPSED_GROUP_HEIGHT }
          : leafSize(shown);
      const fitZoom =
        width > 0 && height > 0
          ? Math.min(width / size.width, height / size.height) * FOCUS_FILL
          : Number.POSITIVE_INFINITY;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      void setCenter(position.x + size.width / 2, position.y + size.height / 2, {
        zoom: Math.min(Math.max(getZoom(), FOCUS_ZOOM), fitZoom),
        duration: reduceMotion ? 0 : FOCUS_DURATION_MS,
      });
      useUIStore.getState().revealCanvas();
    },
    [setCenter, getZoom, rfStore],
  );
}
