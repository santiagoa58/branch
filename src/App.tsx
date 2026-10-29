import { ReactFlowProvider } from "@xyflow/react";
import { DiagramEditor } from "@/components/DiagramEditor";
import { NodePalette } from "@/components/panels/NodePalette";
import { PropertiesPanel } from "@/components/panels/PropertiesPanel";
import { Navbar } from "@/components/Navbar";
import { JoinDiagramDialog } from "@/components/ui/JoinDiagramDialog";
import { useThemeStore } from "@/store/themeStore";
import { useUIStore } from "@/store/uiStore";
import { useDiagramStore } from "@/store/diagramStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { useCollaboration } from "@/hooks/useCollaboration";
import { diagramsApi } from "@/services/api";
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { diagramDataSchema } from "@/schemas/diagram";
import { ENABLE_COLLAB, IS_SERVER_MODE } from "@/config/runtime";
import { Toaster } from "sileo";
import { loadCollaboratorName } from "@/services/collaborationIdentity";

function App() {
  const theme = useThemeStore((state) => state.theme);
  const { leftPanelVisible, rightPanelVisible } = useUIStore();
  const { importDiagram, loadDiagram, resetDiagramState } = useDiagramStore();
  const { setCurrentProject, setCurrentDiagram } = useWorkspaceStore();
  const { projectId, diagramId } = useParams<{ projectId: string; diagramId: string }>();

  // Collaboration state
  const [collabUserName, setCollabUserName] = useState(loadCollaboratorName);
  const showJoinDialog = ENABLE_COLLAB && !!diagramId && !collabUserName;

  // Guard flag to prevent sync loops: remote update → store → send → remote...
  const isApplyingRemoteRef = useRef(false);

  // Callback when remote diagram state arrives
  const handleRemoteDiagramState = useCallback(
    (nodes: import("@xyflow/react").Node[], edges: import("@xyflow/react").Edge[]) => {
      const result = diagramDataSchema.safeParse({ nodes, edges });
      if (!result.success) {
        console.error("Ignored invalid collaborative diagram state:", result.error);
        return;
      }
      isApplyingRemoteRef.current = true;
      importDiagram(result.data);
      // Reset flag after a tick so the store subscription doesn't re-broadcast
      requestAnimationFrame(() => {
        isApplyingRemoteRef.current = false;
      });
    },
    [importDiagram],
  );

  const {
    users: collabUsers,
    remoteCursors,
    connected: collabConnected,
    sendCursorUpdate,
    sendDiagramState,
    myColor,
  } = useCollaboration({
    diagramId: ENABLE_COLLAB ? (diagramId ?? null) : null,
    userName: ENABLE_COLLAB ? collabUserName : null,
    onRemoteDiagramState: handleRemoteDiagramState,
  });

  // Subscribe to diagramStore changes and broadcast to other clients
  useEffect(() => {
    if (!ENABLE_COLLAB || !collabConnected || !diagramId) {
      return;
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const unsubscribe = useDiagramStore.subscribe((state) => {
      if (isApplyingRemoteRef.current) {
        return;
      }

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        sendDiagramState(state.nodes, state.edges);
      }, 50);
    });

    return () => {
      unsubscribe();
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [collabConnected, diagramId, sendDiagramState]);

  // Track current project/diagram in workspace store
  useEffect(() => {
    setCurrentProject(projectId ?? null);
    setCurrentDiagram(diagramId ?? null);
  }, [projectId, diagramId, setCurrentProject, setCurrentDiagram]);

  // Load diagram data based on runtime mode
  useEffect(() => {
    if (IS_SERVER_MODE && diagramId) {
      // Always clear the previous diagram's data immediately to avoid cross-contamination
      resetDiagramState();
      diagramsApi
        .get(diagramId)
        .then((diagram) => {
          const result = diagramDataSchema.safeParse(diagram.data);
          if (result.success && (result.data.nodes.length > 0 || result.data.edges.length > 0)) {
            importDiagram(result.data);
          } else if (!result.success) {
            console.error("Ignored invalid diagram data from API:", result.error);
          }
          // If the diagram has no data yet (newly created), store is already empty — no fallback
        })
        .catch(() => {
          // Fallback to per-diagram localStorage key if API is unavailable
          loadDiagram();
        });
    } else {
      loadDiagram();
    }
  }, [diagramId, importDiagram, loadDiagram, resetDiagramState]);

  // Apply theme on mount and when it changes
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  return (
    <ReactFlowProvider>
      <div className="h-screen w-screen overflow-hidden flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-300 antialiased">
        {/* Join Dialog */}
        <JoinDiagramDialog open={showJoinDialog} onJoin={(name) => setCollabUserName(name)} />

        {/* Navbar */}
        <Navbar collabUsers={collabUsers} collabConnected={collabConnected} />

        {/* Main Layout */}
        <main className="flex-1 flex overflow-hidden">
          {/* Left Sidebar: Toolbox */}
          {leftPanelVisible && <NodePalette />}

          {/* Center: Interactive Canvas */}
          <DiagramEditor
            remoteCursors={remoteCursors}
            sendCursorUpdate={sendCursorUpdate}
            myColor={myColor}
          />

          {/* Right Sidebar: Properties */}
          {rightPanelVisible && <PropertiesPanel />}
        </main>

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
