import { useState, useCallback, useRef } from "react";
import { X, Upload, FileJson, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { importDiagram, detectFileFormat } from "@/utils/import";
import { useDiagramStore } from "@/store/diagramStore";
import { mergeDiagramData, appendDiagramData } from "@/utils/import";
import { notify } from "@/services/notify";
import type { DiagramData } from "@/types";

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportDialog({ isOpen, onClose }: ImportDialogProps) {
  const [dragActive, setDragActive] = useState(false);
  const [fileContent, setFileContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [importMode, setImportMode] = useState<"replace" | "merge" | "append">("replace");
  const [includeViewport, setIncludeViewport] = useState(true);
  const [previewData, setPreviewData] = useState<DiagramData | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { exportDiagram, importDiagram: storImportDiagram } = useDiagramStore();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const processFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const resultContent = e.target?.result;
        if (typeof resultContent !== "string") {
          return;
        }
        const content = resultContent;
        setFileContent(content);
        setFileName(file.name);

        // Validate and preview
        const result = importDiagram(content, {
          mode: importMode,
          includeViewport,
        });

        if (result.success && result.data) {
          setPreviewData(result.data);
          setValidationErrors([]);
          setValidationWarnings(result.warnings || []);
        } else {
          setPreviewData(null);
          setValidationErrors(result.errors || []);
          setValidationWarnings(result.warnings || []);
        }
      };
      reader.readAsText(file);
    },
    [importMode, includeViewport],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const files = e.dataTransfer.files;
      if (files && files[0]) {
        processFile(files[0]);
      }
    },
    [processFile],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files[0]) {
        processFile(files[0]);
      }
    },
    [processFile],
  );

  const resetState = useCallback(() => {
    setFileContent("");
    setFileName("");
    setPreviewData(null);
    setValidationErrors([]);
    setValidationWarnings([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleImport = useCallback(() => {
    if (!previewData) {
      return;
    }

    try {
      const currentData = exportDiagram();

      const combinedData =
        importMode === "merge"
          ? mergeDiagramData(currentData, previewData)
          : importMode === "append"
            ? appendDiagramData(currentData, previewData)
            : previewData;
      const finalData: DiagramData = includeViewport
        ? combinedData
        : {
            nodes: combinedData.nodes,
            edges: combinedData.edges,
            ...(combinedData.flows !== undefined ? { flows: combinedData.flows } : {}),
          };

      storImportDiagram(finalData);

      notify.success({
        title: "Import successful",
        message: `Imported ${previewData.nodes.length} nodes and ${previewData.edges.length} edges`,
        duration: 3000,
      });

      onClose();
      resetState();
    } catch (error) {
      notify.error({
        title: "Import failed",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        duration: 5000,
      });
    }
  }, [
    previewData,
    importMode,
    includeViewport,
    exportDiagram,
    storImportDiagram,
    onClose,
    resetState,
  ]);

  const handleClose = () => {
    resetState();
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  const fileFormat = fileContent ? detectFileFormat(fileContent) : null;
  const canImport = previewData !== null && validationErrors.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Import Diagram</h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Drag and Drop Area */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
              dragActive
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600",
            )}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-zinc-400" />
            <p className="text-zinc-700 dark:text-zinc-300 font-medium mb-1">
              Drop a file here or click to browse
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Supports JSON and Markdown formats
            </p>
          </button>
          <input
            id="diagram-import-file"
            ref={fileInputRef}
            type="file"
            accept=".json,.md,.markdown"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* File Info */}
          {fileName && (
            <div className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
              {fileFormat === "json" ? (
                <FileJson className="w-5 h-5 text-blue-500" />
              ) : (
                <FileText className="w-5 h-5 text-purple-500" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {fileName}
                </p>
                {fileFormat && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {fileFormat} format detected
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Preview */}
          {previewData && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-emerald-900 dark:text-emerald-100 mb-1">
                    Preview
                  </h4>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    {previewData.nodes.length} nodes, {previewData.edges.length} edges
                    {previewData.viewport && ", viewport data included"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-red-900 dark:text-red-100 mb-2">
                    Validation Errors
                  </h4>
                  <ul className="space-y-1">
                    {validationErrors.map((error) => (
                      <li key={error} className="text-sm text-red-700 dark:text-red-300">
                        • {error}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Validation Warnings */}
          {validationWarnings.length > 0 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-2">Warnings</h4>
                  <ul className="space-y-1">
                    {validationWarnings.map((warning) => (
                      <li key={warning} className="text-sm text-amber-700 dark:text-amber-300">
                        • {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Import Options */}
          {fileContent && (
            <div className="space-y-3 pt-2">
              <h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Import Options
              </h4>

              {/* Import Mode */}
              <fieldset className="space-y-2">
                <legend className="text-xs text-zinc-600 dark:text-zinc-400">Import Mode</legend>
                <div className="grid grid-cols-3 gap-2">
                  {(["replace", "merge", "append"] as const).map((mode) => (
                    <button
                      type="button"
                      key={mode}
                      onClick={() => setImportMode(mode)}
                      className={cn(
                        "px-3 py-2 text-sm rounded-lg border transition-colors",
                        importMode === mode
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-600 hover:border-zinc-400",
                      )}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {importMode === "replace" && "Replace current diagram completely"}
                  {importMode === "merge" && "Merge with current diagram (creates new IDs)"}
                  {importMode === "append" && "Add to current diagram (keeps original IDs)"}
                </p>
              </fieldset>

              {/* Viewport Option */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeViewport}
                  onChange={(e) => setIncludeViewport(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-300 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">
                  Include viewport position and zoom
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!canImport}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
              canImport
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "bg-zinc-300 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-500 cursor-not-allowed",
            )}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
