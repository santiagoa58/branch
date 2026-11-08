import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { workspaceQuery } from "@/services/workspaceQuery";
import { useCloudWorkspace } from "@/services/cloudWorkspace";
import { ChevronDownIcon, ChevronLeftIcon } from "@heroicons/react/24/outline";
import { useDiagramStore } from "@/store/diagramStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

import type {
  ArchitectureEdgeData,
  ArchitectureNodeData,
  ArchitectureNodeType,
  EdgeProtocol,
} from "@/types";
import { cn } from "@/lib/utils";

const TECH_RULES: {
  label: string;
  types?: ArchitectureNodeType[];
  protocols?: EdgeProtocol[];
}[] = [
  { label: "PostgreSQL", types: ["database"] },
  { label: "Redis", types: ["cache"] },
  { label: "RabbitMQ", types: ["queue"] },
  { label: "S3", types: ["storage"] },
  { label: "gRPC", protocols: ["grpc"] },
  { label: "Kafka", protocols: ["kafka"] },
  { label: "AMQP", protocols: ["amqp"] },
  { label: "WebSocket", protocols: ["websocket"] },
  { label: "API Gateway", types: ["gateway"] },
  { label: "AI/LLM", types: ["llm", "embedding", "inference", "agent", "vectordb"] },
  { label: "GraphQL", protocols: ["graphql"] },
  { label: "Lambda", types: ["lambda"] },
];

export function DiagramInfoCard() {
  const [collapsed, setCollapsed] = useState(true);
  const { currentProjectId, currentDiagramId } = useWorkspaceStore();
  const cloud = useCloudWorkspace();
  const nodes = useDiagramStore((s) => s.nodes);
  const edges = useDiagramStore((s) => s.edges);

  const { data: project } = useQuery({
    ...workspaceQuery.project(currentProjectId ?? ""),
    enabled: Boolean(currentProjectId),
  });
  // The active editor document is already authoritative; do not download it again.
  const diagram = cloud.diagram?.id === currentDiagramId ? cloud.diagram : null;

  const techTags = useMemo(() => {
    const usedTypes = new Set<string>();
    for (const n of nodes) {
      if (n.type === "architecture") {
        const t = (n.data as ArchitectureNodeData).type;
        if (t) {
          usedTypes.add(t);
        }
      }
    }
    const usedProtocols = new Set<string>();
    for (const e of edges) {
      // oxlint-disable-next-line typescript/no-unnecessary-type-assertion -- false positive: Edge data is Record<string, unknown>; the cast is what types `protocol`
      const p = (e.data as ArchitectureEdgeData | undefined)?.protocol;
      if (p) {
        usedProtocols.add(p);
      }
    }
    return TECH_RULES.filter(
      (rule) =>
        (rule.types?.some((t) => usedTypes.has(t)) ?? false) ||
        (rule.protocols?.some((p) => usedProtocols.has(p)) ?? false),
    ).map((rule) => rule.label);
  }, [nodes, edges]);

  const title = useMemo(() => {
    const parts: string[] = [];
    if (project?.name) {
      parts.push(project.name);
    }
    if (diagram?.name) {
      parts.push(diagram.name);
    }
    if (parts.length === 0) {
      return "Architecture Diagram";
    }
    return parts.join(" · ");
  }, [project, diagram]);

  const description = diagram?.description || project?.description || null;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className={cn(
          "pointer-events-auto flex items-center gap-2 px-3 py-2",
          "bg-white/90 dark:bg-zinc-950/85 backdrop-blur-md",
          "border border-zinc-200 dark:border-zinc-800 rounded-lg",
          "shadow-lg shadow-black/5 dark:shadow-black/40",
          "hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors",
          "max-w-71 animate-slide-in",
        )}
        title="Expand"
      >
        <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate tracking-tight">
          {title}
        </span>
        <ChevronDownIcon className="w-3 h-3 text-zinc-500 dark:text-zinc-500 shrink-0" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-auto max-w-71 px-3.5 py-3",
        "bg-white/95 dark:bg-zinc-950/85 backdrop-blur-md",
        "border border-zinc-200 dark:border-zinc-800 rounded-lg",
        "shadow-lg shadow-black/5 dark:shadow-black/40",
        "animate-slide-in",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 leading-tight tracking-tight truncate">
            {title}
          </div>
          {description && (
            <div className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400 line-clamp-3">
              {description}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="shrink-0 p-1 opacity-50 hover:opacity-100 transition-opacity"
          title="Collapse"
        >
          <ChevronLeftIcon className="w-3 h-3 text-zinc-500 dark:text-zinc-500" />
        </button>
      </div>

      {techTags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {techTags.map((t) => (
            <span
              key={t}
              className="px-2 py-0.5 text-[10px] font-medium font-mono rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
