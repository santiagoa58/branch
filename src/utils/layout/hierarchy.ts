import type { Node } from "@xyflow/react";

export interface Hierarchy {
  byId: Map<string, Node>;
  children: Map<string | undefined, Node[]>;
  paths: Map<string, string[]>;
  preorder: Node[];
}

export function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Build an internal forest without modifying stored parent IDs. IDs must be unique. */
export function buildHierarchy(nodes: Node[]): Hierarchy {
  const sorted = [...nodes].sort((a, b) => compareIds(a.id, b.id));
  const byId = new Map(sorted.map((node) => [node.id, node]));
  const parents = new Map(
    sorted.map((node) => [
      node.id,
      node.parentId !== node.id && byId.has(node.parentId ?? "") ? node.parentId : undefined,
    ]),
  );

  // Invalid parent cycles cannot have a parent-first ordering. Break one link only
  // in this internal forest so every node still gets laid out and emitted once.
  const visited = new Set<string>();
  for (const node of sorted) {
    const path = new Set<string>();
    let current: string | undefined = node.id;
    while (current !== undefined && !visited.has(current)) {
      if (path.has(current)) {
        parents.set(current, undefined);
        break;
      }
      path.add(current);
      current = parents.get(current);
    }
    for (const id of path) {
      visited.add(id);
    }
  }

  const children = new Map<string | undefined, Node[]>();
  for (const node of sorted) {
    const parent = parents.get(node.id);
    const siblings = children.get(parent) ?? [];
    siblings.push(node);
    children.set(parent, siblings);
  }

  const paths = new Map<string, string[]>();
  const preorder: Node[] = [];
  const stack = [...(children.get(undefined) ?? [])].reverse();
  while (stack.length > 0) {
    const node = stack.pop()!;
    preorder.push(node);
    const parent = parents.get(node.id);
    paths.set(node.id, [...(parent === undefined ? [] : paths.get(parent)!), node.id]);
    const descendants = children.get(node.id) ?? [];
    for (let index = descendants.length - 1; index >= 0; index -= 1) {
      stack.push(descendants[index]!);
    }
  }
  return { byId, children, paths, preorder };
}
