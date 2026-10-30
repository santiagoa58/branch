import { useMemo } from "react";
import { Node } from "@xyflow/react";
import { ArchitectureNodeType, DiagramData } from "@/types";
import { cn } from "@/lib/utils";
import { NODE_TYPES_CONFIG } from "@/constants";

/**
 * Schematic SVG preview of a template's DiagramData: group outlines, colored
 * node blocks and edge lines. Generated from the data itself, so previews
 * never go stale when a template changes.
 */

// Approximate rendered footprint of an architecture node on the canvas.
const NODE_W = 150;
const NODE_H = 90;

interface TemplatePreviewProps {
  data: DiagramData;
  className?: string;
}

export function TemplatePreview({ data, className }: TemplatePreviewProps) {
  const { groups, blocks, lines, viewBox } = useMemo(() => {
    const nodes = data.nodes as Node[];
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    const absPos = (node: Node): { x: number; y: number } => {
      let { x, y } = node.position;
      let current = node;
      while (current.parentId) {
        const parent = nodeById.get(current.parentId);
        if (!parent) {
          break;
        }
        x += parent.position.x;
        y += parent.position.y;
        current = parent;
      }
      return { x, y };
    };

    const bounds = (node: Node) => {
      const pos = absPos(node);
      const w = node.type === "group" ? (node.style?.width as number) || 300 : NODE_W;
      const h = node.type === "group" ? (node.style?.height as number) || 250 : NODE_H;
      return { ...pos, w, h };
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
  }, [data]);

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
