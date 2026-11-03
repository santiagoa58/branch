import type { Edge } from "@xyflow/react";
import { edgeLabelText } from "../edgeLabelText";
import type { Size } from "./geometry";
import { compareIds, type Hierarchy } from "./hierarchy";

export interface LayoutEdge {
  source: string;
  target: string;
  /** Room to keep for the widest label drawn on the connections this edge stands for. */
  label?: Size;
}

const LABEL_CHAR_WIDTH = 6.2;
const LABEL_PADDING = 20;
const LABEL_HEIGHT = 22;

/** Estimated footprint of the label pill the canvas draws (10px text, rounded padding). */
function labelSize(edge: Edge): Size | undefined {
  const text = edgeLabelText(edge.data);
  return text
    ? { width: Math.ceil(text.length * LABEL_CHAR_WIDTH) + LABEL_PADDING, height: LABEL_HEIGHT }
    : undefined;
}

/**
 * The pair of distinct siblings that stand for an edge's endpoints in their lowest common
 * container, or undefined for self, dangling and ancestor-to-descendant edges.
 */
function siblingRepresentatives(
  edge: Edge,
  hierarchy: Hierarchy,
): { parent: string | undefined; source: string; target: string } | undefined {
  const sourcePath = hierarchy.paths.get(edge.source);
  const targetPath = hierarchy.paths.get(edge.target);
  if (!sourcePath || !targetPath || edge.source === edge.target) {
    return undefined;
  }
  let depth = 0;
  while (depth < sourcePath.length && sourcePath[depth] === targetPath[depth]) {
    depth += 1;
  }
  const source = sourcePath[depth];
  const target = targetPath[depth];
  if (source === undefined || target === undefined) {
    return undefined;
  }
  return { parent: depth === 0 ? undefined : sourcePath[depth - 1], source, target };
}

function widest(a: Size | undefined, b: Size | undefined): Size | undefined {
  if (!a || !b) {
    return a ?? b;
  }
  return { width: Math.max(a.width, b.width), height: Math.max(a.height, b.height) };
}

/** Project each real edge at the lowest container where its endpoints are siblings. */
export function projectEdges(
  edges: Edge[],
  hierarchy: Hierarchy,
): Map<string | undefined, LayoutEdge[]> {
  const projected = new Map<string | undefined, Map<string, LayoutEdge>>();
  for (const edge of edges) {
    const pair = siblingRepresentatives(edge, hierarchy);
    if (!pair) {
      continue;
    }
    const siblings = projected.get(pair.parent) ?? new Map<string, LayoutEdge>();
    // Ids may contain any character, so key on the JSON-encoded pair.
    const key = JSON.stringify([pair.source, pair.target]);
    const existing = siblings.get(key);
    const label = widest(existing?.label, labelSize(edge));
    siblings.set(key, {
      source: pair.source,
      target: pair.target,
      ...(label ? { label } : {}),
    });
    projected.set(pair.parent, siblings);
  }

  const result = new Map<string | undefined, LayoutEdge[]>();
  for (const [parent, siblings] of projected) {
    result.set(
      parent,
      [...siblings.values()].sort(
        (a, b) => compareIds(a.source, b.source) || compareIds(a.target, b.target),
      ),
    );
  }
  return result;
}
