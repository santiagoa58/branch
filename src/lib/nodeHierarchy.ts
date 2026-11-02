interface HierarchyNode {
  id: string;
  /** Only a string names a parent; any other value is treated as no parent. */
  parentId?: unknown;
}

type UntrustedNode = Record<string, unknown> & { id: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUntrustedNode(value: unknown): value is UntrustedNode {
  return isRecord(value) && typeof value["id"] === "string";
}

/** Index of each node id's first occurrence, and a lookup from a node's index to its parent's. */
function parentIndexes(nodes: readonly HierarchyNode[]) {
  const indexById = new Map<string, number>();
  nodes.forEach((node, index) => {
    if (!indexById.has(node.id)) {
      indexById.set(node.id, index);
    }
  });
  return {
    has: (id: string) => indexById.has(id),
    parentOf: (index: number): number | undefined => {
      const parentId = nodes[index]?.parentId;
      return typeof parentId === "string" ? indexById.get(parentId) : undefined;
    },
  };
}

/**
 * React Flow requires every parent before its children. This stable reorder pulls a parent (and its
 * own ancestors) forward to just before the first descendant listed ahead of it; everything else
 * keeps its order, so an array that is already parent-first comes back in the same order. Missing
 * parents and parent cycles are left in place for the caller to resolve.
 */
export function orderParentsFirst<T extends HierarchyNode>(nodes: readonly T[]): T[] {
  const { parentOf } = parentIndexes(nodes);
  const placed = new Set<number>();
  const ordered: T[] = [];
  nodes.forEach((_node, start) => {
    // Walk up to the highest ancestor not placed yet, then place that chain top-down.
    const chain: number[] = [];
    for (
      let index: number | undefined = start;
      index !== undefined && !placed.has(index) && !chain.includes(index);
      index = parentOf(index)
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

/**
 * Indexes of nodes whose parent link must go: a parent that does not exist, the node itself, or a
 * link that closes a cycle. A cycle is broken at its member listed first, so the result does not
 * depend on where the walk starts.
 */
function brokenParentLinks(nodes: readonly HierarchyNode[]): Set<number> {
  const { has, parentOf } = parentIndexes(nodes);
  const broken = new Set<number>();
  nodes.forEach((node, index) => {
    const { parentId } = node;
    if (typeof parentId === "string" && (parentId === node.id || !has(parentId))) {
      broken.add(index);
    }
  });

  // Each node has at most one parent, so a walk up from any node meets at most one cycle.
  const walked = new Set<number>();
  nodes.forEach((_node, start) => {
    const path: number[] = [];
    let index: number | undefined = start;
    while (index !== undefined && !walked.has(index) && !path.includes(index)) {
      path.push(index);
      index = broken.has(index) ? undefined : parentOf(index);
    }
    if (index !== undefined && path.includes(index)) {
      broken.add(Math.min(...path.slice(path.indexOf(index))));
    }
    path.forEach((visited) => walked.add(visited));
  });
  return broken;
}

/** The node as a top-level node at its stored position; a parent's offset is unknown. */
function detachFromParent(node: UntrustedNode): UntrustedNode {
  const detached = { ...node };
  delete detached["parentId"];
  if (detached["extent"] === "parent") {
    delete detached["extent"];
  }
  const data = node["data"];
  // The data copy of the link goes with it, as when a node is moved out of a group in the editor.
  if (isRecord(data) && data["parentId"] === node["parentId"]) {
    const detachedData = { ...data };
    delete detachedData["parentId"];
    detached["data"] = detachedData;
  }
  return detached;
}

/**
 * Repairs an untrusted document's group hierarchy before validation, so a document saved with a
 * broken hierarchy (for example by the old import merge, which renamed groups but not their
 * children's links) still opens. Links to a missing parent, self links and cycles are detached,
 * then parents move ahead of their children. A well-formed document comes back as the same value,
 * anything that is not a list of nodes with ids is left for validation to reject, and the input is
 * never mutated.
 */
export function repairNodeHierarchy(value: unknown): unknown {
  if (!isRecord(value) || !Array.isArray(value["nodes"])) {
    return value;
  }
  const nodes: unknown[] = value["nodes"];
  if (!nodes.every(isUntrustedNode)) {
    return value;
  }
  const broken = brokenParentLinks(nodes);
  const linked = nodes.map((node, index) => (broken.has(index) ? detachFromParent(node) : node));
  const ordered = orderParentsFirst(linked);
  if (broken.size === 0 && ordered.every((node, index) => node === nodes[index])) {
    return value;
  }
  return { ...value, nodes: ordered };
}
