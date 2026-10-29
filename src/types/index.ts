import { Node, Edge } from "@xyflow/react";

// Node types for architecture components
export type ArchitectureNodeType =
  | "service"
  | "database"
  | "queue"
  | "cache"
  | "gateway"
  | "external"
  | "storage"
  | "client"
  // Tier 1: Cloud Infrastructure
  | "lambda"
  | "loadbalancer"
  | "cdn"
  | "auth"
  | "container"
  | "dns"
  // Tier 2: AI/ML
  | "llm"
  | "vectordb"
  | "mlpipeline"
  | "embedding"
  // Tier 3: Cloud Services
  | "secrets"
  | "eventbus"
  | "datalake"
  | "search"
  | "notification";

// Group types for infrastructure containers
export type GroupNodeType = "vpc" | "cluster" | "region" | "subnet";

// Comment note colors
export type CommentColor = "yellow" | "blue" | "green" | "pink" | "purple";

export type NodeStatus = "active" | "inactive" | "warning";

// Data structure for architecture nodes
export type ArchitectureNodeData = {
  label: string;
  type: ArchitectureNodeType;
  description?: string;
  technology?: string;
  port?: string;
  status?: NodeStatus;
  metadata?: Record<string, string>;
  parentId?: string; // For grouping - reference to parent group
  healthCheckUrl?: string; // Health check endpoint URL
  /** Free-form user tags. Filterable via the TagFilter overlay. */
  tags?: string[];
  iconifyIcon?: string; // Custom Iconify icon ID (e.g., "mdi:kubernetes", "logos:docker-icon")
  iconColor?: string; // Custom icon color (hex/CSS color)
  accentColor?: string; // Optional accent for icon container and subtle highlights
  backgroundColor?: string; // Optional semi-transparent background tint
} & Record<string, unknown>;

// Data structure for group nodes
export type GroupNodeData = {
  label: string;
  groupType: GroupNodeType;
  collapsed?: boolean;
  color?: "zinc" | "blue" | "emerald" | "purple" | "amber";
  accentColor?: string; // Optional accent for group border and badge
  backgroundColor?: string; // Optional semi-transparent background tint
  description?: string;
} & Record<string, unknown>;

// Data structure for comment/annotation nodes
export type CommentNodeData = {
  text: string;
  color?: CommentColor;
  author?: string;
  createdAt?: string;
  minimized?: boolean;
} & Record<string, unknown>;

// Edge protocol types
export type EdgeProtocol =
  // Standard
  | "http"
  | "grpc"
  | "graphql"
  | "websocket"
  | "tcp"
  // Messaging
  | "amqp"
  | "rabbitmq"
  | "kafka"
  | "eventbridge"
  | "sns"
  // Data
  | "sql"
  | "redis"
  | "s3"
  | "vector"
  | "search"
  // Auth/DNS
  | "oauth"
  | "dns"
  // AI/ML
  | "inference";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

// Data format types for edge data contracts
export type DataFormat = "json" | "protobuf" | "avro" | "xml" | "binary" | "text";

// Data contract structure for edges
export interface DataContract {
  format: DataFormat;
  schemaName?: string;
  schema?: string;
  description?: string;
}

// Data structure for architecture edges
export type ArchitectureEdgeData = {
  label?: string;
  protocol?: EdgeProtocol;
  method?: HttpMethod;
  async?: boolean;
  animated?: boolean;
  bidirectional?: boolean;
  latencyMs?: number;
  description?: string;
  /** Request payload contract (for request/response protocols, this is the request body). */
  dataContract?: DataContract;
  /** Response payload contract — only meaningful when the protocol supports request/response. */
  responseContract?: DataContract;
  /** Free-form user tags. Filterable via the TagFilter overlay. */
  tags?: string[];
} & Record<string, unknown>;

// Data carried by a synthetic rolled-up edge (derived in utils/groupRollup.ts
// when a collapsed group aggregates its boundary-crossing edges). Render-only:
// never persisted and never present in the diagram store.
export type RollupEdgeData = {
  /** Number of real edges aggregated into this rollup. */
  count: number;
  /** Ids of the aggregated real edges. */
  edgeIds: string[];
  /** Distinct protocols across the aggregated edges. */
  protocols: string[];
  /** True when the aggregated edges flow in both directions. */
  bidirectional: boolean;
  /** The collapsed group endpoint(s) — expanding them restores the real edges. */
  collapsedGroupIds: string[];
} & Record<string, unknown>;

// Use base types from React Flow. DiagramData includes every persisted node-data variant.
export type ArchitectureNode = Node<ArchitectureNodeData>;
export type GroupNode = Node<GroupNodeData>;
export type CommentNode = Node<CommentNodeData>;
export type DiagramNode = Node<ArchitectureNodeData | GroupNodeData | CommentNodeData>;
export type ArchitectureEdge = Edge<ArchitectureEdgeData>;

// Diagram state for persistence
export interface DiagramData {
  nodes: DiagramNode[];
  edges: ArchitectureEdge[];
  /** Optional saved playable flows. Backward-compat: old diagrams have undefined. */
  flows?: import("./simulation").NamedFlow[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

// History state for undo/redo
export interface HistoryState {
  nodes: DiagramNode[];
  edges: ArchitectureEdge[];
}
