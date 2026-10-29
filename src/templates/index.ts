import { DiagramData } from "@/types";

/**
 * Starter templates: pre-designed diagrams users can load from the template
 * gallery (toolbar) or the empty-canvas call-to-action. Each template is a
 * plain DiagramData object authored in its own module via the builders in
 * `./builders.ts`, and ships with groups, protocols, data contracts and a
 * saved flow so it doubles as feature discovery.
 */
export interface DiagramTemplate {
  id: string;
  name: string;
  description: string;
  category: "Web" | "Microservices" | "Data" | "AI";
  /** Short chips describing what the template demonstrates. */
  highlights: string[];
  data: DiagramData;
}

/**
 * Deep-clone a template's data with every id namespaced by a unique suffix.
 * This makes loading safe and repeatable: templates can be added onto an
 * existing canvas (even the same template twice) without id collisions, and
 * the store never receives references to the module-level template objects.
 */
export function instantiateTemplate(template: DiagramTemplate): DiagramData {
  const suffix = `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const rename = (id: string) => `${id}-${suffix}`;
  const templateData = structuredClone(template.data);

  const nodes = templateData.nodes.map((node) => ({
    ...node,
    id: rename(node.id),
    position: { ...node.position },
    ...(node.style ? { style: { ...node.style } } : {}),
    ...(node.parentId ? { parentId: rename(node.parentId) } : {}),
    data: {
      ...node.data,
      ...(typeof node.data.parentId === "string" ? { parentId: rename(node.data.parentId) } : {}),
    },
  }));

  const edges = templateData.edges.map((edge) => ({
    ...edge,
    id: rename(edge.id),
    source: rename(edge.source),
    target: rename(edge.target),
  }));

  const flows = (templateData.flows ?? []).map((flow) => ({
    ...flow,
    id: rename(flow.id),
    sourceNodeId: rename(flow.sourceNodeId),
    ...(flow.edgeIds ? { edgeIds: flow.edgeIds.map(rename) } : {}),
    createdAt: new Date().toISOString(),
  }));

  return { nodes, edges, flows };
}

import { threeTierWeb } from "./threeTierWeb";
import { microservicesEcommerce } from "./microservicesEcommerce";
import { dataPipeline } from "./dataPipeline";
import { ragChatbot } from "./ragChatbot";

export const DIAGRAM_TEMPLATES: DiagramTemplate[] = [
  threeTierWeb,
  microservicesEcommerce,
  dataPipeline,
  ragChatbot,
];
