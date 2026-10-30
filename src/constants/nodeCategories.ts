import type { ArchitectureNodeType } from "@/types";

export interface NodeCategory {
  id: string;
  label: string;
  types: readonly ArchitectureNodeType[];
}

export const NODE_CATEGORIES = [
  {
    id: "frontend",
    label: "Frontend",
    types: [
      "client",
      "webapp",
      "mobileapp",
      "component",
      "microfrontend",
      "router",
      "statestore",
      "serviceworker",
      "bff",
    ],
  },
  {
    id: "backend",
    label: "Backend & Messaging",
    types: [
      "service",
      "lambda",
      "gateway",
      "queue",
      "eventbus",
      "worker",
      "scheduler",
      "workflow",
      "ratelimiter",
      "webhook",
    ],
  },
  {
    id: "infrastructure",
    label: "Infrastructure & Security",
    types: [
      "loadbalancer",
      "cdn",
      "container",
      "dns",
      "secrets",
      "server",
      "kubernetes",
      "ingress",
      "proxy",
      "firewall",
      "vpn",
    ],
  },
  {
    id: "data",
    label: "Data & Storage",
    types: [
      "database",
      "cache",
      "storage",
      "datalake",
      "search",
      "nosql",
      "graphdb",
      "timeseries",
      "warehouse",
      "etl",
      "stream",
      "backup",
    ],
  },
  {
    id: "observability",
    label: "Observability",
    types: ["logging", "metrics", "tracing", "alerting"],
  },
  {
    id: "ai",
    label: "AI & Machine Learning",
    types: [
      "llm",
      "vectordb",
      "mlpipeline",
      "embedding",
      "agent",
      "retriever",
      "reranker",
      "prompt",
      "guardrail",
      "modelregistry",
      "featurestore",
      "training",
      "inference",
      "gpu",
      "evaluation",
      "tool",
    ],
  },
  {
    id: "integrations",
    label: "Integrations & Identity",
    types: ["external", "auth", "notification", "payment", "email", "identity", "iot"],
  },
] as const satisfies readonly NodeCategory[];
