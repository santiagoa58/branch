import { useDiagramStore } from "@/store/diagramStore";
import { useSimulationStore } from "@/store/simulationStore";
import { cn } from "@/lib/utils";
import type { TrafficLogEntry } from "@/types/simulation";

const OUTCOME_STYLES: Record<TrafficLogEntry["outcome"], { label: string; className: string }> = {
  ok: { label: "OK", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  failed: { label: "Failed", className: "bg-red-500/15 text-red-700 dark:text-red-300" },
  waiting: { label: "Waiting", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  delivered: { label: "Delivered", className: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
};

function describe(entry: TrafficLogEntry, label: (id: string) => string): string {
  const source = label(entry.sourceId);
  if (entry.kind === "delivery") {
    return entry.outcome === "waiting"
      ? `Message to ${source} is waiting again`
      : `Message delivered to ${source} after recovery`;
  }
  if (entry.outcome === "failed" && entry.failedAt) {
    return `${source} request failed at ${label(entry.failedAt)} (down)`;
  }
  if (entry.outcome === "waiting") {
    const messages = entry.waitingCount === 1 ? "1 message" : `${entry.waitingCount} messages`;
    return `${source} request succeeded; ${messages} waiting`;
  }
  return `${source} request succeeded`;
}

/** Live counts and the latest requests, newest first. */
export function TrafficLog() {
  const log = useSimulationStore((s) => s.trafficLog);
  const counts = useSimulationStore((s) => s.trafficCounts);
  const waiting = useSimulationStore((s) => s.waitingMessages.length);
  const nodes = useDiagramStore((s) => s.nodes);
  const labels = new Map(
    nodes.map((node) => {
      const value = (node.data as { label?: unknown }).label;
      return [node.id, typeof value === "string" && value ? value : node.id];
    }),
  );
  const label = (id: string) => labels.get(id) ?? id;
  const successRate = counts.sent > 0 ? Math.round((counts.ok / counts.sent) * 100) : null;

  return (
    <section
      aria-label="Request log"
      className="mb-2 w-96 max-w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-lg shadow-xl"
    >
      <dl className="grid grid-cols-5 gap-1 border-b border-zinc-200 dark:border-zinc-800 px-3 py-2 text-center">
        {[
          ["Sent", counts.sent],
          ["OK", successRate === null ? "—" : `${successRate}%`],
          ["Failed", counts.failed],
          ["Waiting", waiting],
          ["Delivered", counts.delivered],
        ].map(([term, value]) => (
          <div key={term}>
            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{term}</dt>
            <dd className="text-sm font-semibold tabular-nums text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      {log.length === 0 ? (
        <p className="px-3 py-3 text-xs text-muted-foreground">
          Requests appear here as they finish. Click a component to take it down, then click it
          again to bring it back.
        </p>
      ) : (
        <ol className="max-h-48 overflow-y-auto px-1 py-1">
          {log.map((entry) => {
            const style = OUTCOME_STYLES[entry.outcome];
            return (
              <li key={entry.id} className="flex items-start gap-2 rounded-md px-2 py-1.5 text-xs">
                <span
                  className={cn(
                    "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                    style.className,
                  )}
                >
                  {style.label}
                </span>
                <span className="min-w-0 flex-1 text-foreground">{describe(entry, label)}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {Math.round(entry.latencyMs)} ms
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
