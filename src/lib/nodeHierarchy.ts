interface HierarchyNode {
  id: string;
  parentId?: string | undefined;
}

/**
 * React Flow requires every parent before its children. This stable reorder pulls a parent (and its
 * own ancestors) forward to just before the first descendant listed ahead of it; everything else
 * keeps its order, so an array that is already parent-first comes back in the same order. Missing
 * parents and parent cycles are left in place for the caller to resolve.
 */
export function orderParentsFirst<T extends HierarchyNode>(nodes: readonly T[]): T[] {
  const indexById = new Map<string, number>();
  nodes.forEach((node, index) => {
    if (!indexById.has(node.id)) {
      indexById.set(node.id, index);
    }
  });
  const parentIndex = (index: number): number | undefined => {
    const parentId = nodes[index]?.parentId;
    return parentId === undefined ? undefined : indexById.get(parentId);
  };

  const placed = new Set<number>();
  const ordered: T[] = [];
  nodes.forEach((_node, start) => {
    // Walk up to the highest ancestor not placed yet, then place that chain top-down.
    const chain: number[] = [];
    for (
      let index: number | undefined = start;
      index !== undefined && !placed.has(index) && !chain.includes(index);
      index = parentIndex(index)
    ) {
      chain.push(index);
    }
    for (const index of chain.reverse()) {
      const node = nodes[index];
      if (node) {
        placed.add(index);
        ordered.push(node);
      }
    }
  });
  return ordered;
}
