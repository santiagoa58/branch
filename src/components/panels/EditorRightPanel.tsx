import { useAiDesignStore } from "@/store/aiDesignStore";
import { useDiagramStore } from "@/store/diagramStore";
import { useUIStore } from "@/store/uiStore";
import { PropertiesPanel } from "./PropertiesPanel";
import { DesignPanel } from "./design/DesignPanel";

/**
 * The editor's right-hand slot. The inspector takes precedence while something is selected, so
 * closing it shows the design panel again. During an AI run the slot shows the design panel (with
 * its progress and Cancel) unless the viewer selects something to inspect; the canvas stays
 * usable, so "Design with AI" brings the panel back once hidden. Below lg the slot slides over
 * the canvas.
 */
export function EditorRightPanel() {
  const rightPanelVisible = useUIStore((state) => state.rightPanelVisible);
  const designPanelOpen = useUIStore((state) => state.designPanelOpen);
  const hasSelection = useDiagramStore(
    (state) => state.selectedNodeId !== null || state.selectedEdgeId !== null,
  );
  const aiRunning = useAiDesignStore((state) => state.running);

  if (!rightPanelVisible) {
    return null;
  }
  const showDesign = !hasSelection && (designPanelOpen || aiRunning);
  return (
    <div className="flex max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-40 max-lg:max-w-full max-lg:shadow-2xl">
      {showDesign ? <DesignPanel /> : <PropertiesPanel />}
    </div>
  );
}
