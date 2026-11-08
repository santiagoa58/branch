import type { Edge, Node } from "@xyflow/react";
import type { ArchitectureNodeType } from "@/types";
import { architectureNodeTypeSchema } from "@/schemas/catalogEnums";

/** An illustrative fallback, not a network measurement or capacity estimate. */
const DEFAULT_HOP_MS = 100;

/** Role-level teaching defaults. An explicit connection latency always takes precedence. */
const ROLE_HOP_MS: Partial<Record<ArchitectureNodeType, number>> = {
  statestore: 2,
  clientstorage: 2,
  cache: 2,
  loadbalancer: 5,
  gateway: 5,
  proxy: 5,
  ratelimiter: 5,
  dns: 5,
  cdn: 5,
  queue: 5,
  stream: 5,
  eventbus: 5,
  database: 10,
  nosql: 10,
  search: 10,
  vectordb: 10,
  graphdb: 10,
  timeseries: 10,
  featurestore: 10,
  worker: 40,
  etl: 40,
  storage: 50,
  datalake: 50,
  warehouse: 50,
  backup: 50,
};

export function simulationNodeType(
  nodeId: string,
  nodes: readonly Node[],
): ArchitectureNodeType | undefined {
  const node = nodes.find((item) => item.id === nodeId && item.type === "architecture");
  const parsed = architectureNodeTypeSchema.safeParse(node?.data["type"]);
  return parsed.success ? parsed.data : undefined;
}

export function isDurableNode(nodeId: string, nodes: readonly Node[]): boolean {
  const type = simulationNodeType(nodeId, nodes);
  return type === "queue" || type === "stream";
}

export function simulationHopMs(edge: Edge, nodes: readonly Node[] = []): number {
  const explicit = edge.data?.["latencyMs"];
  if (typeof explicit === "number" && Number.isFinite(explicit) && explicit >= 0) {
    return explicit;
  }
  const type = simulationNodeType(edge.target, nodes);
  return type === undefined ? DEFAULT_HOP_MS : (ROLE_HOP_MS[type] ?? 20);
}
