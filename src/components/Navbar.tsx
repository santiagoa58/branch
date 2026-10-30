import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  ShareIcon,
  ArrowDownTrayIcon,
  CodeBracketIcon,
  PhotoIcon,
  DocumentTextIcon,
  CheckIcon,
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  Squares2X2Icon,
  RectangleStackIcon,
  SparklesIcon,
  HeartIcon,
  ChevronRightIcon,
  ClockIcon,
  BookmarkIcon,
} from "@heroicons/react/24/outline";
import { useAnimationStore } from "@/store/animationStore";
import { useDiagramStore } from "@/store/diagramStore";
import { useThemeStore } from "@/store/themeStore";
import { useUIStore } from "@/store/uiStore";
import { projectsApi } from "@/services/api";
import { copyShareableLink } from "@/utils/export";
import { cloudWorkspace, useCloudWorkspace } from "@/services/cloudWorkspace";
import { AccountControls } from "@/components/CloudAuth";
import { Brand } from "@/components/Brand";
import { notify } from "@/services/notify";
import { SettingsPanel } from "@/components/panels/SettingsPanel";
import { VersionsPanel } from "@/components/panels/VersionsPanel";
import { SaveVersionDialog } from "@/components/ui/SaveVersionDialog";
import { ExportPreviewDialog } from "@/components/ui/ExportPreviewDialog";
import { Tooltip } from "@/components/ui/Tooltip";
import { LoadingIndicator } from "@/components/ui/loading";
import { ArchitectureNodeData } from "@/types";

export function Navbar() {
  const cloud = useCloudWorkspace();
  const diagram = cloud.diagram;
  const { projectId, diagramId } = useParams<{ projectId: string; diagramId: string }>();
  const navigate = useNavigate();

  const { data: project } = useQuery({
    queryKey: ["projects", projectId],
    queryFn: () => projectsApi.get(projectId!),
    enabled: !!projectId,
  });

  const {
    undo,
    redo,
    canUndo,
    canRedo,
    applyAutoLayout,
    nodes,
    runAllHealthChecks,
    healthCheckResults,
  } = useDiagramStore();
  const { theme, setTheme } = useThemeStore();
  const {
    leftPanelVisible,
    rightPanelVisible,
    toggleLeftPanel,
    toggleRightPanel,
  } = useUIStore();
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [layoutDropdownOpen, setLayoutDropdownOpen] = useState(false);
  const [isExporting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState<"png" | "svg" | "pdf" | "json">(
    "png",
  );
  const [isTestingHealth, setIsTestingHealth] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [saveVersionOpen, setSaveVersionOpen] = useState(false);
  const queryClient = useQueryClient();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const layoutDropdownRef = useRef<HTMLDivElement>(null);

  const saveVersionMutation = useMutation({
    mutationFn: (label: string) => {
      if (useAnimationStore.getState().pendingDeletions.size) {
        throw new Error("Wait for deletions to finish before saving a version.");
      }
      return cloudWorkspace.createVersion(label || undefined);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["versions", diagramId] });
      setSaveVersionOpen(false);
      notify.success({ title: "Version saved", message: "Snapshot added to version history" });
    },
    onError: () => {
      notify.error({ title: "Failed to save version" });
    },
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setExportDropdownOpen(false);
      }
      if (layoutDropdownRef.current && !layoutDropdownRef.current.contains(event.target as Node)) {
        setLayoutDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExport = (type: "png" | "svg" | "pdf" | "json") => {
    setSelectedExportFormat(type);
    setExportDropdownOpen(false);
    setExportPreviewOpen(true);
  };

  const handleShareLink = async () => {
    try {
      await copyShareableLink();
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  const handleLayout = (direction: "TB" | "LR") => {
    applyAutoLayout(direction);
    setLayoutDropdownOpen(false);
  };

  const handleTestHealth = async () => {
    // Count nodes with health check URLs
    const healthCheckNodes = nodes.filter(
      (n) => n.type === "architecture" && (n.data as ArchitectureNodeData).healthCheckUrl,
    );

    if (healthCheckNodes.length === 0) {
      notify.warning({
        title: "No health checks configured",
        message: "Add health check URLs to nodes in the Properties panel",
        duration: 4000,
      });
      return;
    }

    setIsTestingHealth(true);

    try {
      await runAllHealthChecks();

      // Count results
      const healthyCount = Object.values(healthCheckResults).filter(
        (r) => r.status === "healthy",
      ).length;
      const totalCount = healthCheckNodes.length;

      if (healthyCount === totalCount) {
        notify.success({
          title: `All ${totalCount} services healthy ✓`,
          duration: 4000,
        });
      } else {
        const unhealthyCount = totalCount - healthyCount;
        notify.error({
          title: `${unhealthyCount}/${totalCount} services unhealthy`,
          message: "Check the Properties panel for details",
          duration: 5000,
        });
      }
    } catch {
      notify.error({
        title: "Health check failed",
        message: "An unexpected error occurred",
        duration: 4000,
      });
    } finally {
      setIsTestingHealth(false);
    }
  };

  const cycleTheme = () => {
    setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");
  };

  const getThemeIcon = () => {
    switch (theme) {
      case "light":
        return <SunIcon className="w-3.5 h-3.5" />;
      case "dark":
        return <MoonIcon className="w-3.5 h-3.5" />;
      case "system":
        return <ComputerDesktopIcon className="w-3.5 h-3.5" />;
    }
  };

  return (
    <header className="h-14 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md z-50">
      <div className="flex items-center gap-3">
        <nav className="flex items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => {
              void navigate("/");
            }}
            className="rounded-lg hover:opacity-80 transition-opacity duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <Brand />
          </button>
          {project && (
            <>
              <ChevronRightIcon className="w-3 h-3 text-zinc-400" />
              <button
                type="button"
                onClick={() => {
                  void navigate(`/projects/${projectId}`);
                }}
                className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors truncate max-w-30"
              >
                {project.name}
              </button>
            </>
          )}
          {diagram && (
            <>
              <ChevronRightIcon className="w-3 h-3 text-zinc-400" />
              <span className="text-zinc-500 dark:text-zinc-400 truncate max-w-30">
                {diagram.name}
              </span>
            </>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        {/* Panel Toggles */}
        <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-1 gap-1">
          <Tooltip content="Components panel">
            <button
              type="button"
              onClick={toggleLeftPanel}
              className={`p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors ${
                leftPanelVisible
                  ? "text-zinc-900 dark:text-zinc-100 bg-zinc-200 dark:bg-zinc-800"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <Squares2X2Icon className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Tooltip content="Properties panel">
            <button
              type="button"
              onClick={toggleRightPanel}
              className={`p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors ${
                rightPanelVisible
                  ? "text-zinc-900 dark:text-zinc-100 bg-zinc-200 dark:bg-zinc-800"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              <RectangleStackIcon className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>

        {/* Undo/Redo */}
        <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-1 gap-1">
          <Tooltip content="Undo (⌘Z)">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo()}
              className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
          <Tooltip content="Redo (⌘⇧Z)">
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo()}
              className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowUturnRightIcon className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>

        {/* Auto-Layout Dropdown */}
        <div className="relative" ref={layoutDropdownRef}>
          <Tooltip content="Auto-arrange layout (⌘L)">
            <button
              type="button"
              onClick={() => setLayoutDropdownOpen(!layoutDropdownOpen)}
              className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
            >
              <SparklesIcon className="w-3.5 h-3.5" strokeWidth={2} />
              Layout
            </button>
          </Tooltip>

          {/* Layout Dropdown Menu */}
          {layoutDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden animate-slide-in">
              <div className="p-1">
                <button
                  type="button"
                  onClick={() => handleLayout("TB")}
                  className="w-full text-left px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white rounded-md flex items-center gap-2"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                  Top to Bottom
                </button>
                <button
                  type="button"
                  onClick={() => handleLayout("LR")}
                  className="w-full text-left px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white rounded-md flex items-center gap-2"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                  Left to Right
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Version History */}
        {diagramId && (
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-1 gap-1">
            <Tooltip content="Save version snapshot">
              <button
                type="button"
                onClick={() => setSaveVersionOpen(true)}
                className="flex items-center gap-1 p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                <BookmarkIcon className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
            <Tooltip content="Version history">
              <button
                type="button"
                onClick={() => setVersionsOpen(true)}
                className="flex items-center gap-1.5 p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors text-xs"
              >
                <ClockIcon className="w-3.5 h-3.5" />
              </button>
            </Tooltip>
          </div>
        )}

        {/* Export Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <Tooltip content="Export diagram">
            <button
              type="button"
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              disabled={isExporting}
              className="flex items-center gap-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-zinc-100 dark:text-zinc-900 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors shadow-sm disabled:opacity-50"
            >
              {isExporting ? (
                <LoadingIndicator className="size-3.5" />
              ) : (
                <ArrowDownTrayIcon className="w-3.5 h-3.5" strokeWidth={2} />
              )}
              {isExporting ? "Exporting..." : "Export"}
            </button>
          </Tooltip>

          {/* Dropdown Menu */}
          {exportDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl z-50 overflow-hidden animate-slide-in">
              <div className="p-1">
                <button
                  type="button"
                  onClick={() => handleExport("svg")}
                  className="w-full text-left px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white rounded-md flex items-center gap-2"
                >
                  <CodeBracketIcon className="w-3.5 h-3.5" />
                  SVG Vector
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("png")}
                  className="w-full text-left px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white rounded-md flex items-center gap-2"
                >
                  <PhotoIcon className="w-3.5 h-3.5" />
                  PNG Image
                </button>
                <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-1" />
                <button
                  type="button"
                  onClick={() => handleExport("pdf")}
                  className="w-full text-left px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white rounded-md flex items-center gap-2"
                >
                  <DocumentTextIcon className="w-3.5 h-3.5" />
                  PDF Report
                </button>
                <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-1" />
                <button
                  type="button"
                  onClick={() => handleExport("json")}
                  className="w-full text-left px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white rounded-md flex items-center gap-2"
                >
                  <CodeBracketIcon className="w-3.5 h-3.5" />
                  JSON Data
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Test Health Button */}
        <Tooltip content="Run health checks">
          <button
            type="button"
            onClick={() => {
              void handleTestHealth();
            }}
            disabled={isTestingHealth}
            className="bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 p-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTestingHealth ? (
              <LoadingIndicator className="size-3.5" />
            ) : (
              <HeartIcon className="w-3.5 h-3.5" />
            )}
          </button>
        </Tooltip>

        <output
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400"
          title={cloud.message ?? undefined}
        >
          {(cloud.status === "loading" ||
            cloud.status === "pending" ||
            cloud.status === "saving" ||
            cloud.status === "versioning" ||
            cloud.status === "restoring") && <LoadingIndicator className="size-3" />}
          {cloud.status === "saved"
            ? "Saved"
            : cloud.status === "saving"
              ? "Saving…"
              : cloud.status === "pending"
                ? "Unsaved edits"
                : cloud.status === "conflict"
                  ? "Save conflict"
                  : cloud.status === "error"
                    ? "Save failed"
                    : "Loading…"}
        </output>
        <AccountControls />

        {/* Theme Toggle */}
        <Tooltip content={`Theme: ${theme} — click to cycle`}>
          <button
            type="button"
            onClick={cycleTheme}
            className="bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 p-1.5 rounded-md transition-colors"
          >
            {getThemeIcon()}
          </button>
        </Tooltip>

        {/* Share Button */}
        <Tooltip
          content={
            copiedLink ? "Link copied!" : "Copy private link (only your account can open it)"
          }
        >
          <button
            type="button"
            onClick={() => {
              void handleShareLink();
            }}
            className="bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 p-1.5 rounded-md transition-colors flex items-center gap-1.5"
          >
            {copiedLink ? (
              <>
                <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-emerald-400">Copied!</span>
              </>
            ) : (
              <ShareIcon className="w-3.5 h-3.5" />
            )}
          </button>
        </Tooltip>
      </div>

      {/* Settings Modal */}
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Export Preview Modal */}
      <ExportPreviewDialog
        isOpen={exportPreviewOpen}
        onClose={() => setExportPreviewOpen(false)}
        initialFormat={selectedExportFormat}
      />

      {/* Version History Modal */}
      {diagramId && (
        <VersionsPanel
          isOpen={versionsOpen}
          onClose={() => setVersionsOpen(false)}
          diagramId={diagramId}
        />
      )}

      {/* Save Version Dialog */}
      {diagramId && (
        <SaveVersionDialog
          isOpen={saveVersionOpen}
          isSaving={saveVersionMutation.isPending}
          onSave={(label) => saveVersionMutation.mutate(label)}
          onClose={() => setSaveVersionOpen(false)}
        />
      )}
    </header>
  );
}
