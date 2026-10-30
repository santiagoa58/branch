import { useState, useEffect, useCallback } from "react";
import { X, Download, FileImage, FileCode, FileText, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDiagramStore } from "@/store/diagramStore";
import { notify } from "@/services/notify";
import {
  generatePreviewPng,
  generatePreviewSvg,
  getExportStats,
  exportAsPng,
  exportAsSvg,
  exportAsPdf,
  exportAsJson,
} from "@/utils/export";
import { DiagramData } from "@/types";
import { imageBackgroundSchema, imageScaleSchema, pdfOrientationSchema } from "@/schemas/ui";
import { applyValidatedInput } from "@/lib/validatedInput";

type ExportFormat = "png" | "svg" | "pdf" | "json";

interface ExportPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialFormat?: ExportFormat;
}

interface ImageOptions {
  backgroundColor: "transparent" | "white" | "dark";
  scale: 1 | 2 | 3;
}

interface DataOptions {
  includeViewport: boolean;
  includeComments: boolean;
  includeMetadata: boolean;
  prettyPrint: boolean;
}

interface PdfOptions {
  orientation: "portrait" | "landscape";
}

export function ExportPreviewDialog({
  isOpen,
  onClose,
  initialFormat = "png",
}: ExportPreviewDialogProps) {
  const [formatSelection, setFormatSelection] = useState({
    initialFormat,
    selectedFormat: initialFormat,
  });
  const selectedFormat =
    formatSelection.initialFormat === initialFormat
      ? formatSelection.selectedFormat
      : initialFormat;
  const setSelectedFormat = (format: ExportFormat) => {
    setFormatSelection({ initialFormat, selectedFormat: format });
  };
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Format-specific options
  const [imageOptions, setImageOptions] = useState<ImageOptions>({
    backgroundColor: "dark",
    scale: 2,
  });

  const [dataOptions, setDataOptions] = useState<DataOptions>({
    includeViewport: true,
    includeComments: true,
    includeMetadata: true,
    prettyPrint: true,
  });

  const [pdfOptions, setPdfOptions] = useState<PdfOptions>({
    orientation: "landscape",
  });

  const { exportDiagram } = useDiagramStore();
  const stats = getExportStats(exportDiagram());

  const generateJsonPreview = useCallback(
    (data: DiagramData): string => {
      const exportData = {
        nodes: dataOptions.includeComments
          ? data.nodes
          : data.nodes.filter((node) => node.type !== "comment"),
        edges: data.edges,
        ...(data.flows !== undefined ? { flows: data.flows } : {}),
        ...(dataOptions.includeViewport && data.viewport !== undefined
          ? { viewport: data.viewport }
          : {}),
        ...(dataOptions.includeMetadata
          ? {
              version: "1.0.0",
              exportedAt: new Date().toISOString(),
              metadata: { appName: "Branch", appVersion: "1.0.0" },
            }
          : {}),
      };

      return dataOptions.prettyPrint
        ? JSON.stringify(exportData, null, 2)
        : JSON.stringify(exportData);
    },
    [dataOptions],
  );

  const generatePreview = useCallback(async () => {
    setIsGenerating(true);

    try {
      if (selectedFormat === "png" || selectedFormat === "svg") {
        const bgColor =
          imageOptions.backgroundColor === "transparent"
            ? "transparent"
            : imageOptions.backgroundColor === "white"
              ? "#ffffff"
              : "#09090b";

        if (selectedFormat === "png") {
          const url = await generatePreviewPng(bgColor, imageOptions.scale);
          setPreviewUrl(url);
        } else {
          const url = await generatePreviewSvg(bgColor);
          setPreviewUrl(url);
        }
      } else if (selectedFormat === "json") {
        const data = exportDiagram();
        const jsonContent = generateJsonPreview(data);
        setPreviewUrl(jsonContent);
      } else if (selectedFormat === "pdf") {
        // PDF doesn't have a preview, just show placeholder
        setPreviewUrl("");
      }
    } catch (error) {
      console.error("Preview generation failed:", error);
      notify.error({
        title: "Preview failed",
        message: "Could not generate preview",
        duration: 3000,
      });
    } finally {
      setIsGenerating(false);
    }
  }, [selectedFormat, imageOptions, exportDiagram, generateJsonPreview]);

  // Debounced preview generation
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timeoutId = setTimeout(() => {
      void generatePreview();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [generatePreview, isOpen]);

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const data = exportDiagram();

      // Determine background color
      const bgColor =
        imageOptions.backgroundColor === "transparent"
          ? "transparent"
          : imageOptions.backgroundColor === "white"
            ? "#ffffff"
            : "#09090b";

      switch (selectedFormat) {
        case "png":
          await exportAsPng(bgColor, imageOptions.scale);
          break;
        case "svg":
          await exportAsSvg(bgColor);
          break;
        case "pdf":
          await exportAsPdf(bgColor, pdfOptions.orientation);
          break;
        case "json":
          exportAsJson(data, dataOptions);
          break;
      }

      notify.success({
        title: "Export successful",
        message: `Exported as ${selectedFormat.toUpperCase()}`,
        duration: 3000,
      });

      onClose();
    } catch (error) {
      console.error("Export failed:", error);
      notify.error({
        title: "Export failed",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        duration: 5000,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleClose = () => {
    setPreviewUrl("");
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  const formats: { value: ExportFormat; label: string; icon: LucideIcon }[] = [
    { value: "png", label: "PNG", icon: FileImage },
    { value: "svg", label: "SVG", icon: FileCode },
    { value: "pdf", label: "PDF", icon: FileText },
    { value: "json", label: "JSON", icon: FileCode },
  ];

  const isImageFormat = selectedFormat === "png" || selectedFormat === "svg";
  const isDataFormat = selectedFormat === "json";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Export Preview</h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-3 gap-6">
            {/* Left: Format Selector and Options */}
            <div className="space-y-6">
              {/* Format Tabs */}
              <div>
                <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                  Export Format
                </span>
                <div className="space-y-2">
                  {formats.map((format) => {
                    const Icon = format.icon;
                    const isActive = selectedFormat === format.value;

                    return (
                      <button
                        type="button"
                        key={format.value}
                        onClick={() => setSelectedFormat(format.value)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-all text-left",
                          isActive
                            ? "bg-blue-50 dark:bg-blue-950/30 border-blue-500 text-blue-700 dark:text-blue-400"
                            : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700",
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="font-medium text-sm">{format.label}</span>
                        {isActive && <CheckCircle2 className="w-4 h-4 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Format-Specific Options */}
              <div>
                <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                  Export Options
                </span>

                {/* Image Options */}
                {isImageFormat && (
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="export-background"
                        className="block text-xs text-zinc-600 dark:text-zinc-400 mb-2"
                      >
                        Background Color
                      </label>
                      <select
                        id="export-background"
                        value={imageOptions.backgroundColor}
                        onChange={(e) =>
                          applyValidatedInput(
                            imageBackgroundSchema,
                            e.target.value,
                            (backgroundColor) =>
                              setImageOptions({ ...imageOptions, backgroundColor }),
                          )
                        }
                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="transparent">Transparent</option>
                        <option value="white">White</option>
                        <option value="dark">Dark</option>
                      </select>
                    </div>

                    {selectedFormat === "png" && (
                      <div>
                        <label
                          htmlFor="export-scale"
                          className="block text-xs text-zinc-600 dark:text-zinc-400 mb-2"
                        >
                          Scale
                        </label>
                        <select
                          id="export-scale"
                          value={imageOptions.scale}
                          onChange={(e) =>
                            applyValidatedInput(imageScaleSchema, Number(e.target.value), (scale) =>
                              setImageOptions({ ...imageOptions, scale }),
                            )
                          }
                          className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100"
                        >
                          <option value="1">1x (Standard)</option>
                          <option value="2">2x (Retina)</option>
                          <option value="3">3x (High DPI)</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* PDF Options */}
                {selectedFormat === "pdf" && (
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="export-orientation"
                        className="block text-xs text-zinc-600 dark:text-zinc-400 mb-2"
                      >
                        Orientation
                      </label>
                      <select
                        id="export-orientation"
                        value={pdfOptions.orientation}
                        onChange={(e) =>
                          applyValidatedInput(pdfOrientationSchema, e.target.value, (orientation) =>
                            setPdfOptions({ ...pdfOptions, orientation }),
                          )
                        }
                        className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100"
                      >
                        <option value="landscape">Landscape</option>
                        <option value="portrait">Portrait</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Data Format Options */}
                {selectedFormat === "json" && (
                  <div className="space-y-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={dataOptions.includeViewport}
                        onChange={(e) =>
                          setDataOptions({
                            ...dataOptions,
                            includeViewport: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        Include viewport
                      </span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={dataOptions.includeComments}
                        onChange={(e) =>
                          setDataOptions({
                            ...dataOptions,
                            includeComments: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        Include comments
                      </span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={dataOptions.includeMetadata}
                        onChange={(e) =>
                          setDataOptions({
                            ...dataOptions,
                            includeMetadata: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        Include metadata
                      </span>
                    </label>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={dataOptions.prettyPrint}
                        onChange={(e) =>
                          setDataOptions({
                            ...dataOptions,
                            prettyPrint: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">Pretty print</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                  Diagram Statistics
                </div>
                <div className="space-y-1 text-xs text-zinc-700 dark:text-zinc-300">
                  <div className="flex justify-between">
                    <span>Nodes:</span>
                    <span className="font-medium">{stats.nodeCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Edges:</span>
                    <span className="font-medium">{stats.edgeCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Groups:</span>
                    <span className="font-medium">{stats.groupCount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Preview */}
            <div className="col-span-2">
              <span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                Preview
              </span>

              <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-zinc-50 dark:bg-zinc-900/50">
                {isGenerating ? (
                  <div className="aspect-video flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-zinc-200 dark:border-zinc-700 border-t-blue-500 rounded-full animate-spin" />
                      <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        Generating preview...
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    {isImageFormat && previewUrl && (
                      <div
                        className="aspect-video flex items-center justify-center p-6"
                        style={{
                          backgroundImage:
                            imageOptions.backgroundColor === "transparent"
                              ? "repeating-conic-gradient(#e4e4e7 0% 25%, #f4f4f5 0% 50%) 50% / 20px 20px"
                              : undefined,
                          backgroundColor:
                            imageOptions.backgroundColor === "transparent"
                              ? undefined
                              : imageOptions.backgroundColor === "white"
                                ? "#ffffff"
                                : "#09090b",
                        }}
                      >
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    )}

                    {isDataFormat && previewUrl && (
                      <div className="h-96 overflow-auto">
                        <pre className="p-4 text-xs text-zinc-900 dark:text-zinc-100 font-mono">
                          {previewUrl}
                        </pre>
                      </div>
                    )}

                    {selectedFormat === "pdf" && (
                      <div className="aspect-video flex items-center justify-center">
                        <div className="text-center">
                          <FileText className="w-16 h-16 text-zinc-400 dark:text-zinc-600 mx-auto mb-4" />
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            PDF preview not available
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Click Export to generate PDF
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => {
              void handleExport();
            }}
            disabled={isExporting || isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            {isExporting ? "Exporting..." : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}
