import type { SaveStatus } from "@/services/cloudPersistence";
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
  Squares2X2Icon,
  RectangleStackIcon,
  SparklesIcon,
  ChevronRightIcon,
  ClockIcon,
  BookmarkIcon,
} from "@heroicons/react/24/outline";
import { useAnimationStore } from "@/store/animationStore";
import { useAutoFormat } from "@/hooks/useAutoFormat";
import { useDiagramStore } from "@/store/diagramStore";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useUIStore } from "@/store/uiStore";

import { workspaceQuery } from "@/services/workspaceQuery";
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

// Typed over every status so a new status can't silently fall through to the wrong label.
const SAVE_STATUS_LABELS: Record<SaveStatus, string> = {
  idle: "",
  loading: "Loading…",
  "load-error": "Not loaded",
  saved: "Saved",
  pending: "Unsaved edits",
  saving: "Saving…",
  error: "Save failed",
  conflict: "Save conflict",
  versioning: "Saving version…",
  restoring: "Restoring…",
};

export function Navbar() {
  const cloud = useCloudWorkspace();
  const diagram = cloud.diagram;
  const { projectId, diagramId } = useParams<{ projectId: string; diagramId: string }>();
  const navigate = useNavigate();

  const { data: project } = useQuery({
    ...workspaceQuery.project(projectId ?? ""),
    enabled: !!projectId,
  });

  const { undo, redo, canUndo, canRedo } = useDiagramStore();

  const { leftPanelVisible, rightPanelVisible, toggleLeftPanel, toggleRightPanel } = useUIStore();
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [isExporting] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState<"png" | "svg" | "pdf" | "json">(
    "png",
  );
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [saveVersionOpen, setSaveVersionOpen] = useState(false);
  const queryClient = useQueryClient();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { autoFormat, disabled: formatDisabled } = useAutoFormat();

  const saveVersionMutation = useMutation({
    mutationFn: (label: string) => {
      if (useAnimationStore.getState().pendingDeletions.size) {
        throw new Error("Wait for deletions to finish before saving a version.");
      }
      return cloudWorkspace.createVersion(label || undefined);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: workspaceQuery.versions(diagramId!).queryKey,
      });
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

        <Tooltip content="Auto format diagram (⌘L)">
          <button
            type="button"
            onClick={autoFormat}
            disabled={formatDisabled}
            className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <SparklesIcon className="size-4" strokeWidth={2} />
            Auto format
          </button>
        </Tooltip>

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

        <output
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400"
          title={cloud.message ?? undefined}
        >
          {(cloud.status === "loading" ||
            cloud.status === "pending" ||
            cloud.status === "saving" ||
            cloud.status === "versioning" ||
            cloud.status === "restoring") && <LoadingIndicator className="size-3" />}
          {SAVE_STATUS_LABELS[cloud.status]}
        </output>
        <AccountControls />

        <ThemeToggle />

        {/* Share Button */}
        <Tooltip
          align="end"
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
