import { useMemo } from "react";
import { useDiagramStore } from "@/store/diagramStore";
import { useSimulationStore } from "@/store/simulationStore";
import { ArchitectureNodeData } from "@/types";
import { cn } from "@/lib/utils";

type Health = "healthy" | "degraded" | "critical";

const HEALTH_COLOR: Record<Health, string> = {
  healthy: "bg-emerald-500",
  degraded: "bg-amber-500",
  critical: "bg-red-500",
};

function Separator() {
  return (
    <span className="inline-block w-0.75 h-0.75 rounded-full bg-zinc-300 dark:bg-zinc-700 shrink-0" />
  );
}

export function CanvasStatusBar() {
  const nodes = useDiagramStore((s) => s.nodes);
  const edges = useDiagramStore((s) => s.edges);
  const failedNodeIds = useSimulationStore((s) => s.failedNodeIds);
  const affectedNodeIds = useSimulationStore((s) => s.affectedNodeIds);
  const simulationMode = useSimulationStore((s) => s.mode);

  const { archNodes, services, data, queues } = useMemo(() => {
    let services = 0;
    let data = 0;
    let queues = 0;
    let archNodes = 0;

    for (const n of nodes) {
      if (n.type !== "architecture") {
        continue;
      }
      archNodes++;
      const t = (n.data as ArchitectureNodeData).type;
      if (t === "service" || t === "gateway" || t === "lambda" || t === "loadbalancer") {
        services++;
      } else if (
        t === "database" ||
        t === "cache" ||
        t === "storage" ||
        t === "datalake" ||
        t === "vectordb"
      ) {
        data++;
      } else if (t === "queue" || t === "eventbus") {
        queues++;
      }
    }
    return { archNodes, services, data, queues };
  }, [nodes]);

  const health: Health = useMemo(() => {
    if (simulationMode === "idle") {
      return "healthy";
    }
    if (failedNodeIds.length === 0) {
      return "healthy";
    }
    if (affectedNodeIds.length >= 3 || failedNodeIds.length >= 2) {
      return "critical";
    }
    return "degraded";
  }, [simulationMode, failedNodeIds, affectedNodeIds]);

  return (
    <div
      className={cn(
        "absolute bottom-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5",
        "bg-white/90 dark:bg-zinc-950/80 backdrop-blur-md",
        "border border-zinc-200 dark:border-zinc-800 rounded-lg",
        "shadow shadow-black/5 dark:shadow-black/40",
        "font-mono",
      )}
    >
      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
        <b className="font-semibold text-zinc-700 dark:text-zinc-300">{archNodes}</b> nodes
      </span>
      <Separator />
      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
        <b className="font-semibold text-zinc-700 dark:text-zinc-300">{edges.length}</b> edges
      </span>
      {services > 0 && (
        <span className="hidden sm:contents">
          <Separator />
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            <b className="font-semibold text-zinc-700 dark:text-zinc-300">{services}</b> service
          </span>
        </span>
      )}
      {data > 0 && (
        <span className="hidden sm:contents">
          <Separator />
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            <b className="font-semibold text-zinc-700 dark:text-zinc-300">{data}</b> data
          </span>
        </span>
      )}
      {queues > 0 && (
        <span className="hidden sm:contents">
          <Separator />
          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
            <b className="font-semibold text-zinc-700 dark:text-zinc-300">{queues}</b> queue
          </span>
        </span>
      )}
      {/* Type breakdowns are extra detail; phones keep the counts and health. */}
      <Separator />
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", HEALTH_COLOR[health])} />
        {health}
      </span>
    </div>
  );
}
