import type { ArchitectureNodeType } from "@/types";

export interface NodeCategory {
  id: string;
  label: string;
  types: readonly ArchitectureNodeType[];
}

/** Ordered roughly the way a request travels: people and apps, the edge, compute, data. */
export const NODE_CATEGORIES = [
  {
    id: "clients",
    label: "Clients & People",
    types: ["user", "webapp", "mobileapp", "client", "iot"],
  },
  {
    id: "frontend",
    label: "Inside the Frontend",
    types: ["component", "statestore", "clientstorage", "router", "serviceworker", "sdk"],
  },
  {
    id: "edge",
    label: "Edge & Traffic",
    types: ["dns", "cdn", "edgefunction", "loadbalancer", "gateway", "bff", "ratelimiter", "proxy"],
  },
  {
    id: "compute",
    label: "Compute",
    types: ["service", "worker", "lambda", "scheduler", "workflow", "coordinator", "server"],
  },
  {
    id: "messaging",
    label: "Messaging & Events",
    types: ["queue", "eventbus", "stream", "webhook", "notification"],
  },
  {
    id: "data",
    label: "Data & Storage",
    types: [
      "database",
      "nosql",
      "cache",
      "storage",
      "search",
      "vectordb",
      "graphdb",
      "timeseries",
      "warehouse",
      "datalake",
      "etl",
      "backup",
    ],
  },
  {
    id: "security",
    label: "Identity & Security",
    types: ["auth", "secrets", "firewall", "vpn"],
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
      "inference",
      "embedding",
      "agent",
      "retriever",
      "reranker",
      "prompt",
      "guardrail",
      "tool",
      "evaluation",
      "training",
      "modelregistry",
      "featurestore",
      "gpu",
    ],
  },
  {
    id: "external",
    label: "Third-party",
    types: ["external"],
  },
] as const satisfies readonly NodeCategory[];
