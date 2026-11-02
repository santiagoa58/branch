import { useMemo } from "react";
import type { Node } from "@xyflow/react";
import type { ArchitectureNodeType, DiagramData } from "@/types";
import type { DiagramTemplate } from "@/templates";
import { useTemplateLayout } from "@/hooks/useTemplateLayout";
import { cn } from "@/lib/utils";
import { absoluteRects } from "@/utils/layout/geometry";
import { NODE_TYPES_CONFIG } from "@/constants";

/**
 * Schematic SVG preview of a template's DiagramData: group outlines, colored
 * node blocks and edge lines. Generated from the data itself, so previews
 * never go stale when a template changes.
 */

interface TemplatePreviewProps {
  template: DiagramTemplate;
  className?: string;
  /** Card thumbnails avoid triggering expensive ELK layout jobs. */
  compact?: boolean;
}

function buildPreview(data: DiagramData) {
  const nodes = data.nodes as Node[];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const rects = absoluteRects(nodes);
  const bounds = (node: Node) => {
    const rect = rects.get(node.id)!;
    return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
  };

  const groups = nodes.filter((n) => n.type === "group").map((n) => ({ id: n.id, ...bounds(n) }));

  const blocks = nodes
    .filter((n) => n.type === "architecture")
    .map((n) => ({
      id: n.id,
      ...bounds(n),
      colorClass:
        NODE_TYPES_CONFIG[(n.data as { type: ArchitectureNodeType }).type]?.iconColor ??
        "text-zinc-500",
    }));

  const center = (id: string) => {
    const n = nodeById.get(id);
    if (!n) {
      return null;
    }
    const b = bounds(n);
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  };

  const lines = data.edges
    .map((e) => {
      const s = center(e.source);
      const t = center(e.target);
      return s && t ? { id: e.id, x1: s.x, y1: s.y, x2: t.x, y2: t.y } : null;
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  const all = [...groups, ...blocks];
  const minX = Math.min(...all.map((b) => b.x));
  const minY = Math.min(...all.map((b) => b.y));
  const maxX = Math.max(...all.map((b) => b.x + b.w));
  const maxY = Math.max(...all.map((b) => b.y + b.h));
  const pad = 40;
  const viewBox = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;

  return { groups, blocks, lines, viewBox };
}

/**
 * A small schematic that needs no ELK calculation. Template definitions can have placeholder
 * positions, so a preview grid gives cards visible content without laying out the entire catalog.
 */
function compactPreview(data: DiagramData) {
  const components = data.nodes.filter((node) => node.type === "architecture").slice(0, 16);
  const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(components.length))));
  const nodes = components.map((node, index) => ({
    ...node,
    parentId: undefined,
    position: { x: (index % columns) * 230, y: Math.floor(index / columns) * 140 },
  }));
  const ids = new Set(nodes.map((node) => node.id));
  const edges = data.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
  return buildPreview({ nodes, edges });
}

export function TemplatePreview({ template, className, compact = false }: TemplatePreviewProps) {
  const data = useTemplateLayout(template, !compact);
  const preview = useMemo(
    () => (compact ? compactPreview(template.data) : data ? buildPreview(data) : null),
    [compact, data, template],
  );
  if (!preview) {
    return <svg className={cn("w-full h-full", className)} aria-hidden="true" />;
  }
  const { groups, blocks, lines, viewBox } = preview;

  return (
    <svg
      viewBox={viewBox}
      className={cn("w-full h-full", className)}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {groups.map((g) => (
        <rect
          key={g.id}
          x={g.x}
          y={g.y}
          width={g.w}
          height={g.h}
          rx={16}
          fill="currentColor"
          fillOpacity={0.04}
          stroke="currentColor"
          strokeOpacity={0.25}
          strokeWidth={3}
          strokeDasharray="10 8"
        />
      ))}
      {lines.map((l) => (
        <line
          key={l.id}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke="currentColor"
          strokeOpacity={0.3}
          strokeWidth={4}
        />
      ))}
      {blocks.map((b) => (
        <rect
          key={b.id}
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          rx={12}
          className={b.colorClass}
          fill="currentColor"
          fillOpacity={0.85}
        />
      ))}
    </svg>
  );
}
