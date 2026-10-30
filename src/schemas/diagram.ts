import { z } from "zod";
import { Position as ReactFlowPosition } from "@xyflow/react";
import type { DiagramData } from "@/types";

export const architectureNodeTypeSchema = z.enum([
  "service",
  "database",
  "queue",
  "cache",
  "gateway",
  "external",
  "storage",
  "client",
  "lambda",
  "loadbalancer",
  "cdn",
  "auth",
  "container",
  "dns",
  "llm",
  "vectordb",
  "mlpipeline",
  "embedding",
  "secrets",
  "eventbus",
  "datalake",
  "search",
  "notification",
  "webapp",
  "mobileapp",
  "component",
  "microfrontend",
  "router",
  "statestore",
  "serviceworker",
  "bff",
  "worker",
  "scheduler",
  "workflow",
  "ratelimiter",
  "webhook",
  "server",
  "kubernetes",
  "ingress",
  "proxy",
  "firewall",
  "vpn",
  "nosql",
  "graphdb",
  "timeseries",
  "warehouse",
  "etl",
  "stream",
  "backup",
  "logging",
  "metrics",
  "tracing",
  "alerting",
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
  "payment",
  "email",
  "identity",
  "iot",
]);

export const groupNodeTypeSchema = z.enum(["vpc", "cluster", "region", "subnet", "boundary", "view"]);
export const commentColorSchema = z.enum(["yellow", "blue", "green", "pink", "purple"]);
export const nodeStatusSchema = z.enum(["active", "inactive", "warning"]);
export const groupColorSchema = z.enum(["zinc", "blue", "emerald", "purple", "amber"]);

export const edgeProtocolSchema = z.enum([
  "http",
  "grpc",
  "graphql",
  "websocket",
  "tcp",
  "amqp",
  "rabbitmq",
  "kafka",
  "eventbridge",
  "sns",
  "sql",
  "redis",
  "s3",
  "vector",
  "search",
  "oauth",
  "dns",
  "inference",
]);

export const httpMethodSchema = z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]);
export const dataFormatSchema = z.enum(["json", "protobuf", "avro", "xml", "binary", "text"]);
export const simulationSpeedSchema = z.union([
  z.literal(0.25),
  z.literal(0.5),
  z.literal(1),
  z.literal(2),
  z.literal(4),
]);

export const architectureNodeDataSchema = z
  .object({
    label: z.string(),
    type: architectureNodeTypeSchema,
    description: z.string().exactOptional(),
    technology: z.string().exactOptional(),
    port: z.string().exactOptional(),
    status: nodeStatusSchema.exactOptional(),
    metadata: z.record(z.string(), z.string()).exactOptional(),
    parentId: z.string().exactOptional(),
    healthCheckUrl: z.string().exactOptional(),
    tags: z.array(z.string()).exactOptional(),
    iconifyIcon: z.string().exactOptional(),
    iconColor: z.string().exactOptional(),
    accentColor: z.string().exactOptional(),
    backgroundColor: z.string().exactOptional(),
  })
  .strict();

export const groupNodeDataSchema = z
  .object({
    label: z.string(),
    groupType: groupNodeTypeSchema,
    parentId: z.string().exactOptional(),
    collapsed: z.boolean().exactOptional(),
    color: groupColorSchema.exactOptional(),
    accentColor: z.string().exactOptional(),
    backgroundColor: z.string().exactOptional(),
    description: z.string().exactOptional(),
  })
  .strict();

export const commentNodeDataSchema = z
  .object({
    text: z.string(),
    parentId: z.string().exactOptional(),
    color: commentColorSchema.exactOptional(),
    author: z.string().exactOptional(),
    createdAt: z.string().exactOptional(),
    minimized: z.boolean().exactOptional(),
  })
  .strict();

export const dataContractSchema = z
  .object({
    format: dataFormatSchema,
    schemaName: z.string().exactOptional(),
    schema: z.string().exactOptional(),
    description: z.string().exactOptional(),
  })
  .strict();

export const architectureEdgeDataSchema = z
  .object({
    label: z.string().exactOptional(),
    protocol: edgeProtocolSchema.exactOptional(),
    method: httpMethodSchema.exactOptional(),
    async: z.boolean().exactOptional(),
    animated: z.boolean().exactOptional(),
    bidirectional: z.boolean().exactOptional(),
    latencyMs: z.number().exactOptional(),
    description: z.string().exactOptional(),
    dataContract: dataContractSchema.exactOptional(),
    responseContract: dataContractSchema.exactOptional(),
    tags: z.array(z.string()).exactOptional(),
  })
  .strict();

export const positionSchema = z.object({ x: z.number(), y: z.number() }).strict();
export const nodeOriginSchema = z.tuple([z.number(), z.number()]);
export const coordinateExtentSchema = z.tuple([
  z.tuple([z.number(), z.number()]),
  z.tuple([z.number(), z.number()]),
]);
export const handlePositionSchema = z.enum(ReactFlowPosition);

const cssValueSchema = z.union([z.string(), z.number()]);
// Persist CSS scalar values, never arbitrary objects or executable React props.
const styleSchema = z
  .object({
    width: cssValueSchema.exactOptional(),
    height: cssValueSchema.exactOptional(),
    opacity: cssValueSchema.exactOptional(),
    strokeWidth: cssValueSchema.exactOptional(),
  })
  .catchall(cssValueSchema);

const nodeHandleSchema = z.strictObject({
  id: z.string().nullable().exactOptional(),
  type: z.enum(["source", "target"]),
  position: handlePositionSchema,
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative().exactOptional(),
  height: z.number().nonnegative().exactOptional(),
});

const edgeMarkerSchema = z.union([
  z.string(),
  z.strictObject({
    type: z.enum(["arrow", "arrowclosed"]),
    color: z.string().nullable().exactOptional(),
    width: z.number().nonnegative().exactOptional(),
    height: z.number().nonnegative().exactOptional(),
    markerUnits: z.string().exactOptional(),
    orient: z.string().exactOptional(),
    strokeWidth: z.number().nonnegative().exactOptional(),
  }),
]);

const reactFlowNodeFields = {
  id: z.string(),
  position: positionSchema,
  type: z.string().exactOptional(),
  sourcePosition: handlePositionSchema.exactOptional(),
  targetPosition: handlePositionSchema.exactOptional(),
  hidden: z.boolean().exactOptional(),
  selected: z.boolean().exactOptional(),
  dragging: z.boolean().exactOptional(),
  draggable: z.boolean().exactOptional(),
  selectable: z.boolean().exactOptional(),
  connectable: z.boolean().exactOptional(),
  deletable: z.boolean().exactOptional(),
  focusable: z.boolean().exactOptional(),
  width: z.number().exactOptional(),
  height: z.number().exactOptional(),
  initialWidth: z.number().exactOptional(),
  initialHeight: z.number().exactOptional(),
  parentId: z.string().exactOptional(),
  zIndex: z.number().exactOptional(),
  extent: z.union([z.literal("parent"), coordinateExtentSchema]).exactOptional(),
  expandParent: z.boolean().exactOptional(),
  ariaLabel: z.string().exactOptional(),
  origin: nodeOriginSchema.exactOptional(),
  handles: z.array(nodeHandleSchema).exactOptional(),
  measured: z
    .object({
      width: z.number().exactOptional(),
      height: z.number().exactOptional(),
    })
    .strict()
    .exactOptional(),
  style: styleSchema.exactOptional(),
  className: z.string().exactOptional(),
  resizing: z.boolean().exactOptional(),
  dragHandle: z.string().exactOptional(),
};

export const architectureNodeSchema = z
  .object({
    ...reactFlowNodeFields,
    type: z.literal("architecture"),
    data: architectureNodeDataSchema,
  })
  .strict();

export const groupNodeSchema = z
  .object({
    ...reactFlowNodeFields,
    type: z.literal("group"),
    data: groupNodeDataSchema,
  })
  .strict();

export const commentNodeSchema = z
  .object({
    ...reactFlowNodeFields,
    type: z.literal("comment"),
    data: commentNodeDataSchema,
  })
  .strict();

export const reactFlowNodeSchema = z.union([
  architectureNodeSchema,
  groupNodeSchema,
  commentNodeSchema,
]);

export const architectureEdgeSchema = z
  .object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    sourceHandle: z.string().nullable().exactOptional(),
    targetHandle: z.string().nullable().exactOptional(),
    type: z.string().exactOptional(),
    data: architectureEdgeDataSchema.exactOptional(),
    animated: z.boolean().exactOptional(),
    selected: z.boolean().exactOptional(),
    zIndex: z.number().exactOptional(),
    ariaLabel: z.string().exactOptional(),
    hidden: z.boolean().exactOptional(),
    deletable: z.boolean().exactOptional(),
    selectable: z.boolean().exactOptional(),
    focusable: z.boolean().exactOptional(),
    reconnectable: z.union([z.boolean(), z.enum(["source", "target"])]).exactOptional(),
    interactionWidth: z.number().exactOptional(),
    className: z.string().exactOptional(),
    style: styleSchema.exactOptional(),
    markerStart: edgeMarkerSchema.exactOptional(),
    markerEnd: edgeMarkerSchema.exactOptional(),
    label: z.union([z.string(), z.number(), z.boolean(), z.null()]).exactOptional(),
    labelStyle: styleSchema.exactOptional(),
    labelShowBg: z.boolean().exactOptional(),
    labelBgStyle: styleSchema.exactOptional(),
    labelBgPadding: z.tuple([z.number(), z.number()]).exactOptional(),
    labelBgBorderRadius: z.number().exactOptional(),
  })
  .strict();

export const viewportSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    zoom: z.number().positive(),
  })
  .strict();

export const namedFlowSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().exactOptional(),
    sourceNodeId: z.string(),
    color: z.string().exactOptional(),
    speed: simulationSpeedSchema.exactOptional(),
    edgeIds: z.array(z.string()).exactOptional(),
    createdAt: z.string(),
  })
  .strict();

export const diagramStructureSchema = z
  .object({
    nodes: z.array(reactFlowNodeSchema),
    edges: z.array(architectureEdgeSchema),
    flows: z.array(namedFlowSchema).exactOptional(),
    viewport: viewportSchema.exactOptional(),
  })
  .strict() satisfies z.ZodType<DiagramData>;

export function refineDiagramReferences(
  data: Pick<DiagramData, "nodes" | "edges">,
  ctx: z.RefinementCtx,
) {
  const nodeIds = new Set<string>();
  data.nodes.forEach((node, index) => {
    if (nodeIds.has(node.id)) {
      ctx.addIssue({
        code: "custom",
        path: ["nodes", index, "id"],
        message: `Duplicate node ID "${node.id}"`,
      });
    }
    nodeIds.add(node.id);
  });
  const edgeIds = new Set<string>();
  data.edges.forEach((edge, index) => {
    if (edgeIds.has(edge.id)) {
      ctx.addIssue({
        code: "custom",
        path: ["edges", index, "id"],
        message: `Duplicate edge ID "${edge.id}"`,
      });
    }
    edgeIds.add(edge.id);
    if (!nodeIds.has(edge.source)) {
      ctx.addIssue({
        code: "custom",
        path: ["edges", index, "source"],
        message: `Edge source node "${edge.source}" does not exist`,
      });
    }
    if (!nodeIds.has(edge.target)) {
      ctx.addIssue({
        code: "custom",
        path: ["edges", index, "target"],
        message: `Edge target node "${edge.target}" does not exist`,
      });
    }
  });
}

export const diagramDataSchema = diagramStructureSchema.superRefine(refineDiagramReferences);

export type ArchitectureNodeType = z.infer<typeof architectureNodeTypeSchema>;
export type GroupNodeType = z.infer<typeof groupNodeTypeSchema>;
export type CommentColor = z.infer<typeof commentColorSchema>;
export type NodeStatus = z.infer<typeof nodeStatusSchema>;
export type GroupColor = z.infer<typeof groupColorSchema>;
export type EdgeProtocol = z.infer<typeof edgeProtocolSchema>;
export type HttpMethod = z.infer<typeof httpMethodSchema>;
export type DataFormat = z.infer<typeof dataFormatSchema>;
export type SimulationSpeed = z.infer<typeof simulationSpeedSchema>;
export type ArchitectureNodeData = z.infer<typeof architectureNodeDataSchema>;
export type GroupNodeData = z.infer<typeof groupNodeDataSchema>;
export type CommentNodeData = z.infer<typeof commentNodeDataSchema>;
export type DataContract = z.infer<typeof dataContractSchema>;
export type ArchitectureEdgeData = z.infer<typeof architectureEdgeDataSchema>;
export type Position = z.infer<typeof positionSchema>;
export type NodeOrigin = z.infer<typeof nodeOriginSchema>;
export type CoordinateExtent = z.infer<typeof coordinateExtentSchema>;
export type HandlePosition = z.infer<typeof handlePositionSchema>;
export type ArchitectureNode = z.infer<typeof architectureNodeSchema>;
export type GroupNode = z.infer<typeof groupNodeSchema>;
export type CommentNode = z.infer<typeof commentNodeSchema>;
export type ReactFlowNode = z.infer<typeof reactFlowNodeSchema>;
export type ArchitectureEdge = z.infer<typeof architectureEdgeSchema>;
export type Viewport = z.infer<typeof viewportSchema>;
export type NamedFlow = z.infer<typeof namedFlowSchema>;

export interface FormattedZodIssue {
  code: z.core.$ZodIssue["code"];
  message: string;
  path: string;
}

function formatIssuePath(path: PropertyKey[]): string {
  return path.reduce<string>((formattedPath, segment) => {
    if (typeof segment === "number") {
      return `${formattedPath}[${segment}]`;
    }

    return `${formattedPath}.${String(segment)}`;
  }, "$");
}

export function formatZodIssues(error: z.ZodError): FormattedZodIssue[] {
  return error.issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    path: formatIssuePath(issue.path),
  }));
}
