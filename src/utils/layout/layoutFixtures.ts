import type { Edge, Node } from "@xyflow/react";
import { archEdge, archNode } from "@/templates/builders";
import type { ArchitectureEdgeData, ArchitectureNodeType } from "@/types";

/**
 * A 14-component collaborative document editor as the AI design pipeline returns it: no groups,
 * every component unpositioned. The diagram from the user's report had this shape.
 */
const COMPONENTS: [string, ArchitectureNodeType, string][] = [
  ["editor", "webapp", "Doc editor"],
  ["cdn", "cdn", "Static assets CDN"],
  ["lb", "loadbalancer", "WebSocket load balancer"],
  ["gateway", "gateway", "API gateway"],
  ["auth", "auth", "Auth service"],
  ["collab", "service", "Collaboration service"],
  ["docs", "service", "Document service"],
  ["comments", "service", "Comments service"],
  ["presence", "cache", "Presence cache"],
  ["events", "queue", "Change events"],
  ["indexer", "worker", "Search indexer"],
  ["docdb", "nosql", "Document store"],
  ["snapshots", "storage", "Snapshot storage"],
  ["search", "search", "Search index"],
];

const CONNECTIONS: [string, string, ArchitectureEdgeData][] = [
  ["editor", "cdn", { protocol: "http", label: "load app" }],
  ["editor", "lb", { protocol: "websocket", label: "edit operations" }],
  ["editor", "gateway", { protocol: "http", label: "documents API" }],
  ["gateway", "auth", { protocol: "http", label: "verify token" }],
  ["lb", "collab", { protocol: "websocket" }],
  ["collab", "auth", { protocol: "grpc", label: "validate session" }],
  ["collab", "presence", { protocol: "redis", label: "cursors" }],
  ["collab", "docs", { protocol: "grpc", label: "persist operations" }],
  ["collab", "events", { protocol: "amqp", async: true, label: "document changed" }],
  ["gateway", "docs", { protocol: "http", label: "load document" }],
  ["gateway", "comments", { protocol: "http", label: "comments API" }],
  ["docs", "docdb", { protocol: "http" }],
  ["docs", "snapshots", { protocol: "s3", async: true, label: "hourly snapshot" }],
  ["comments", "docdb", { protocol: "http" }],
  ["comments", "events", { protocol: "amqp", async: true, label: "mentions" }],
  ["events", "indexer", { protocol: "amqp", async: true }],
  ["indexer", "search", { protocol: "search", label: "index text" }],
];

export function collaborativeDocsDesign(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: COMPONENTS.map(([id, type, label]) => archNode(id, type, label, 0, 0)),
    edges: CONNECTIONS.map(([from, to, data], index) =>
      archEdge(`ai-${from}-${to}-${index}`, from, to, data),
    ),
  };
}
