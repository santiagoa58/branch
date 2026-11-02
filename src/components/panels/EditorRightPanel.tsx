import { useAiDesignStore } from "@/store/aiDesignStore";
import { useDiagramStore } from "@/store/diagramStore";
import { useUIStore } from "@/store/uiStore";
import { PropertiesPanel } from "./PropertiesPanel";
import { DesignPanel } from "./design/DesignPanel";

/**
 * The editor's right-hand slot. The inspector takes precedence while something is selected, so
 * closing it shows the design panel again. During an AI run the canvas is inert, so the design
 * panel (with its progress and Cancel) is always shown. Below lg the slot slides over the canvas.
 */
export function EditorRightPanel() {
  const rightPanelVisible = useUIStore((state) => state.rightPanelVisible);
  const designPanelOpen = useUIStore((state) => state.designPanelOpen);
  const hasSelection = useDiagramStore(
    (state) => state.selectedNodeId !== null || state.selectedEdgeId !== null,
  );
  const aiRunning = useAiDesignStore((state) => state.running);

  if (!rightPanelVisible && !aiRunning) {
    return null;
  }
  const showDesign = aiRunning || (designPanelOpen && !hasSelection);
  return (
    <div className="flex max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-40 max-lg:max-w-full max-lg:shadow-2xl">
      {showDesign ? <DesignPanel /> : <PropertiesPanel />}
    </div>
  );
}
