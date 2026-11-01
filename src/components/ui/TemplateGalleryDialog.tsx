import { useMemo, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import {
  XMarkIcon,
  PlusIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { useDiagramStore } from "@/store/diagramStore";
import {
  DIAGRAM_TEMPLATES,
  TEMPLATE_CATEGORIES,
  findTemplates,
  instantiateTemplate,
  type DiagramTemplate,
  type TemplateCategory,
} from "@/templates";
import { appendDiagramData } from "@/utils/import";
import { TemplatePreview } from "@/components/ui/TemplatePreview";
import { notify } from "@/services/notify";
import { cn } from "@/lib/utils";

interface TemplateGalleryDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type CategoryFilter = TemplateCategory | "all";
type LoadMode = "replace" | "add";

const CATEGORY_LABELS = new Map<TemplateCategory, string>(
  TEMPLATE_CATEGORIES.map((category) => [category.id, category.label]),
);
const SUGGESTED_SEARCHES = ["Google Drive", "chat", "payments", "video", "Uber", "AI agent"];

function countFor(category: CategoryFilter) {
  return category === "all"
    ? DIAGRAM_TEMPLATES.length
    : DIAGRAM_TEMPLATES.filter((template) => template.category === category).length;
}

export function TemplateGalleryDialog({ isOpen, onClose }: TemplateGalleryDialogProps) {
  if (!isOpen) {
    return null;
  }
  return <TemplateGallery onClose={onClose} />;
}

// oxlint-disable-next-line max-lines-per-function -- debt: 281 lines; split into smaller units
function TemplateGallery({ onClose }: { onClose: () => void }) {
  const canvasEmpty = useDiagramStore((s) => s.nodes.length === 0);
  const { fitView } = useReactFlow();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(DIAGRAM_TEMPLATES[0]?.id ?? null);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const results = useMemo(() => findTemplates(query, category), [query, category]);
  // Keep a visible selection: filtering away the current choice selects the best remaining match.
  const selected = results.find((template) => template.id === selectedId) ?? results[0] ?? null;

  const select = (template: DiagramTemplate) => {
    setSelectedId(template.id);
    setConfirmReplace(false);
  };

  const loadTemplate = (template: DiagramTemplate, mode: LoadMode) => {
    const { exportDiagram, importDiagram } = useDiagramStore.getState();
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
      title: mode === "add" ? "Template added" : "Template loaded",
      message: `${template.name}: ${instance.nodes.length} components, ${instance.edges.length} connections`,
      duration: 3000,
    });
    onClose();
    // The gallery unmounts on close; fit the canvas after React Flow measures the new nodes.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        void fitView({ padding: 0.2, maxZoom: 1 });
      });
    });
  };

  const primaryAction = (template: DiagramTemplate) => {
    if (canvasEmpty) {
      loadTemplate(template, "replace");
    } else {
      setSelectedId(template.id);
      setConfirmReplace(true);
    }
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
        aria-modal="true"
        aria-labelledby="template-gallery-title"
        className="relative m-0 flex h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-popover p-0 text-popover-foreground shadow-2xl"
      >
        <header className="flex flex-wrap items-center gap-4 border-b border-border px-4 py-4 sm:px-6">
          <div className="mr-auto">
            <h2 id="template-gallery-title" className="text-base font-semibold text-balance">
              Start from a template
            </h2>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              {DIAGRAM_TEMPLATES.length} architectures modeled on products you know. Search by app,
              pattern or technology.
            </p>
          </div>
          {/* On phones the close button stays beside the title and search takes its own row. */}
          <label className="order-last flex w-full items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-ring sm:order-none sm:w-80">
            <MagnifyingGlassIcon
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
            />
            <span className="sr-only">Search templates</span>
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setConfirmReplace(false);
              }}
              placeholder="Try Google Drive, chat or payments"
              className="w-full min-w-0 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close template gallery"
            className="rounded-lg p-2 text-muted-foreground transition-colors duration-300 hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <XMarkIcon className="size-4" />
          </button>
        </header>

        <nav aria-label="Template categories" className="border-b border-border px-6 py-3">
          <div className="flex gap-2 overflow-x-auto">
            {(["all", ...TEMPLATE_CATEGORIES.map((c) => c.id)] as CategoryFilter[]).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={category === id}
                onClick={() => {
                  setCategory(id);
                  setConfirmReplace(false);
                }}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-ring",
                  category === id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {id === "all" ? "All" : CATEGORY_LABELS.get(id)}{" "}
                <span className="opacity-60">{countFor(id)}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <section aria-label="Templates" className="min-h-0 flex-1 overflow-y-auto p-6">
            {results.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <p className="text-sm text-muted-foreground text-pretty">
                  No templates match “{query}”. Try a product name or a broader term.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTED_SEARCHES.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setQuery(suggestion);
                        setCategory("all");
                      }}
                      className="rounded-full border border-border px-3 py-1 text-xs hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ul className="grid grid-cols-1 content-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {results.map((template) => {
                  const isSelected = template.id === selected?.id;
                  return (
                    <li key={template.id}>
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        aria-label={`${template.name}${template.inspiredBy ? `, like ${template.inspiredBy}` : ""}`}
                        onClick={() => select(template)}
                        onDoubleClick={() => primaryAction(template)}
                        className={cn(
                          "flex w-full flex-col overflow-hidden rounded-xl border bg-card text-left transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98]",
                          isSelected
                            ? "border-primary ring-1 ring-primary"
                            : "border-border hover:border-input hover:bg-accent/40",
                        )}
                      >
                        <span className="block h-28 border-b border-border bg-background p-2 text-muted-foreground">
                          <TemplatePreview data={template.data} />
                        </span>
                        <span className="flex flex-col gap-1 p-3">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold">{template.name}</span>
                            {isSelected && (
                              <CheckIcon
                                aria-hidden="true"
                                className="ml-auto size-4 shrink-0 text-primary"
                              />
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {template.inspiredBy ? `Like ${template.inspiredBy} · ` : ""}
                            {CATEGORY_LABELS.get(template.category)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {selected && (
            <aside
              aria-label="Selected template"
              className="flex shrink-0 flex-col border-t border-border bg-muted/40 lg:w-96 lg:border-l lg:border-t-0"
            >
              <div className="hidden h-48 border-b border-border bg-background p-4 text-muted-foreground lg:block">
                <TemplatePreview data={selected.data} />
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
                <div>
                  <h3 className="text-base font-semibold text-balance">{selected.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selected.inspiredBy ? `Inspired by ${selected.inspiredBy} · ` : ""}
                    {selected.data.nodes.filter((n) => n.type === "architecture").length} components
                    · {selected.data.edges.length} connections
                  </p>
                </div>
                <p className="hidden text-sm text-muted-foreground text-pretty sm:block">
                  {selected.description}
                </p>
                <ul aria-label="Highlights" className="hidden flex-wrap gap-2 sm:flex">
                  {selected.highlights.map((highlight) => (
                    <li
                      key={highlight}
                      className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground"
                    >
                      {highlight}
                    </li>
                  ))}
                </ul>
                {selected.data.flows?.[0] && (
                  <p className="hidden text-xs text-muted-foreground lg:block">
                    Includes a playable flow: {selected.data.flows[0].name}.
                  </p>
                )}
              </div>
              <div className="border-t border-border p-4">
                {canvasEmpty ? (
                  <button
                    type="button"
                    onClick={() => loadTemplate(selected, "replace")}
                    className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98]"
                  >
                    Use template
                  </button>
                ) : confirmReplace ? (
                  <div role="alert" className="flex flex-col gap-2">
                    <p className="text-sm text-pretty">
                      Replace your current diagram with {selected.name}? You can undo this.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => loadTemplate(selected, "replace")}
                        className="flex-1 rounded-lg bg-destructive px-3 py-2 text-sm font-semibold text-white transition-colors duration-300 hover:bg-destructive/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        Replace diagram
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmReplace(false)}
                        className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-semibold hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => loadTemplate(selected, "add")}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-300 hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:scale-[0.98]"
                    >
                      <PlusIcon aria-hidden="true" className="size-4" />
                      Add to canvas
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReplace(true)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold transition-colors duration-300 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring active:scale-[0.98]"
                    >
                      <ArrowPathIcon aria-hidden="true" className="size-4" />
                      Replace
                    </button>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </dialog>
    </div>
  );
}
