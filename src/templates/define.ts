import type { Edge, Node } from "@xyflow/react";
import { diagramDataSchema } from "@/schemas/diagram";
import type {
  ArchitectureAttribute,
  ArchitectureEdgeData,
  DesignDecision,
  ArchitectureNodeType,
  EdgeProtocol,
  GroupNodeType,
  HttpMethod,
} from "@/types";
import { autoLayoutDiagram } from "@/utils/layout";
import { archEdge, archNode, groupNode } from "./builders";
import type { DiagramTemplate, TemplateCategory } from "./types";

interface ContractSpec {
  name: string;
  /** Example payload fields, rendered as a JSON schema sketch. */
  fields: Record<string, unknown>;
  description?: string;
}

interface GroupSpec {
  id: string;
  type: GroupNodeType;
  label: string;
  /** Parent group id, declared earlier in the list. */
  in?: string;
}

interface NodeSpec {
  id: string;
  type: ArchitectureNodeType;
  label: string;
  attrs?: ArchitectureAttribute[];
  description?: string;
  in?: string;
}

interface EdgeSpec {
  from: string;
  to: string;
  protocol: EdgeProtocol;
  label?: string;
  method?: HttpMethod;
  async?: boolean;
  /** Illustrative simulation delay, not an observed production measurement. */
  latencyMs?: number;
  decision?: DesignDecision;
  request?: ContractSpec;
  response?: ContractSpec;
}

export interface TemplateSpec {
  id: string;
  name: string;
  category: TemplateCategory;
  inspiredBy?: string;
  description: string;
  keywords: string[];
  highlights: string[];
  groups?: GroupSpec[];
  nodes: NodeSpec[];
  edges: EdgeSpec[];
  /** One decision per group and node id, so every component explains why it was chosen. */
  decisions: Record<string, DesignDecision>;
  flow: { name: string; description: string; from: string; color: string };
}

function contract(spec: ContractSpec) {
  return {
    format: "json" as const,
    schemaName: spec.name,
    schema: JSON.stringify(spec.fields, null, 2),
    ...(spec.description ? { description: spec.description } : {}),
  };
}

function edgeData(spec: EdgeSpec): ArchitectureEdgeData {
  return {
    protocol: spec.protocol,
    ...(spec.decision ? { decision: { ...spec.decision } } : {}),
    ...(spec.latencyMs === undefined
      ? {}
      : { description: "Illustrative simulation delay in ms; not a production measurement." }),
    ...(spec.label ? { label: spec.label } : {}),
    ...(spec.method ? { method: spec.method } : {}),
    ...(spec.async ? { async: true } : {}),
    ...(spec.latencyMs === undefined ? {} : { latencyMs: spec.latencyMs }),
    ...(spec.request ? { dataContract: contract(spec.request) } : {}),
    ...(spec.response ? { responseContract: contract(spec.response) } : {}),
  };
}

/**
 * Author a template as components and connections; the shared auto formatter
 * computes positions and group sizes, so templates stay readable and tidy.
 */
/**
 * Attach one decision per group and architecture node, failing loudly when a template
 * misses a component or names one that does not exist.
 */
export function attachDecisions(
  templateId: string,
  nodes: Node[],
  decisions: Record<string, DesignDecision>,
): Node[] {
  const ids = new Set(nodes.map((node) => node.id));
  const unknown = Object.keys(decisions).filter((id) => !ids.has(id));
  if (unknown.length > 0) {
    throw new Error(
      `Template "${templateId}" has decisions for unknown ids: ${unknown.join(", ")}`,
    );
  }
  return nodes.map((node) => {
    const decision = decisions[node.id];
    if (!decision) {
      throw new Error(`Template "${templateId}" needs a decision for "${node.id}"`);
    }
    return { ...node, data: { ...node.data, decision: structuredClone(decision) } };
  });
}

export function defineTemplate(spec: TemplateSpec): DiagramTemplate {
  const groups: Node[] = (spec.groups ?? []).map((group) =>
    groupNode(
      group.id,
      group.type,
      group.label,
      0,
      0,
      400,
      300,
      group.in ? { parentId: group.in } : {},
    ),
  );
  const components: Node[] = spec.nodes.map((node) =>
    archNode(node.id, node.type, node.label, 0, 0, {
      ...(node.attrs ? { attributes: node.attrs } : {}),
      ...(node.description ? { description: node.description } : {}),
      ...(node.in ? { parentId: node.in } : {}),
    }),
  );
  const edges: Edge[] = spec.edges.map((edge, index) =>
    archEdge(`e${index}-${edge.from}-${edge.to}`, edge.from, edge.to, edgeData(edge)),
  );

  const data = diagramDataSchema.parse({
    nodes: autoLayoutDiagram(
      attachDecisions(spec.id, [...groups, ...components], spec.decisions),
      edges,
    ),
    edges,
    flows: [
      {
        id: `flow-${spec.id}`,
        name: spec.flow.name,
        description: spec.flow.description,
        sourceNodeId: spec.flow.from,
        color: spec.flow.color,
        speed: 1,
        createdAt: "2026-10-30T00:00:00.000Z",
      },
    ],
  });

  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    category: spec.category,
    ...(spec.inspiredBy ? { inspiredBy: spec.inspiredBy } : {}),
    keywords: spec.keywords,
    highlights: spec.highlights,
    data,
  };
}
