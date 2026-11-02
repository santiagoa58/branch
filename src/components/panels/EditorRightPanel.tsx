import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDiagramStore } from "@/store/diagramStore";
import { useUIStore, type RightPanelTab } from "@/store/uiStore";
import { useOutdatedStages } from "./design/useOutdatedStages";
import { PropertiesPanel } from "./PropertiesPanel";
import { DesignPanel } from "./design/DesignPanel";
import { FlowsPanel } from "./FlowsPanel";

const SECTIONS: readonly { id: RightPanelTab; label: string }[] = [
  { id: "inspect", label: "Inspect" },
  { id: "brief", label: "Brief" },
  { id: "design", label: "Design" },
  { id: "api", label: "API" },
  { id: "dataModel", label: "Data" },
  { id: "flows", label: "Flows" },
];

/** A single sidebar shell. All entry points change its active section, never mount another panel. */
export function EditorRightPanel() {
  const visible = useUIStore((state) => state.rightPanelVisible);
  const active = useUIStore((state) => state.rightPanelTab);
  const open = useUIStore((state) => state.openRightPanel);
  const close = useUIStore((state) => state.toggleRightPanel);
  const selected = useDiagramStore(
    (state) => state.selectedNodeId !== null || state.selectedEdgeId !== null,
  );
  const stale = useOutdatedStages().outdated;
  const staleTabs = stale
    ? new Set<RightPanelTab>([
        ...(stale.stages.includes("requirements") ? (["brief"] as const) : []),
        ...(stale.stages.includes("components") || stale.stages.includes("decisions")
          ? (["design"] as const)
          : []),
        ...(stale.stages.includes("api") ? (["api"] as const) : []),
        ...(stale.dataModel ? (["dataModel"] as const) : []),
      ])
    : new Set<RightPanelTab>();

  if (!visible) {
    return null;
  }

  return (
    <aside
      aria-label="Editor sidebar"
      className="flex min-h-0 w-96 max-w-full flex-col border-l border-border bg-background max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-40 max-lg:shadow-2xl xl:w-105"
    >
      <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">Workspace</h2>
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={close}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </header>
      <nav aria-label="Sidebar sections" className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-2 py-2">
        {SECTIONS.map((section) => (
          <button
            type="button"
            key={section.id}
            aria-pressed={active === section.id}
            onClick={() => open(section.id)}
            className={cn(
              "relative shrink-0 rounded-md px-2.5 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring",
              active === section.id
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {section.label}
            {section.id === "inspect" && selected && (
              <span aria-label="Selection available" className="ml-1 inline-block size-1.5 rounded-full bg-emerald-500" />
            )}
            {staleTabs.has(section.id) && (
              <span className="sr-only">(out of date)</span>
            )}
            {staleTabs.has(section.id) && (
              <span aria-hidden="true" className="ml-1 inline-block size-1.5 rounded-full bg-attention" />
            )}
          </button>
        ))}
      </nav>
      <div className="flex min-h-0 flex-1 flex-col">
        {active === "inspect" ? (
          <PropertiesPanel />
        ) : active === "flows" ? (
          <FlowsPanel />
        ) : (
          <DesignPanel tab={active} />
        )}
      </div>
    </aside>
  );
}
