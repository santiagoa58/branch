import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  XMarkIcon,
  TrashIcon,
  ArrowUturnLeftIcon,
  ClockIcon,
  TagIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { versionsApi, type ApiDiagramVersion } from "@/services/api";
import { workspaceQuery } from "@/services/workspaceQuery";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useDiagramStore } from "@/store/diagramStore";
import { editBlockReason, VERSION_EDIT_CHECKS } from "@/store/editLock";
import { notify } from "@/services/notify";
import { VersionPreviewModal } from "@/components/ui/VersionPreviewModal";
import { LoadingIndicator, LoadingState } from "@/components/ui/loading";
import { cloudWorkspace } from "@/services/cloudWorkspace";

interface VersionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  diagramId: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const RESTORE_BLOCKED = {
  "ai-running": "Wait for the AI design run to finish before restoring.",
  "deletions-pending": "Wait for deletions to finish before restoring.",
} satisfies Record<(typeof VERSION_EDIT_CHECKS)[number], string>;

export function VersionsPanel({ isOpen, onClose, diagramId }: VersionsPanelProps) {
  const queryClient = useQueryClient();
  const { nodes: currentNodes, edges: currentEdges } = useDiagramStore();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);
  const aiRunning = useAiDesignStore((state) => state.running);

  // Fetch full version data (with `data` field) only when a preview is requested
  const { data: previewVersion, isLoading: isLoadingPreview } = useQuery({
    ...workspaceQuery.version(diagramId, previewVersionId ?? ""),
    enabled: isOpen && Boolean(previewVersionId),
  });

  const {
    data: versions = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    ...workspaceQuery.versions(diagramId),
    enabled: isOpen && Boolean(diagramId),
  });

  const deleteMutation = useMutation({
    mutationFn: (versionId: string) => versionsApi.delete(diagramId, versionId),
    onSuccess: (_result, versionId) => {
      void queryClient.invalidateQueries({ queryKey: workspaceQuery.versions(diagramId).queryKey });
      queryClient.removeQueries({
        queryKey: workspaceQuery.version(diagramId, versionId).queryKey,
      });
      if (previewVersionId === versionId) {
        setPreviewVersionId(null);
      }
      setConfirmDeleteId(null);
      notify.success({ title: "Version deleted" });
    },
    onError: () => {
      notify.error({ title: "Failed to delete version" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) => {
      const blocked = editBlockReason(VERSION_EDIT_CHECKS);
      if (blocked) {
        throw new Error(RESTORE_BLOCKED[blocked]);
      }
      return cloudWorkspace.restoreVersion(versionId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      setConfirmRestoreId(null);
      notify.success({
        title: "Version restored",
        message: "Diagram has been restored to the selected version",
      });
    },
    onError: () => {
      notify.error({ title: "Failed to restore version" });
    },
  });

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close version history"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <div className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <ClockIcon className="w-4.5 h-4.5 text-zinc-500" />
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  Version History
                </h2>
                {versions.length > 0 && (
                  <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded-full">
                    {versions.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-500 dark:text-zinc-400 transition-colors"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <LoadingState label="Loading versions…" className="py-12" />
              ) : isError ? (
                <div role="alert" className="p-6 text-sm text-zinc-600 dark:text-zinc-400">
                  Could not load version history.
                  <button
                    type="button"
                    className="ml-2 underline"
                    onClick={() => {
                      void refetch();
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : versions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center gap-3">
                  <ClockIcon className="w-8 h-8 text-zinc-300 dark:text-zinc-700" />
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">No versions saved yet</p>
                  <p className="text-xs text-muted-foreground">
                    Click <strong>Save Version</strong> in the toolbar to capture the current state
                    of your diagram.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {versions.map((v: ApiDiagramVersion) => (
                    <VersionRow
                      key={v.id}
                      version={v}
                      isConfirmingDelete={confirmDeleteId === v.id}
                      isConfirmingRestore={confirmRestoreId === v.id}
                      isRestoring={restoreMutation.isPending && confirmRestoreId === v.id}
                      restoreDisabled={aiRunning}
                      isDeleting={deleteMutation.isPending && confirmDeleteId === v.id}
                      isLoadingPreview={isLoadingPreview && previewVersionId === v.id}
                      onPreviewClick={() => setPreviewVersionId(v.id)}
                      onRestoreClick={() =>
                        confirmRestoreId === v.id
                          ? restoreMutation.mutate(v.id)
                          : setConfirmRestoreId(v.id)
                      }
                      onDeleteClick={() =>
                        confirmDeleteId === v.id
                          ? deleteMutation.mutate(v.id)
                          : setConfirmDeleteId(v.id)
                      }
                      onCancelRestore={() => setConfirmRestoreId(null)}
                      onCancelDelete={() => setConfirmDeleteId(null)}
                    />
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
      {previewVersion && (
        <VersionPreviewModal
          version={previewVersion}
          currentNodes={currentNodes}
          currentEdges={currentEdges}
          onClose={() => setPreviewVersionId(null)}
        />
      )}
    </>
  );
}

interface VersionRowProps {
  version: ApiDiagramVersion;
  isConfirmingDelete: boolean;
  isConfirmingRestore: boolean;
  isRestoring: boolean;
  restoreDisabled: boolean;
  isDeleting: boolean;
  isLoadingPreview: boolean;
  onPreviewClick: () => void;
  onRestoreClick: () => void;
  onDeleteClick: () => void;
  onCancelRestore: () => void;
  onCancelDelete: () => void;
}

function VersionRow({
  version,
  isConfirmingDelete,
  isConfirmingRestore,
  isRestoring,
  restoreDisabled,
  isDeleting,
  isLoadingPreview,
  onPreviewClick,
  onRestoreClick,
  onDeleteClick,
  onCancelRestore,
  onCancelDelete,
}: VersionRowProps) {
  return (
    <li className="px-5 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              v{version.versionNumber}
            </span>
            {version.label && (
              <span className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded-full truncate max-w-40">
                <TagIcon className="w-2.5 h-2.5 shrink-0" />
                {version.label}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{formatDate(version.createdAt)}</p>
        </div>

        {/* Actions */}
        {!isConfirmingDelete && !isConfirmingRestore && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onPreviewClick}
              disabled={isLoadingPreview}
              className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
              title="Preview this version"
            >
              {isLoadingPreview ? (
                <LoadingIndicator className="size-3" />
              ) : (
                <EyeIcon className="w-3 h-3" />
              )}
              Preview
            </button>
            <button
              type="button"
              onClick={onRestoreClick}
              disabled={restoreDisabled}
              className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Restore this version"
            >
              <ArrowUturnLeftIcon className="w-3 h-3" />
              Restore
            </button>
            <button
              type="button"
              onClick={onDeleteClick}
              className="p-1 rounded text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              title="Delete this version"
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Restore confirm */}
        {isConfirmingRestore && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-amber-600 dark:text-amber-400">Restore?</span>
            <button
              type="button"
              onClick={onRestoreClick}
              disabled={isRestoring || restoreDisabled}
              className="inline-flex items-center gap-1 text-xs bg-amber-500 hover:bg-amber-600 text-white px-2 py-0.5 rounded transition-colors disabled:opacity-50"
            >
              {isRestoring && <LoadingIndicator className="size-3" />}
              {isRestoring ? "Restoring…" : "Yes"}
            </button>
            <button
              type="button"
              onClick={onCancelRestore}
              className="text-xs text-muted-foreground hover:text-foreground px-1 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Delete confirm */}
        {isConfirmingDelete && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-red-600 dark:text-red-400">Delete?</span>
            <button
              type="button"
              onClick={onDeleteClick}
              disabled={isDeleting}
              className="inline-flex items-center gap-1 text-xs bg-red-500 hover:bg-red-600 text-white px-2 py-0.5 rounded transition-colors disabled:opacity-50"
            >
              {isDeleting && <LoadingIndicator className="size-3" />}
              {isDeleting ? "Deleting…" : "Yes"}
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="text-xs text-muted-foreground hover:text-foreground px-1 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
