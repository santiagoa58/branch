import type { DiagramData } from "@/types";

export const TEMPLATE_CATEGORIES = [
  { id: "web", label: "Web & SaaS" },
  { id: "storage", label: "Files & collaboration" },
  { id: "social", label: "Social & messaging" },
  { id: "media", label: "Media, video & games" },
  { id: "commerce", label: "Commerce & payments" },
  { id: "marketplace", label: "Marketplaces & logistics" },
  { id: "data", label: "Data & analytics" },
  { id: "ai", label: "AI & machine learning" },
  { id: "platform", label: "Platform & DevOps" },
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]["id"];

/**
 * Starter templates: pre-designed diagrams users can load from the template
 * gallery or the empty-canvas call-to-action. Each ships with groups,
 * protocols, data contracts and a saved flow so it doubles as feature discovery.
 */
export interface DiagramTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  /** A well-known product with a similar architecture, used for discovery and search. */
  inspiredBy?: string;
  /** Extra search terms: product names, domains and architectural patterns. */
  keywords: string[];
  /** Short chips describing what the template demonstrates. */
  highlights: string[];
  data: DiagramData;
}
