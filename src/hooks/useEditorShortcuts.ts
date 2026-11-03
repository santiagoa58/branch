import { useEffect, useLayoutEffect, useRef } from "react";
import { useAnimationStore } from "@/store/animationStore";
import { useDiagramStore } from "@/store/diagramStore";
import { editBlockReason } from "@/store/editLock";
import { useUIStore } from "@/store/uiStore";
import {
  getEditorShortcut,
  type EditorShortcut,
  type QuickAddNodeType,
} from "@/utils/editorShortcuts";
import { getVisibleRepresentative } from "@/utils/groupRollup";
import { hasBlockingEditorOverlay, isTextEditingEvent } from "@/utils/keyboardContext";

interface EditorShortcutActions {
  addNodeAtCenter: (type: QuickAddNodeType) => void;
  selectMode: () => void;
  panMode: () => void;
  toggleLaser: () => void;
  showShortcuts: () => void;
  toggleSimulation: () => void;
  autoFormat: () => void;
  /** Close an editor-owned overlay, returning whether Escape was consumed. */
  escape: () => boolean;
}

function selectedNodeIds() {
  const { nodes, selectedNodeId } = useDiagramStore.getState();
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const visible = nodes.filter((node) => getVisibleRepresentative(node.id, byId) === node.id);
  const selected = visible.filter((node) => node.selected).map((node) => node.id);
  return selected.length > 0
    ? selected
    : visible.filter((node) => node.id === selectedNodeId).map((node) => node.id);
}

function clearSelection() {
  const state = useDiagramStore.getState();
  state.setSelectedNode(null);
  state.onNodesChange(
    state.nodes
      .filter((node) => node.selected)
      .map((node) => ({ id: node.id, type: "select", selected: false })),
  );
  state.onEdgesChange(
    state.edges
      .filter((edge) => edge.selected)
      .map((edge) => ({ id: edge.id, type: "select", selected: false })),
  );
}

// oxlint-disable-next-line complexity -- debt: complexity 24; extract branches
function executeShortcut(command: EditorShortcut, actions: EditorShortcutActions): boolean {
  const state = useDiagramStore.getState();
  const ui = useUIStore.getState();
  switch (command.type) {
    case "add-node":
      actions.addNodeAtCenter(command.nodeType);
      return true;
    case "select-mode":
      actions.selectMode();
      return true;
    case "pan-mode":
      actions.panMode();
      return true;
    case "toggle-laser":
      actions.toggleLaser();
      return true;
    case "show-shortcuts":
      actions.showShortcuts();
      return true;
    case "toggle-simulation":
      actions.toggleSimulation();
      return true;
    case "auto-format":
      actions.autoFormat();
      return true;
    case "toggle-left-panel":
      ui.toggleLeftPanel();
      return true;
    case "toggle-right-panel":
      ui.toggleRightPanel();
      return true;
    case "spotlight":
      ui.setSpotlightOpen(true);
      return true;
    case "undo":
      state.undo();
      return true;
    case "redo":
      state.redo();
      return true;
    case "paste":
      if (!state.hasClipboardContent()) {
        return false;
      }
      state.pasteNodes();
      return true;
    case "copy-selection": {
      const selected = new Set(selectedNodeIds());
      if (selected.size === 0) {
        return false;
      }
      // Selection through Spotlight or the details panel may only set selectedNodeId.
      state.onNodesChange(
        state.nodes
          .filter((node) => Boolean(node.selected) !== selected.has(node.id))
          .map((node) => ({ id: node.id, type: "select", selected: selected.has(node.id) })),
      );
      useDiagramStore.getState().copySelectedNodes();
      return true;
    }
    case "duplicate-selection": {
      const ids = selectedNodeIds();
      if (ids.length > 0) {
        state.duplicateNodes(ids);
      }
      return true;
    }
    case "delete-selection": {
      const ids = selectedNodeIds();
      if (ids.length > 0) {
        useAnimationStore.getState().requestDeleteMultiple(ids);
        return true;
      }
      const edges = state.edges.filter((edge) => edge.selected || edge.id === state.selectedEdgeId);
      if (edges.length === 0) {
        return false;
      }
      state.setSelectedEdge(null);
      state.onEdgesChange(edges.map((edge) => ({ id: edge.id, type: "remove" })));
      return true;
    }
    case "select-all": {
      const byId = new Map(state.nodes.map((node) => [node.id, node]));
      state.setSelectedNode(null);
      state.onNodesChange(
        state.nodes.map((node) => ({
          id: node.id,
          type: "select",
          selected:
            node.selectable !== false && getVisibleRepresentative(node.id, byId) === node.id,
        })),
      );
      state.onEdgesChange(
        state.edges
          .filter((edge) => edge.selected)
          .map((edge) => ({ id: edge.id, type: "select", selected: false })),
      );
      return true;
    }
    case "escape":
      clearSelection();
      actions.selectMode();
      return true;
  }
}

/** One listener with exact matching, contextual scope, and live graph state. */
export function useEditorShortcuts(actions: EditorShortcutActions) {
  const actionsRef = useRef(actions);
  useLayoutEffect(() => {
    actionsRef.current = actions;
  });
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const command = getEditorShortcut(event);
      if (!command) {
        return;
      }
      if (command.type === "escape") {
        const ui = useUIStore.getState();
        if (ui.spotlightOpen) {
          ui.setSpotlightOpen(false);
          event.preventDefault();
          return;
        }
        if (actionsRef.current.escape()) {
          event.preventDefault();
          return;
        }
      }
      if (isTextEditingEvent(event) || hasBlockingEditorOverlay()) {
        return;
      }
      if (editBlockReason() !== null) {
        return;
      }
      if (command.type === "copy-selection" && window.getSelection()?.toString()) {
        return;
      }
      if (executeShortcut(command, actionsRef.current)) {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
