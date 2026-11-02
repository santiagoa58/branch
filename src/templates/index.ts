import type { DiagramData } from "@/types";
import { designDecisionSchema } from "@/schemas/diagram";
import type { DiagramTemplate, TemplateCategory } from "./types";
import { threeTierWeb } from "./threeTierWeb";
import { microservicesEcommerce } from "./microservicesEcommerce";
import { dataPipeline } from "./dataPipeline";
import { ragChatbot } from "./ragChatbot";
import { STORAGE_TEMPLATES } from "./catalog/storage";
import { SOCIAL_TEMPLATES } from "./catalog/social";
import { MEDIA_TEMPLATES } from "./catalog/media";
import { COMMERCE_TEMPLATES } from "./catalog/commerce";
import { MARKETPLACE_TEMPLATES } from "./catalog/marketplace";
import { WEB_TEMPLATES } from "./catalog/web";
import { DATA_TEMPLATES } from "./catalog/data";
import { AI_TEMPLATES } from "./catalog/ai";
import { PLATFORM_TEMPLATES } from "./catalog/platform";

export { TEMPLATE_CATEGORIES } from "./types";
export type { DiagramTemplate, TemplateCategory } from "./types";

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

export const DIAGRAM_TEMPLATES: DiagramTemplate[] = [
  threeTierWeb,
  ...STORAGE_TEMPLATES,
  ...SOCIAL_TEMPLATES,
  ...MEDIA_TEMPLATES,
  microservicesEcommerce,
  ...COMMERCE_TEMPLATES,
  ...MARKETPLACE_TEMPLATES,
  ...WEB_TEMPLATES,
  dataPipeline,
  ...DATA_TEMPLATES,
  ragChatbot,
  ...AI_TEMPLATES,
  ...PLATFORM_TEMPLATES,
];

function searchableText(template: DiagramTemplate): string {
  const components = template.data.nodes.flatMap((node) => {
    const decision = designDecisionSchema.safeParse(node.data["decision"]).data;
    const values = [
      node.data["label"],
      node.data["technology"],
      node.data["type"],
      decision?.choice,
    ];
    return values.filter((value): value is string => typeof value === "string");
  });
  return [
    template.name,
    template.description,
    template.inspiredBy ?? "",
    ...template.keywords,
    ...template.highlights,
    ...components,
  ]
    .join(" ")
    .toLocaleLowerCase();
}

const SEARCH_TEXT = new Map(DIAGRAM_TEMPLATES.map((t) => [t.id, searchableText(t)]));

/** Every search word must match the template's name, product, keywords or components. */
export function findTemplates(
  query: string,
  category: TemplateCategory | "all" = "all",
  templates: readonly DiagramTemplate[] = DIAGRAM_TEMPLATES,
): DiagramTemplate[] {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return templates.filter((template) => {
    if (category !== "all" && template.category !== category) {
      return false;
    }
    const text = SEARCH_TEXT.get(template.id) ?? searchableText(template);
    return words.every((word) => text.includes(word));
  });
}
