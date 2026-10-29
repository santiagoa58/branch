/**
 * SimulationStats — Floating overlay showing real-time simulation metrics.
 * Rendered above the SimulationPanel control bar.
 */
import { useSimulationStore } from "@/store/simulationStore";
import {
  ArrowsRightLeftIcon,
  ExclamationTriangleIcon,
  SignalIcon,
  CubeIcon,
  LinkIcon,
  ClockIcon,
  ArrowPathIcon,
  FireIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";

export function SimulationStats() {
  const mode = useSimulationStore((s) => s.mode);
  const stats = useSimulationStore((s) => s.stats);

  if (!stats) {
    return null;
  }

  return (
    <div className="mb-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-lg border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg px-4 py-3 min-w-[320px]">
      <div className="flex items-center gap-2 mb-2">
        <SignalIcon className="w-3.5 h-3.5 text-indigo-500" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
          Simulation Stats
        </span>
      </div>

      {mode === "flow" && (
        <div className="grid grid-cols-3 gap-3">
          <StatItem
            icon={<ArrowsRightLeftIcon className="w-3.5 h-3.5" />}
            label="Hops"
            value={String(stats.totalHops)}
            color="text-blue-600 dark:text-blue-400"
          />
          <StatItem
            icon={<CubeIcon className="w-3.5 h-3.5" />}
            label="Nodes"
            value={String(stats.pathLength)}
            color="text-emerald-600 dark:text-emerald-400"
          />
          <StatItem
            icon={<ClockIcon className="w-3.5 h-3.5" />}
            label="Latency"
            value={stats.totalLatencyMs > 0 ? `${stats.totalLatencyMs}ms` : "—"}
            color="text-amber-600 dark:text-amber-400"
          />
          <StatItem
            icon={<LinkIcon className="w-3.5 h-3.5" />}
            label="Protocols"
            value={
              stats.protocolsUsed.length > 0
                ? stats.protocolsUsed.map((p) => p.toUpperCase()).join(", ")
                : "—"
            }
            color="text-purple-600 dark:text-purple-400"
          />
          {stats.branchCount > 1 && (
            <StatItem
              icon={<SignalIcon className="w-3.5 h-3.5" />}
              label="Branches"
              value={String(stats.branchCount)}
              color="text-cyan-600 dark:text-cyan-400"
            />
          )}
          {stats.roundTripLatencyMs !== null && (
            <StatItem
              icon={<ArrowPathIcon className="w-3.5 h-3.5" />}
              label="RT Latency"
              value={`${stats.roundTripLatencyMs}ms`}
              color="text-indigo-600 dark:text-indigo-400"
            />
          )}
        </div>
      )}

      {mode === "failure" && (
        <div className="grid grid-cols-2 gap-3">
          <StatItem
            icon={<ExclamationTriangleIcon className="w-3.5 h-3.5" />}
            label="Failed"
            value={String(stats.failedCount)}
            color="text-red-600 dark:text-red-400"
          />
          <StatItem
            icon={<CubeIcon className="w-3.5 h-3.5" />}
            label="Affected"
            value={String(stats.affectedCount)}
            color="text-amber-600 dark:text-amber-400"
          />
          <StatItem
            icon={<LinkIcon className="w-3.5 h-3.5" />}
            label="Broken Edges"
            value={String(stats.brokenEdgeCount)}
            color="text-orange-600 dark:text-orange-400"
          />
          <StatItem
            icon={<SignalIcon className="w-3.5 h-3.5" />}
            label="Impact"
            value={`${stats.impactPercentage}%`}
            color={
              stats.impactPercentage > 50
                ? "text-red-600 dark:text-red-400"
                : stats.impactPercentage > 25
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400"
            }
          />
        </div>
      )}

      {mode === "chaos" && (
        <div className="grid grid-cols-3 gap-3">
          <StatItem
            icon={<FireIcon className="w-3.5 h-3.5" />}
            label="Rounds"
            value={String(stats.chaosRounds)}
            color="text-orange-600 dark:text-orange-400"
          />
          <StatItem
            icon={<ExclamationTriangleIcon className="w-3.5 h-3.5" />}
            label="Failed"
            value={String(stats.failedCount)}
            color="text-red-600 dark:text-red-400"
          />
          <StatItem
            icon={<CubeIcon className="w-3.5 h-3.5" />}
            label="Affected"
            value={String(stats.affectedCount)}
            color="text-amber-600 dark:text-amber-400"
          />
          <StatItem
            icon={<SignalIcon className="w-3.5 h-3.5" />}
            label="Impact"
            value={`${stats.impactPercentage}%`}
            color={
              stats.impactPercentage > 50
                ? "text-red-600 dark:text-red-400"
                : stats.impactPercentage > 25
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400"
            }
          />
          {stats.chaosTotalFailures > 0 && (
            <StatItem
              icon={<BoltIcon className="w-3.5 h-3.5" />}
              label="Total Failures"
              value={String(stats.chaosTotalFailures)}
              color="text-red-600 dark:text-red-400"
            />
          )}
          {stats.chaosMTBF !== null && (
            <StatItem
              icon={<ClockIcon className="w-3.5 h-3.5" />}
              label="MTBF"
              value={`${stats.chaosMTBF}ms`}
              color="text-purple-600 dark:text-purple-400"
            />
          )}
          {stats.chaosSeveredEdges > 0 && (
            <StatItem
              icon={<LinkIcon className="w-3.5 h-3.5" />}
              label="Severed"
              value={String(stats.chaosSeveredEdges)}
              color="text-purple-600 dark:text-purple-400"
            />
          )}
        </div>
      )}
    </div>
  );
}

function StatItem({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className={`flex items-center gap-1 ${color}`}>
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
          {label}
        </span>
      </div>
      <span className={`text-sm font-semibold ${color} truncate`}>{value}</span>
    </div>
  );
}
