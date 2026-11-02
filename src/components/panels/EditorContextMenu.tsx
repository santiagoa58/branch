import type { Node } from "@xyflow/react";
import {
  ArrowDownTrayIcon,
  DocumentDuplicateIcon,
  ClipboardDocumentIcon,
  ArrowUpCircleIcon,
  ArrowDownCircleIcon,
} from "@heroicons/react/24/outline";

const menuItemClass =
  "w-full text-left px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white rounded-md flex items-center gap-2";

const dividerClass = "my-1 h-px bg-zinc-200 dark:bg-zinc-700";

interface EditorContextMenuProps {
  /** Screen position the menu opens at. */
  x: number;
  y: number;
  nodes: Node[];
  hasClipboardContent: boolean;
  onClose: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onBringToFront: (nodeId: string) => void;
  onSendToBack: (nodeId: string) => void;
  onExportSvg: () => Promise<void>;
  onExportPng: () => Promise<void>;
}

/** The canvas right-click menu: copy/paste, group layer order and selection export. */
export function EditorContextMenu({
  x,
  y,
  nodes,
  hasClipboardContent,
  onClose,
  onCopy,
  onPaste,
  onBringToFront,
  onSendToBack,
  onExportSvg,
  onExportPng,
}: EditorContextMenuProps) {
  const selectedNodes = nodes.filter((n) => n.selected);
  const hasSelection = selectedNodes.length > 0;
  const selectedGroups = selectedNodes.filter((n) => n.type === "group");
  // Layer order applies only to a single selected group.
  const groupNode = selectedGroups.length === 1 ? selectedGroups[0] : undefined;

  return (
    <>
      <button
        type="button"
        aria-label="Close context menu"
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      <div
        data-editor-shortcuts="blocked"
        className="fixed z-50 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl overflow-hidden animate-slide-in min-w-48"
        style={{
          left: `${x}px`,
          top: `${y}px`,
        }}
      >
        <div className="p-1">
          {/* Copy/Paste Section */}
          {hasSelection && (
            <button type="button" onClick={onCopy} className={menuItemClass}>
              <DocumentDuplicateIcon className="w-3.5 h-3.5" />
              Copy
              <span className="ml-auto text-zinc-400 dark:text-zinc-500">Ctrl+C</span>
            </button>
          )}
          {hasClipboardContent && (
            <button type="button" onClick={onPaste} className={menuItemClass}>
              <ClipboardDocumentIcon className="w-3.5 h-3.5" />
              Paste
              <span className="ml-auto text-zinc-400 dark:text-zinc-500">Ctrl+V</span>
            </button>
          )}
          {/* Divider */}
          {hasSelection && <div className={dividerClass} />}
          {/* Layer Order Section - only for single selected group */}
          {groupNode && (
            <>
              <button
                type="button"
                onClick={() => {
                  onBringToFront(groupNode.id);
                  onClose();
                }}
                className={menuItemClass}
              >
                <ArrowUpCircleIcon className="w-3.5 h-3.5" />
                Bring to Front
              </button>
              <button
                type="button"
                onClick={() => {
                  onSendToBack(groupNode.id);
                  onClose();
                }}
                className={menuItemClass}
              >
                <ArrowDownCircleIcon className="w-3.5 h-3.5" />
                Send to Back
              </button>
              <div className={dividerClass} />
            </>
          )}
          {/* Export Section */}
          {hasSelection && (
            <>
              <button
                type="button"
                onClick={() => {
                  void onExportSvg();
                }}
                className={menuItemClass}
              >
                <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                Export Selection as SVG
              </button>
              <button
                type="button"
                onClick={() => {
                  void onExportPng();
                }}
                className={menuItemClass}
              >
                <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                Export Selection as PNG
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
