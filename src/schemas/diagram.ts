import { z } from "zod";
import { Position as ReactFlowPosition } from "@xyflow/react";
import type { DiagramData } from "@/types";

export const architectureNodeTypeSchema = z.enum([
  "user",
  "webapp",
  "mobileapp",
  "client",
  "iot",
  "component",
  "statestore",
  "clientstorage",
  "router",
  "serviceworker",
  "sdk",
  "dns",
  "cdn",
  "edgefunction",
  "loadbalancer",
  "gateway",
  "bff",
  "ratelimiter",
  "proxy",
  "service",
  "worker",
  "lambda",
  "scheduler",
  "workflow",
  "coordinator",
  "server",
  "queue",
  "eventbus",
  "stream",
  "webhook",
  "notification",
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
  "auth",
  "secrets",
  "firewall",
  "vpn",
  "logging",
  "metrics",
  "tracing",
  "alerting",
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
  "external",
]);

/** Node types merged into a role-based type; documents using them are rewritten on load. */
export const RETIRED_NODE_TYPES = {
  ingress: "loadbalancer",
  container: "server",
  kubernetes: "server",
  identity: "auth",
  payment: "external",
  email: "external",
  mlpipeline: "training",
} as const satisfies Record<string, z.infer<typeof architectureNodeTypeSchema>>;

export const groupNodeTypeSchema = z.enum([
  "region",
  "vpc",
  "subnet",
  "cluster",
  "replicaset",
  "shard",
  "boundary",
  "microfrontend",
  "view",
]);
export const commentColorSchema = z.enum(["yellow", "blue", "green", "pink", "purple"]);
export const nodeStatusSchema = z.enum(["active", "inactive", "warning"]);
export const groupColorSchema = z.enum(["zinc", "blue", "emerald", "purple", "amber"]);

export const edgeProtocolSchema = z.enum([
  "http",
  "grpc",
  "graphql",
  "websocket",
  "sse",
  "webrtc",
  "udp",
  "inapp",
  "tcp",
  "amqp",
  "rabbitmq",
  "kafka",
  "eventbridge",
  "mqtt",
  "sns",
  "sql",
  "redis",
  "s3",
  "replication",
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

export const architectureAttributeSchema = z
  .object({
    name: z.string().refine((name) => name.trim().length > 0, "Enter an attribute name."),
    value: z.string().refine((value) => value.trim().length > 0, "Enter an attribute value."),
    unit: z
      .string()
      .min(1, "Enter a unit or leave the unit field empty.")
      .max(64, "Use a unit of at most 64 characters.")
      .refine((unit) => unit.trim() === unit, "Remove spaces around the unit.")
      .regex(/^[^\p{Cc}\p{Cf}]+$/u, "Use a unit without control characters.")
      .exactOptional(),
  })
  .strict();

// Editor input is stricter than stored data so legacy unitless numbers remain readable.
export const architectureAttributeInputSchema = architectureAttributeSchema.superRefine(
  (attribute, ctx) => {
    if (
      !attribute.unit &&
      /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(attribute.value.trim())
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["unit"],
        message: "Choose an explicit unit for a numeric value, such as ms, count, or replicas.",
      });
    }
  },
);

export const consideredOptionSchema = z
  .object({
    option: z.string(),
    whyNot: z.string().exactOptional(),
  })
  .strict();

export const designDecisionSchema = z
  .object({
    choice: z.string().exactOptional(),
    reason: z.string().exactOptional(),
    benefits: z.array(z.string()).exactOptional(),
    drawbacks: z.array(z.string()).exactOptional(),
    considered: z.array(consideredOptionSchema).exactOptional(),
    revisitWhen: z.array(z.string()).exactOptional(),
  })
  .strict();

export const architectureNodeDataSchema = z
  .object({
    label: z.string(),
    type: architectureNodeTypeSchema,
    description: z.string().exactOptional(),
    technology: z.string().exactOptional(),
    port: z.string().exactOptional(),
    status: nodeStatusSchema.exactOptional(),
    metadata: z.record(z.string(), z.string()).exactOptional(),
    attributes: z.array(architectureAttributeSchema).exactOptional(),
    decision: designDecisionSchema.exactOptional(),
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
    decision: designDecisionSchema.exactOptional(),
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
    decision: designDecisionSchema.exactOptional(),
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

const RETIRED_TYPE_REPLACEMENTS: ReadonlyMap<string, string> = new Map(
  Object.entries(RETIRED_NODE_TYPES),
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Rewrites nodes saved with a retired type before validation. Merged types take their role-based
 * replacement; a Microfrontend node becomes a Microfrontend group, keeping its label, description,
 * decision and placement.
 */
function migrateRetiredNodeType(value: unknown): unknown {
  if (!isRecord(value) || value["type"] !== "architecture" || !isRecord(value["data"])) {
    return value;
  }
  const data = value["data"];
  const type = data["type"];
  if (type === "microfrontend") {
    const { label, description, decision, parentId } = data;
    return {
      ...value,
      type: "group",
      zIndex: -1,
      style: { width: 360, height: 240, ...(isRecord(value["style"]) ? value["style"] : {}) },
      data: {
        label,
        groupType: "microfrontend",
        collapsed: false,
        ...(description === undefined ? {} : { description }),
        ...(decision === undefined ? {} : { decision }),
        ...(parentId === undefined ? {} : { parentId }),
      },
    };
  }
  const replacement = typeof type === "string" ? RETIRED_TYPE_REPLACEMENTS.get(type) : undefined;
  if (replacement) {
    return { ...value, data: { ...data, type: replacement } };
  }
  return value;
}

export const reactFlowNodeSchema = z.preprocess(
  migrateRetiredNodeType,
  z.union([architectureNodeSchema, groupNodeSchema, commentNodeSchema]),
);

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
export type ArchitectureAttribute = z.infer<typeof architectureAttributeSchema>;
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
