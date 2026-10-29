import dagre from "@dagrejs/dagre";
import { Node, Edge } from "@xyflow/react";

export type LayoutDirection = "TB" | "LR";

interface LayoutOptions {
  direction?: LayoutDirection;
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
}

/**
 * Apply Dagre layout algorithm to nodes and edges
 * @param nodes - Array of React Flow nodes
 * @param edges - Array of React Flow edges
 * @param options - Layout configuration options
 * @returns Array of nodes with updated positions
 */
export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {},
): Node[] {
  const {
    direction = "TB",
    nodeWidth = 180,
    nodeHeight = 100,
    rankSep = 100,
    nodeSep = 80,
  } = options;

  // Create a new directed graph
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Configure graph layout
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: rankSep,
    nodesep: nodeSep,
  });

  // Separate nodes into groups and non-groups
  const groupNodes = nodes.filter((node) => node.type === "group");
  const regularNodes = nodes.filter((node) => node.type !== "group");

  // Further separate regular nodes by parent
  const rootNodes = regularNodes.filter((node) => !node.parentId);
  const childNodes = regularNodes.filter((node) => node.parentId);

  // Map to store group IDs and their children
  const groupChildrenMap = new Map<string, Node[]>();

  // Group child nodes by their parent group
  childNodes.forEach((node) => {
    if (node.parentId) {
      if (!groupChildrenMap.has(node.parentId)) {
        groupChildrenMap.set(node.parentId, []);
      }
      groupChildrenMap.get(node.parentId)!.push(node);
    }
  });

  // === LAYOUT ROOT-LEVEL NODES (including groups) ===
  const rootLevelNodes = [...groupNodes, ...rootNodes];

  // Add root-level nodes to the graph
  rootLevelNodes.forEach((node) => {
    const width = node.type === "group" ? (node.style?.width as number) || 400 : nodeWidth;
    const height = node.type === "group" ? (node.style?.height as number) || 300 : nodeHeight;

    dagreGraph.setNode(node.id, { width, height });
  });

  // Add edges between root-level nodes only
  edges.forEach((edge) => {
    // Only add edges where both source and target are root-level nodes
    const sourceIsRoot = rootLevelNodes.some((n) => n.id === edge.source);
    const targetIsRoot = rootLevelNodes.some((n) => n.id === edge.target);

    if (sourceIsRoot && targetIsRoot) {
      dagreGraph.setEdge(edge.source, edge.target);
    }
  });

  // Run the layout algorithm
  dagre.layout(dagreGraph);

  // Apply calculated positions to root-level nodes
  const layoutedRootNodes = rootLevelNodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);

    // Dagre centers nodes, so adjust for top-left positioning
    const width = node.type === "group" ? (node.style?.width as number) || 400 : nodeWidth;
    const height = node.type === "group" ? (node.style?.height as number) || 300 : nodeHeight;

    return {
      ...node,
      position: {
        x: nodeWithPosition.x - width / 2,
        y: nodeWithPosition.y - height / 2,
      },
    };
  });

  // === LAYOUT CHILDREN WITHIN GROUPS ===
  const layoutedChildNodes: Node[] = [];

  groupNodes.forEach((groupNode) => {
    const children = groupChildrenMap.get(groupNode.id) || [];

    if (children.length === 0) {
      return; // No children to layout
    }

    // Create a sub-graph for this group's children
    const childGraph = new dagre.graphlib.Graph();
    childGraph.setDefaultEdgeLabel(() => ({}));
    childGraph.setGraph({
      rankdir: direction,
      ranksep: 60,
      nodesep: 50,
    });

    // Add child nodes to the sub-graph
    children.forEach((child) => {
      childGraph.setNode(child.id, {
        width: nodeWidth,
        height: nodeHeight,
      });
    });

    // Add edges between children
    edges.forEach((edge) => {
      const sourceIsChild = children.some((n) => n.id === edge.source);
      const targetIsChild = children.some((n) => n.id === edge.target);

      if (sourceIsChild && targetIsChild) {
        childGraph.setEdge(edge.source, edge.target);
      }
    });

    // Layout children
    dagre.layout(childGraph);

    // Apply positions relative to parent group with padding
    const padding = 40;

    children.forEach((child) => {
      const nodeWithPosition = childGraph.node(child.id);

      layoutedChildNodes.push({
        ...child,
        position: {
          x: nodeWithPosition.x - nodeWidth / 2 + padding,
          y: nodeWithPosition.y - nodeHeight / 2 + padding,
        },
        parentId: groupNode.id,
        extent: "parent" as const,
      });
    });
  });

  // Combine all layouted nodes
  return [...layoutedRootNodes, ...layoutedChildNodes];
}
