import type { Edge, Node } from "@xyflow/react";
import { diagramDataSchema } from "@/schemas/diagram";
import type {
  ArchitectureEdgeData,
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
  technology?: string;
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
  latencyMs?: number;
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
      ...(node.technology ? { technology: node.technology } : {}),
      ...(node.description ? { description: node.description } : {}),
      ...(node.in ? { parentId: node.in } : {}),
    }),
  );
  const edges: Edge[] = spec.edges.map((edge, index) =>
    archEdge(`e${index}-${edge.from}-${edge.to}`, edge.from, edge.to, edgeData(edge)),
  );

  const data = diagramDataSchema.parse({
    nodes: autoLayoutDiagram([...groups, ...components], edges),
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
