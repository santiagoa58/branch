import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Copy, Check, Download, ExternalLink } from "lucide-react";
import { CodeEditor } from "@/components/ui/CodeEditor";
import { notify } from "@/services/notify";
import { toMermaidLiveUrl, wrapMermaidMarkdown } from "@/utils/sequenceDiagram";

interface SequenceDiagramDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Mermaid `sequenceDiagram` source. */
  source: string;
  /** Used for the dialog subtitle and the downloaded file's heading. */
  title?: string;
}

/**
 * Modal that shows the Mermaid `sequenceDiagram` generated from a flow trace.
 * Output is local-first (copy / download a `.md`); rendering is offered via an
 * explicit link to the external mermaid.live editor.
 */
export function SequenceDiagramDialog({
  isOpen,
  onClose,
  source,
  title = "Flow Sequence",
}: SequenceDiagramDialogProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      notify.success({
        title: "Copied",
        message: "Mermaid source copied to clipboard",
        duration: 2000,
      });
    } catch {
      notify.error({
        title: "Copy failed",
        message: "Could not access the clipboard",
        duration: 3000,
      });
    }
  };

  const handleDownload = () => {
    const md = wrapMermaidMarkdown(source, title);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `sequence-diagram-${Date.now()}.md`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    notify.success({
      title: "Downloaded",
      message: "Saved as Markdown with a Mermaid block",
      duration: 2500,
    });
  };

  const handleOpenLive = () => {
    window.open(toMermaidLiveUrl(source), "_blank", "noopener,noreferrer");
  };

  // Rendered through a portal to document.body so the `fixed` overlay is
  // positioned relative to the viewport. (The SimulationPanel that mounts this
  // dialog has a `transform`, which would otherwise become the containing block
  // for fixed descendants and pin the modal to the panel's box.)
  return createPortal(
    <div
      data-editor-shortcuts="blocked"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              Sequence Diagram
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Generated from the traced flow — {title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source */}
        <div className="flex-1 overflow-y-auto p-6">
          <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
            Mermaid source
          </span>
          <CodeEditor value={source} onChange={() => {}} format="text" height="380px" readOnly />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <button
            type="button"
            onClick={handleOpenLive}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            title="Render in the external mermaid.live editor (sends the source to mermaid.live)"
          >
            <ExternalLink className="w-4 h-4" />
            Open in mermaid.live
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Download .md
            </button>
            <button
              type="button"
              onClick={() => {
                void handleCopy();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy source"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
