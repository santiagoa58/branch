import type { Edge } from "@xyflow/react";
import { compareIds, type Hierarchy } from "./hierarchy";

export interface LayoutEdge {
  source: string;
  target: string;
}

/** Project each real edge at the lowest container where its endpoints are siblings. */
// oxlint-disable-next-line complexity -- debt: complexity 16; extract branches
export function projectEdges(
  edges: Edge[],
  hierarchy: Hierarchy,
): Map<string | undefined, LayoutEdge[]> {
  const projected = new Map<string | undefined, Map<string, Set<string>>>();
  for (const edge of edges) {
    const sourcePath = hierarchy.paths.get(edge.source);
    const targetPath = hierarchy.paths.get(edge.target);
    if (!sourcePath || !targetPath || edge.source === edge.target) {
      continue;
    }
    let depth = 0;
    while (
      depth < sourcePath.length &&
      depth < targetPath.length &&
      sourcePath[depth] === targetPath[depth]
    ) {
      depth += 1;
    }
    const source = sourcePath[depth];
    const target = targetPath[depth];
    // An ancestor-to-descendant edge has no pair of distinct sibling representatives.
    if (source === undefined || target === undefined) {
      continue;
    }
    const parent = depth === 0 ? undefined : sourcePath[depth - 1];
    const sources = projected.get(parent) ?? new Map<string, Set<string>>();
    const targets = sources.get(source) ?? new Set<string>();
    targets.add(target);
    sources.set(source, targets);
    projected.set(parent, sources);
  }

  const result = new Map<string | undefined, LayoutEdge[]>();
  for (const [parent, sources] of projected) {
    const siblings: LayoutEdge[] = [];
    for (const source of [...sources.keys()].sort(compareIds)) {
      for (const target of [...sources.get(source)!].sort(compareIds)) {
        siblings.push({ source, target });
      }
    }
    result.set(parent, siblings);
  }
  return result;
}
