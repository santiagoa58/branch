/**
 * Graph traversal utilities for simulation mode.
 * Pure functions — no side effects, no store dependencies.
 */
import type { Node, Edge } from "@xyflow/react";
import type {
  FlowPath,
  BlastRadius,
  SimulationStep,
  BranchStep,
  BranchLevel,
  CascadeLevel,
  PartitionResult,
} from "@/types/simulation";

/**
 * Get all edges connected to a node (as source or target).
 */
export function getConnectedEdges(nodeId: string, edges: Edge[]): Edge[] {
  return edges.filter((e) => e.source === nodeId || e.target === nodeId);
}

/**
 * Get outgoing edges from a node (where node is the source).
 */
export function getOutgoingEdges(nodeId: string, edges: Edge[]): Edge[] {
  return edges.filter((e) => e.source === nodeId);
}

/**
 * Get incoming edges to a node (where node is the target).
 */
export function getIncomingEdges(nodeId: string, edges: Edge[]): Edge[] {
  return edges.filter((e) => e.target === nodeId);
}

/**
 * BFS traversal from a source node, following edge directions.
 * Returns the complete ordered path with all reachable nodes and edges,
 * plus branch-aware BFS levels for parallel path animation.
 */
export function traceFlowPath(_nodes: Node[], edges: Edge[], sourceId: string): FlowPath {
  const visitedNodes = new Set<string>();
  const visitedEdges = new Set<string>();
  const orderedNodeIds: string[] = [];
  const orderedEdgeIds: string[] = [];
  const steps: SimulationStep[] = [];
  const levels: BranchLevel[] = [];

  // BFS frontier-based traversal tracking depth for branch levels
  visitedNodes.add(sourceId);
  orderedNodeIds.push(sourceId);

  let currentFrontier: string[] = [sourceId];
  let depth = 0;

  while (currentFrontier.length > 0) {
    const nextFrontier: string[] = [];
    const levelSteps: BranchStep[] = [];

    for (const currentNodeId of currentFrontier) {
      // Outgoing edges (normal direction)
      const outgoing = getOutgoingEdges(currentNodeId, edges);
      for (const edge of outgoing) {
        if (visitedEdges.has(edge.id)) {
          continue;
        }

        visitedEdges.add(edge.id);
        orderedEdgeIds.push(edge.id);

        const targetId = edge.target;
        const edgeData = edge.data;
        const protocol = edgeData?.["protocol"];
        const latency = edgeData?.["latencyMs"];

        const step: SimulationStep = {
          edgeId: edge.id,
          fromNodeId: currentNodeId,
          toNodeId: targetId,
          ...(typeof protocol === "string" ? { protocol } : {}),
          ...(typeof latency === "number" ? { latencyMs: latency } : {}),
        };
        steps.push(step);

        levelSteps.push({
          ...step,
          branchId: `b-${currentNodeId}-${edge.id}`,
          depth,
        });

        if (!visitedNodes.has(targetId)) {
          visitedNodes.add(targetId);
          orderedNodeIds.push(targetId);
          nextFrontier.push(targetId);
        }
      }

      // Bidirectional edges where this node is the target
      const incoming = getIncomingEdges(currentNodeId, edges);
      for (const edge of incoming) {
        if (visitedEdges.has(edge.id)) {
          continue;
        }

        const edgeData = edge.data;
        const isBidirectional = edgeData?.["bidirectional"] === true;

        if (isBidirectional) {
          visitedEdges.add(edge.id);
          orderedEdgeIds.push(edge.id);

          const sourceNodeId = edge.source;
          const protocol = edgeData?.["protocol"];
          const latency = edgeData?.["latencyMs"];

          const step: SimulationStep = {
            edgeId: edge.id,
            fromNodeId: currentNodeId,
            toNodeId: sourceNodeId,
            ...(typeof protocol === "string" ? { protocol } : {}),
            ...(typeof latency === "number" ? { latencyMs: latency } : {}),
          };
          steps.push(step);

          levelSteps.push({
            ...step,
            branchId: `b-${currentNodeId}-${edge.id}`,
            depth,
          });

          if (!visitedNodes.has(sourceNodeId)) {
            visitedNodes.add(sourceNodeId);
            orderedNodeIds.push(sourceNodeId);
            nextFrontier.push(sourceNodeId);
          }
        }
      }
    }

    if (levelSteps.length > 0) {
      levels.push({ depth, steps: levelSteps });
    }

    currentFrontier = nextFrontier;
    depth++;
  }

  return {
    nodeIds: orderedNodeIds,
    edgeIds: orderedEdgeIds,
    steps,
    levels,
  };
}

/**
 * Given a set of "failed" node IDs, compute the blast radius:
 * which downstream nodes become unreachable and which edges are broken.
 *
 * Uses reverse-reachability: a node is "affected" if ALL paths from any
 * root (node with no incoming edges) to it pass through a failed node.
 *
 * Simplified approach: any node downstream of a failed node is affected,
 * and any edge touching a failed or affected node is broken.
 *
 * Also tracks BFS depth levels for cascade animation (domino effect).
 */
export function computeBlastRadius(
  _nodes: Node[],
  edges: Edge[],
  failedNodeIds: string[],
): BlastRadius {
  const failedSet = new Set(failedNodeIds);
  const affectedNodes = new Set<string>();
  const levels: CascadeLevel[] = [];

  // BFS outward from all failed nodes simultaneously, tracking depth
  let currentFrontier = [...failedNodeIds];
  const visited = new Set<string>(failedNodeIds);
  let depth = 0;

  while (currentFrontier.length > 0) {
    const nextFrontier: string[] = [];
    const levelNodeIds: string[] = [];
    const levelEdgeIds: string[] = [];

    for (const current of currentFrontier) {
      const outgoing = getOutgoingEdges(current, edges);

      for (const edge of outgoing) {
        const targetId = edge.target;
        if (!visited.has(targetId) && !failedSet.has(targetId)) {
          visited.add(targetId);
          affectedNodes.add(targetId);
          nextFrontier.push(targetId);
          levelNodeIds.push(targetId);
          levelEdgeIds.push(edge.id);
        } else if (visited.has(targetId) || failedSet.has(targetId)) {
          // Edge is still broken even if target was already visited
          if (!levelEdgeIds.includes(edge.id)) {
            levelEdgeIds.push(edge.id);
          }
        }
      }
    }

    if (levelNodeIds.length > 0 || levelEdgeIds.length > 0) {
      levels.push({
        depth,
        nodeIds: levelNodeIds,
        edgeIds: levelEdgeIds,
      });
    }

    currentFrontier = nextFrontier;
    depth++;
  }

  // Find broken edges: edges where source or target is failed or affected
  const allImpacted = new Set([...failedNodeIds, ...affectedNodes]);
  const brokenEdges = edges
    .filter((e) => allImpacted.has(e.source) || allImpacted.has(e.target))
    .map((e) => e.id);

  return {
    affectedNodeIds: Array.from(affectedNodes),
    brokenEdgeIds: brokenEdges,
    levels,
  };
}

/**
 * Select random node IDs for chaos failures.
 * Each eligible node has `probability` chance of being selected, up to `maxCount`.
 * Protected nodes and already-failed nodes are excluded.
 */
export function selectRandomTargets(
  nodes: Node[],
  probability: number,
  maxCount: number,
  protectedNodeIds: string[],
  alreadyFailedIds: string[],
): string[] {
  const protectedSet = new Set(protectedNodeIds);
  const failedSet = new Set(alreadyFailedIds);

  // Only consider architecture nodes (not groups/comments)
  const eligible = nodes.filter(
    (n) => n.type === "architecture" && !protectedSet.has(n.id) && !failedSet.has(n.id),
  );

  if (eligible.length === 0) {
    return [];
  }

  const selected: string[] = [];
  // Shuffle for randomness then apply probability filter
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);

  for (const node of shuffled) {
    if (selected.length >= maxCount) {
      break;
    }
    if (Math.random() < probability) {
      selected.push(node.id);
    }
  }

  // Guarantee at least one failure if there are eligible nodes and maxCount > 0
  if (selected.length === 0 && maxCount > 0 && eligible.length > 0) {
    const fallback = shuffled[0];
    if (fallback) {
      selected.push(fallback.id);
    }
  }

  return selected;
}

/**
 * Compute a network partition by selecting random edges to sever,
 * then determining which nodes belong to each disconnected group.
 * Uses Union-Find to identify connected components.
 */
export function computePartition(
  nodes: Node[],
  edges: Edge[],
  protectedNodeIds: string[],
): PartitionResult {
  const archNodes = nodes.filter((n) => n.type === "architecture");
  if (archNodes.length < 2) {
    return { groupA: archNodes.map((n) => n.id), groupB: [], severedEdgeIds: [] };
  }

  // Build adjacency info to find a reasonable cut
  // Strategy: find edges that form a bridge or cut, preferring edges not touching protected nodes
  const protectedSet = new Set(protectedNodeIds);

  // Collect candidate edges (exclude edges between two protected nodes)
  const candidateEdges = edges.filter(
    (e) => !(protectedSet.has(e.source) && protectedSet.has(e.target)),
  );

  if (candidateEdges.length === 0) {
    return { groupA: archNodes.map((n) => n.id), groupB: [], severedEdgeIds: [] };
  }

  // Select ~30-50% of candidate edges to sever (at least 1)
  const severCount = Math.max(1, Math.ceil(candidateEdges.length * (0.3 + Math.random() * 0.2)));
  const shuffledEdges = [...candidateEdges].sort(() => Math.random() - 0.5);
  const severedEdgeIds = shuffledEdges.slice(0, severCount).map((e) => e.id);
  const severedSet = new Set(severedEdgeIds);

  // Union-Find to compute connected components with remaining edges
  const parent = new Map<string, string>();
  const rank = new Map<string, number>();

  function find(x: string): string {
    const currentParent = parent.get(x);
    if (currentParent === undefined) {
      parent.set(x, x);
      rank.set(x, 0);
      return x;
    }
    if (currentParent === x) {
      return x;
    }
    const root = find(currentParent);
    parent.set(x, root);
    return root;
  }

  function union(a: string, b: string) {
    const ra = find(a),
      rb = find(b);
    if (ra === rb) {
      return;
    }
    const rankA = rank.get(ra) ?? 0,
      rankB = rank.get(rb) ?? 0;
    if (rankA < rankB) {
      parent.set(ra, rb);
    } else if (rankA > rankB) {
      parent.set(rb, ra);
    } else {
      parent.set(rb, ra);
      rank.set(ra, rankA + 1);
    }
  }

  // Initialize all nodes
  for (const n of archNodes) {
    find(n.id);
  }

  // Union nodes connected by non-severed edges
  for (const e of edges) {
    if (!severedSet.has(e.id)) {
      union(e.source, e.target);
    }
  }

  // Group nodes by their root
  const groups = new Map<string, string[]>();
  for (const n of archNodes) {
    const root = find(n.id);
    const group = groups.get(root);
    if (group) {
      group.push(n.id);
    } else {
      groups.set(root, [n.id]);
    }
  }

  // Sort groups by size descending — largest is groupA, rest merge into groupB
  const sortedGroups = [...groups.values()].sort((a, b) => b.length - a.length);
  const groupA = sortedGroups[0] || [];
  const groupB = sortedGroups.slice(1).flat();

  // If everything ended up in one group (no actual partition), force a minimal cut
  if (groupB.length === 0 && severedEdgeIds.length > 0) {
    // Just split nodes in half arbitrarily
    const half = Math.ceil(archNodes.length / 2);
    return {
      groupA: archNodes.slice(0, half).map((n) => n.id),
      groupB: archNodes.slice(half).map((n) => n.id),
      severedEdgeIds,
    };
  }

  return { groupA, groupB, severedEdgeIds };
}
