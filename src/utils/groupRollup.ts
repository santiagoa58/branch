import type { Node, Edge } from "@xyflow/react";
import type { RollupEdgeData } from "@/types";

/**
 * Group collapse / edge roll-up derivation.
 *
 * Pure functions that compute the DISPLAY representation of the diagram from
 * the stored nodes/edges. Stored state is never mutated: children of collapsed
 * groups are marked `hidden`, edges fully inside a collapsed group are hidden,
 * and edges crossing a collapsed group's boundary are replaced by synthetic
 * aggregated "rollup" edges between the visible representatives.
 *
 * Rollup edges are render-only: they never enter the store, undo/redo history,
 * persistence, or simulation (graph traversal runs on the real edges).
 */

/** Prefix for synthetic rolled-up edge ids (kept out of the store). */
export const ROLLUP_EDGE_PREFIX = "rollup__";

/**
 * Display size of a collapsed group's compact card. The stored style keeps the
 * expanded dimensions so they're restored on expand.
 */
export const COLLAPSED_GROUP_WIDTH = 240;
export const COLLAPSED_GROUP_HEIGHT = 190;

export function isRollupEdgeId(id: string): boolean {
  return id.startsWith(ROLLUP_EDGE_PREFIX);
}

function isCollapsedGroup(node: Node | undefined): boolean {
  return node?.type === "group" && node.data?.["collapsed"] === true;
}

/**
 * The node that visually stands in for `nodeId`: the OUTERMOST collapsed
 * ancestor group, or the node itself when no ancestor is collapsed. Nested
 * collapsed groups therefore roll all the way up to the highest collapsed one.
 */
export function getVisibleRepresentative(nodeId: string, nodeById: Map<string, Node>): string {
  let rep = nodeId;
  let current = nodeById.get(nodeId);
  while (current?.parentId) {
    const parent = nodeById.get(current.parentId);
    if (!parent) {
      break;
    }
    if (isCollapsedGroup(parent)) {
      rep = parent.id;
    }
    current = parent;
  }
  return rep;
}

/** Absolute canvas position (child positions are parent-relative). */
function absolutePosition(node: Node, nodeById: Map<string, Node>): { x: number; y: number } {
  let x = node.position.x;
  let y = node.position.y;
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
}

interface RollupAccumulator {
  source: string;
  target: string;
  forward: number;
  reverse: number;
  edgeIds: string[];
  protocols: Set<string>;
}

export interface DisplayGraph {
  displayNodes: Node[];
  displayEdges: Edge[];
}

/**
 * Derive the display graph. Object identity is preserved for untouched
 * nodes/edges so React Flow re-renders only what actually changed.
 */
export function applyGroupCollapse(nodes: Node[], edges: Edge[]): DisplayGraph {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Fast path — nothing collapsed: just clear stale hidden flags (older
  // versions of toggleGroupCollapse persisted `hidden` on children).
  if (!nodes.some((n) => isCollapsedGroup(n))) {
    return {
      displayNodes: nodes.map((n) => (n.hidden ? { ...n, hidden: false } : n)),
      displayEdges: edges.map((e) => (e.hidden ? { ...e, hidden: false } : e)),
    };
  }

  const repCache = new Map<string, string>();
  const repOf = (id: string): string => {
    let rep = repCache.get(id);
    if (rep === undefined) {
      rep = getVisibleRepresentative(id, nodeById);
      repCache.set(id, rep);
    }
    return rep;
  };

  const displayNodes = nodes.map((n) => {
    const hidden = repOf(n.id) !== n.id;
    if (!hidden && isCollapsedGroup(n)) {
      // Visible collapsed group: shrink to the compact card size. The stored
      // node keeps its expanded style, so expanding restores the footprint.
      const nodeWithoutDimensions = { ...n };
      delete nodeWithoutDimensions.width;
      delete nodeWithoutDimensions.height;
      return {
        ...nodeWithoutDimensions,
        hidden: false,
        style: { ...n.style, width: COLLAPSED_GROUP_WIDTH, height: COLLAPSED_GROUP_HEIGHT },
      };
    }
    return (n.hidden ?? false) === hidden ? n : { ...n, hidden };
  });

  const rollups = new Map<string, RollupAccumulator>();
  const displayEdges: Edge[] = edges.map((edge) => {
    const repS = repOf(edge.source);
    const repT = repOf(edge.target);

    // Both endpoints visible — show the real edge as-is.
    if (repS === edge.source && repT === edge.target) {
      return edge.hidden ? { ...edge, hidden: false } : edge;
    }

    // Boundary edge — aggregate it under the unordered representative pair.
    // (repS === repT means the edge is fully inside one collapsed group: only hide.)
    if (repS !== repT) {
      const key = repS < repT ? `${repS}__${repT}` : `${repT}__${repS}`;
      let agg = rollups.get(key);
      if (!agg) {
        agg = {
          source: repS,
          target: repT,
          forward: 0,
          reverse: 0,
          edgeIds: [],
          protocols: new Set(),
        };
        rollups.set(key, agg);
      }
      const data = edge.data;
      if (repS === agg.source) {
        agg.forward += 1;
      } else {
        agg.reverse += 1;
      }
      if (data?.["bidirectional"] === true) {
        if (repS === agg.source) {
          agg.reverse += 1;
        } else {
          agg.forward += 1;
        }
      }
      agg.edgeIds.push(edge.id);
      const protocol = data?.["protocol"];
      if (typeof protocol === "string") {
        agg.protocols.add(protocol);
      }
    }

    return edge.hidden ? edge : { ...edge, hidden: true };
  });

  for (const [key, agg] of rollups) {
    const sourceNode = nodeById.get(agg.source);
    const targetNode = nodeById.get(agg.target);
    if (!sourceNode || !targetNode) {
      continue;
    }

    // Pick handles by dominant axis so the rollup edge attaches sensibly: the default
    // right-to-left ports for mostly-horizontal pairs, bottom-to-top otherwise.
    const sPos = absolutePosition(sourceNode, nodeById);
    const tPos = absolutePosition(targetNode, nodeById);
    const dx = tPos.x - sPos.x;
    const dy = tPos.y - sPos.y;
    const horizontal = Math.abs(dx) > Math.abs(dy) && dx > 0;

    const data: RollupEdgeData = {
      count: agg.edgeIds.length,
      edgeIds: agg.edgeIds,
      protocols: Array.from(agg.protocols),
      bidirectional: agg.forward > 0 && agg.reverse > 0,
      collapsedGroupIds: [agg.source, agg.target].filter((id) =>
        isCollapsedGroup(nodeById.get(id)),
      ),
    };

    displayEdges.push({
      id: `${ROLLUP_EDGE_PREFIX}${key}`,
      source: agg.source,
      target: agg.target,
      ...(horizontal ? {} : { sourceHandle: "bottom", targetHandle: "top" }),
      type: "rollup",
      selectable: false,
      deletable: false,
      data,
    });
  }

  return { displayNodes, displayEdges };
}
