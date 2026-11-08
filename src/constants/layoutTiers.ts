import type { ArchitectureNodeType } from "@/types";

/**
 * Auto-layout zones, in the left-to-right order a request travels: what runs on the user's
 * device, the network edge, synchronous services, asynchronous work, then data at rest.
 */
export const LAYOUT_TIERS = ["clients", "edge", "services", "async", "data"] as const;

export type LayoutTier = (typeof LAYOUT_TIERS)[number];

export const LAYOUT_TIER_LABELS: Record<LayoutTier, string> = {
  clients: "Clients",
  edge: "Edge",
  services: "Services",
  async: "Async",
  data: "Data",
};

/** Clients run on the user's side; every other tier runs on the server side. */
export const CLIENT_TIER: LayoutTier = "clients";

/**
 * The zone of every node type. Exhaustive on purpose: a new node type fails type-checking until
 * it is assigned a zone here.
 */
export const NODE_TIERS: Record<ArchitectureNodeType, LayoutTier> = {
  // Clients & People, and everything inside a frontend (in-process, on the device)
  user: "clients",
  webapp: "clients",
  mobileapp: "clients",
  client: "clients",
  iot: "clients",
  component: "clients",
  statestore: "clients",
  clientstorage: "clients",
  router: "clients",
  serviceworker: "clients",
  sdk: "clients",

  // Edge & traffic: the first server-side hops a request crosses
  dns: "edge",
  cdn: "edge",
  edgefunction: "edge",
  loadbalancer: "edge",
  gateway: "edge",
  ratelimiter: "edge",
  proxy: "edge",
  firewall: "edge",
  vpn: "edge",

  // Synchronous compute behind the edge, including identity and models served on request
  bff: "services",
  service: "services",
  lambda: "services",
  server: "services",
  auth: "services",
  external: "services",
  llm: "services",
  inference: "services",
  embedding: "services",
  agent: "services",
  retriever: "services",
  reranker: "services",
  guardrail: "services",
  tool: "services",
  gpu: "services",

  // Work that happens after the response: messaging, background jobs and pipelines
  queue: "async",
  eventbus: "async",
  stream: "async",
  webhook: "async",
  notification: "async",
  worker: "async",
  scheduler: "async",
  workflow: "async",
  etl: "async",
  alerting: "async",
  training: "async",
  evaluation: "async",

  // State the system keeps: databases, caches, files, indexes and telemetry stores
  database: "data",
  nosql: "data",
  cache: "data",
  storage: "data",
  search: "data",
  vectordb: "data",
  graphdb: "data",
  timeseries: "data",
  warehouse: "data",
  datalake: "data",
  backup: "data",
  coordinator: "data",
  secrets: "data",
  logging: "data",
  metrics: "data",
  tracing: "data",
  prompt: "data",
  modelregistry: "data",
  featurestore: "data",
};

export function tierIndex(tier: LayoutTier): number {
  return LAYOUT_TIERS.indexOf(tier);
}
