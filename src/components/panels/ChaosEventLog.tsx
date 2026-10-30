/**
 * ChaosEventLog — Scrollable timeline of chaos events.
 * Rendered above the SimulationPanel when chaos mode is active.
 */
import { useRef, useEffect } from "react";
import { useSimulationStore } from "@/store/simulationStore";
import { cn } from "@/lib/utils";
import {
  ExclamationTriangleIcon,
  BoltIcon,
  SignalSlashIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import type { ChaosEvent } from "@/types/simulation";

const EVENT_ICONS: Record<ChaosEvent["type"], typeof ExclamationTriangleIcon> = {
  "node-failure": ExclamationTriangleIcon,
  cascade: BoltIcon,
  partition: SignalSlashIcon,
  recovery: ArrowPathIcon,
};

const EVENT_COLORS: Record<ChaosEvent["type"], string> = {
  "node-failure": "text-red-500",
  cascade: "text-amber-500",
  partition: "text-purple-500",
  recovery: "text-emerald-500",
};

const EVENT_BG: Record<ChaosEvent["type"], string> = {
  "node-failure": "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900",
  cascade: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900",
  partition: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900",
  recovery: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900",
};

export function ChaosEventLog() {
  const chaosEventLog = useSimulationStore((s) => s.chaosEventLog);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chaosEventLog.length]);

  if (chaosEventLog.length === 0) {
    return (
      <div className="mb-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-lg border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg px-4 py-3 min-w-100 max-w-130">
        <div className="flex items-center gap-2 mb-1">
          <BoltIcon className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Chaos Event Log
          </span>
        </div>
        <p className="text-xs text-muted-foreground italic">
          No events yet — press Play to start chaos simulation
        </p>
      </div>
    );
  }

  return (
    <div className="mb-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-lg border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg px-4 py-3 min-w-100 max-w-130">
      <div className="flex items-center gap-2 mb-2">
        <BoltIcon className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Chaos Event Log
        </span>
        <span className="ml-auto text-[10px] font-mono text-zinc-400 tabular-nums">
          {chaosEventLog.length} events
        </span>
      </div>

      <div
        ref={scrollRef}
        className="max-h-50 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700"
      >
        {chaosEventLog.map((event) => {
          const Icon = EVENT_ICONS[event.type];
          return (
            <div
              key={`${event.timestamp}-${event.round}-${event.type}`}
              className={cn(
                "flex items-start gap-2 px-2.5 py-1.5 rounded-lg border text-xs",
                EVENT_BG[event.type],
              )}
            >
              <Icon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", EVENT_COLORS[event.type])} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn("font-semibold", EVENT_COLORS[event.type])}>
                    R{event.round}
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400">{event.message}</span>
                </div>
                {event.affectedCount > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {event.affectedCount} affected downstream
                  </span>
                )}
              </div>
              <span className="text-[9px] font-mono text-muted-foreground shrink-0 mt-0.5">
                {formatTimestamp(event.timestamp)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}
