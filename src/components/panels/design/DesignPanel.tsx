import { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DesignBrief } from "@/schemas/aiDesign";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useDiagramStore } from "@/store/diagramStore";
import { useUIStore, type DesignTabId } from "@/store/uiStore";
import { outdatedStages } from "@/utils/aiDesign/fingerprint";
import { BriefTab } from "./BriefTab";
import { SCOPES } from "./Composer";
import { RunNotes, RunProgress, UpdateBar } from "./UpdateBar";

export type { DesignTabId };

const TABS: readonly { id: DesignTabId; label: string }[] = [
  { id: "brief", label: "Brief" },
  { id: "design", label: "Design" },
  { id: "api", label: "API" },
  { id: "dataModel", label: "Data model" },
];

/** Which tabs show content that is out of date (spec 9.2). */
export function outdatedTabs(
  outdated: ReturnType<typeof outdatedStages>,
): Record<DesignTabId, boolean> {
  const { stages, dataModel } = outdated;
  return {
    brief: stages.includes("requirements"),
    design: stages.includes("components") || stages.includes("decisions"),
    api: stages.includes("api"),
    dataModel,
  };
}

// Placeholders until the Design, API and Data model tabs are built.
const PENDING_TABS: Record<Exclude<DesignTabId, "brief">, string> = {
  design: "Components, their choices and tradeoffs appear here after an update.",
  api: "Endpoints and events appear here after an update.",
  dataModel: "Generate entities, keys and relations for this design when you need them.",
};

function DesignTabs({
  value,
  onChange,
  outdated,
}: {
  value: DesignTabId;
  onChange: (tab: DesignTabId) => void;
  outdated: Record<DesignTabId, boolean>;
}) {
  return (
    <nav aria-label="Design sections" className="shrink-0 px-4 pt-3">
      <div className="flex items-center gap-1 rounded-lg bg-zinc-100/80 dark:bg-zinc-900 p-1">
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab.id}
            aria-pressed={value === tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "min-w-0 flex-1 rounded-md px-2 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              value === tab.id
                ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white",
            )}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              <span className="truncate">{tab.label}</span>
              {outdated[tab.id] && (
                <>
                  <span
                    aria-hidden="true"
                    className="size-1.5 shrink-0 rounded-full bg-attention"
                  />
                  <span className="sr-only">(out of date)</span>
                </>
              )}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}

function PanelHeader({ brief, running }: { brief: DesignBrief | null; running: boolean }) {
  const closeDesignPanel = useUIStore((state) => state.closeDesignPanel);
  const scope = brief && SCOPES.find((option) => option.value === brief.inputs.scope);
  return (
    <div className="shrink-0 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Design with AI</h2>
        <div className="flex items-center gap-1.5">
          {scope && (
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
              {scope.label}
            </span>
          )}
          {/* A run keeps the panel open: it holds Cancel while the canvas is locked. */}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close design panel"
            disabled={running}
            onClick={closeDesignPanel}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      </div>
      {brief && (
        <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
          {brief.inputs.prompt}
        </p>
      )}
    </div>
  );
}

/**
 * When a run ends with open questions, answering them is the next step: show the Brief tab, which
 * holds them, whichever tab was open.
 */
function showQuestionsAfterRuns(): () => void {
  return useAiDesignStore.subscribe((state, previous) => {
    if (previous.running && !state.running && useDiagramStore.getState().brief?.questions.length) {
      useUIStore.getState().setDesignTab("brief");
    }
  });
}

/** The docked AI design panel: composer, run progress, or the four tabs with the update bar. */
export function DesignPanel() {
  const brief = useDiagramStore((state) => state.brief);
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const running = useAiDesignStore((state) => state.running);
  const tab = useUIStore((state) => state.designTab);
  const setTab = useUIStore((state) => state.setDesignTab);
  useEffect(() => showQuestionsAfterRuns(), []);
  const outdated = useMemo(
    () => (brief ? outdatedTabs(outdatedStages(brief, nodes, edges)) : null),
    [brief, nodes, edges],
  );

  return (
    <aside
      aria-label="Design with AI"
      className="w-96 xl:w-105 max-w-full bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800 flex flex-col z-20"
    >
      <PanelHeader brief={brief} running={running} />
      {running ? (
        <RunProgress />
      ) : !brief || !outdated ? (
        <BriefTab />
      ) : (
        <>
          <DesignTabs value={tab} onChange={setTab} outdated={outdated} />
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {tab === "brief" ? (
              <BriefTab />
            ) : (
              <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
                {PENDING_TABS[tab]}
              </p>
            )}
          </div>
          <RunNotes />
          <UpdateBar />
        </>
      )}
    </aside>
  );
}
