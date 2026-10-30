import { XMarkIcon, PlusIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { useDiagramStore } from "@/store/diagramStore";
import { DIAGRAM_TEMPLATES, DiagramTemplate, instantiateTemplate } from "@/templates";
import { appendDiagramData } from "@/utils/import";
import { TemplatePreview } from "@/components/ui/TemplatePreview";
import { notify } from "@/services/notify";
import { cn } from "@/lib/utils";

interface TemplateGalleryDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_STYLES: Record<DiagramTemplate["category"], string> = {
  Web: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Microservices: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  Data: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  AI: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
};

export function TemplateGalleryDialog({ isOpen, onClose }: TemplateGalleryDialogProps) {
  const canvasEmpty = useDiagramStore((s) => s.nodes.length === 0);
  const exportDiagram = useDiagramStore((s) => s.exportDiagram);
  const importDiagram = useDiagramStore((s) => s.importDiagram);

  if (!isOpen) {
    return null;
  }

  const loadTemplate = (template: DiagramTemplate, mode: "replace" | "add") => {
    const instance = instantiateTemplate(template);

    let finalData = instance;
    if (mode === "add") {
      const current = exportDiagram();
      finalData = appendDiagramData(current, instance, { x: 120, y: 120 });
      // appendDiagramData only merges nodes/edges — carry the flows over too.
      finalData.flows = [...(current.flows ?? []), ...(instance.flows ?? [])];
    }

    importDiagram(finalData);
    notify.success({
      title: "Template loaded",
      message: `${template.name} — ${instance.nodes.length} nodes, ${instance.edges.length} edges`,
      duration: 3000,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close template gallery"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <dialog
        open
        aria-labelledby="template-gallery-title"
        className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-popover text-popover-foreground border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2
              id="template-gallery-title"
              className="text-sm font-semibold text-popover-foreground"
            >
              Starter templates
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Pre-designed architectures with groups, contracts and a playable flow.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
            title="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DIAGRAM_TEMPLATES.map((template) => (
            <div
              key={template.id}
              className="flex flex-col rounded-xl border border-border bg-muted overflow-hidden hover:border-input transition-colors"
            >
              <div className="h-36 bg-background text-muted-foreground p-3 border-b border-border">
                <TemplatePreview data={template.data} />
              </div>

              <div className="flex-1 flex flex-col p-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-popover-foreground">
                    {template.name}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full",
                      CATEGORY_STYLES[template.category],
                    )}
                  >
                    {template.category}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  {template.description}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {template.highlights.map((h) => (
                    <span
                      key={h}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground"
                    >
                      {h}
                    </span>
                  ))}
                </div>

                <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground mr-auto">
                    {template.data.nodes.length} nodes · {template.data.edges.length} edges
                  </span>
                  {canvasEmpty ? (
                    <button
                      type="button"
                      onClick={() => loadTemplate(template, "replace")}
                      className="text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                    >
                      Use template
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => loadTemplate(template, "add")}
                        className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                        title="Add the template next to your current diagram"
                      >
                        <PlusIcon className="w-3 h-3" />
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            confirm(
                              `Replace the current diagram with "${template.name}"? You can undo this.`,
                            )
                          ) {
                            loadTemplate(template, "replace");
                          }
                        }}
                        className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                        title="Replace the current diagram with this template"
                      >
                        <ArrowPathIcon className="w-3 h-3" />
                        Replace
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </dialog>
    </div>
  );
}
