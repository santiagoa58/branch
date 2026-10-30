import { ReactFlowProvider } from "@xyflow/react";
import { DiagramEditor } from "@/components/DiagramEditor";
import { NodePalette } from "@/components/panels/NodePalette";
import { PropertiesPanel } from "@/components/panels/PropertiesPanel";
import { Navbar } from "@/components/Navbar";
import { CloudNavigationGuard, CloudSaveError } from "@/components/CloudSaveStatus";
import { useThemeStore } from "@/store/themeStore";
import { useUIStore } from "@/store/uiStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { cloudWorkspace, useCloudWorkspace } from "@/services/cloudWorkspace";
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { Toaster } from "sileo";

function App() {
  const theme = useThemeStore((state) => state.theme);
  const { leftPanelVisible, rightPanelVisible } = useUIStore();
  const { setCurrentProject, setCurrentDiagram } = useWorkspaceStore();
  const { projectId, diagramId } = useParams<{ projectId: string; diagramId: string }>();
  const cloud = useCloudWorkspace();
  useEffect(() => {
    setCurrentProject(projectId ?? null);
    setCurrentDiagram(diagramId ?? null);
    if (diagramId) {
      void cloudWorkspace.load(diagramId, projectId).catch(() => {});
    }
    return () => {
      cloudWorkspace.cancelLoad();
    };
  }, [projectId, diagramId, setCurrentProject, setCurrentDiagram]);

  const loaded = cloud.diagram?.id === diagramId;
  const locked = cloud.status === "loading" || cloud.locked;
  return (
    <ReactFlowProvider>
      <div className="h-screen w-screen overflow-hidden flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-300 antialiased">
        <CloudNavigationGuard />
        <Navbar />
        <CloudSaveError />
        {!loaded ? (
          <div
            className="flex-1 grid place-content-center text-sm text-zinc-500"
            role={cloud.status === "load-error" ? "alert" : "status"}
          >
            {cloud.status === "load-error" ? (
              <>
                <p>{cloud.message}</p>
                <button
                  type="button"
                  className="mt-3 underline"
                  onClick={() => {
                    if (diagramId) {
                      void cloudWorkspace.load(diagramId, projectId);
                    }
                  }}
                >
                  Retry loading
                </button>
              </>
            ) : (
              "Loading diagram…"
            )}
          </div>
        ) : (
          <main className="flex-1 flex overflow-hidden relative" inert={locked}>
            {leftPanelVisible && <NodePalette />}
            <DiagramEditor />
            {rightPanelVisible && <PropertiesPanel />}
          </main>
        )}
        {loaded && locked && (
          <output className="fixed inset-0 z-90 grid place-content-center bg-black/20 text-sm text-zinc-900 dark:text-zinc-100">
            {cloud.status === "restoring" ? "Restoring version…" : "Saving version…"}
          </output>
        )}
        <Toaster
          position="top-right"
          offset={{ top: 16, right: 16 }}
          theme={theme}
          options={{
            roundness: 12,
            styles: {
              title: "text-sm font-semibold text-zinc-900 dark:text-zinc-100!",
              description: "text-sm text-zinc-600 dark:text-zinc-400!",
              badge: "bg-zinc-200/80 dark:bg-zinc-800/80!",
              button: "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100!",
            },
          }}
        />
      </div>
    </ReactFlowProvider>
  );
}
export default App;
