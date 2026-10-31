import dagre from "@dagrejs/dagre";
import type { Point, Size } from "./geometry";
import { compareIds } from "./hierarchy";
import type { LayoutEdge } from "./projection";

interface LayoutBox extends Size {
  id: string;
}

interface Component extends Size {
  id: string;
  positions: Map<string, Point>;
}

export interface SiblingLayout extends Size {
  positions: Map<string, Point>;
}

const NODE_GAP = 56;
// Columns are farther apart than rows so connection labels fit between them.
export const RANK_GAP = 140;
const COMPONENT_GAP = 80;

/** Separate weak components before ranking so isolated nodes do not form a giant rank. */
function connectedComponents(boxes: LayoutBox[], edges: LayoutEdge[]): LayoutBox[][] {
  const byId = new Map(boxes.map((box) => [box.id, box]));
  const neighbors = new Map(boxes.map((box) => [box.id, new Set<string>()]));
  for (const { source, target } of edges) {
    neighbors.get(source)!.add(target);
    neighbors.get(target)!.add(source);
  }
  const seen = new Set<string>();
  const components: LayoutBox[][] = [];
  for (const box of boxes) {
    if (seen.has(box.id)) {
      continue;
    }
    const component: LayoutBox[] = [];
    const stack = [box.id];
    seen.add(box.id);
    while (stack.length > 0) {
      const id = stack.pop()!;
      component.push(byId.get(id)!);
      for (const neighbor of neighbors.get(id)!) {
        if (!seen.has(neighbor)) {
          seen.add(neighbor);
          stack.push(neighbor);
        }
      }
    }
    components.push(component.sort((a, b) => compareIds(a.id, b.id)));
  }
  return components;
}

function rankComponent(boxes: LayoutBox[], edges: LayoutEdge[]): Component {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "LR", ranksep: RANK_GAP, nodesep: NODE_GAP, marginx: 0, marginy: 0 });
  for (const box of boxes) {
    graph.setNode(box.id, { width: box.width, height: box.height });
  }
  for (const { source, target } of edges) {
    graph.setEdge(source, target);
  }
  dagre.layout(graph);

  const positions = new Map<string, Point>();
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const box of boxes) {
    const center = graph.node(box.id);
    const x = center.x - box.width / 2;
    const y = center.y - box.height / 2;
    positions.set(box.id, { x, y });
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x + box.width);
    bottom = Math.max(bottom, y + box.height);
  }
  for (const [id, position] of positions) {
    positions.set(id, { x: position.x - left, y: position.y - top });
  }
  return { id: boxes[0]!.id, positions, width: right - left, height: bottom - top };
}

/** Deterministic height-sorted shelf packing with an area-based, near-square target. */
function packComponents(components: Component[]): SiblingLayout {
  const sorted = [...components].sort(
    (a, b) => b.height - a.height || b.width - a.width || compareIds(a.id, b.id),
  );
  const area = sorted.reduce(
    (sum, box) => sum + (box.width + COMPONENT_GAP) * (box.height + COMPONENT_GAP),
    0,
  );
  const targetWidth = Math.max(Math.sqrt(area), ...sorted.map((component) => component.width));
  const positions = new Map<string, Point>();
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let width = 0;
  let height = 0;
  for (const component of sorted) {
    if (x > 0 && x + component.width > targetWidth) {
      x = 0;
      y += rowHeight + COMPONENT_GAP;
      rowHeight = 0;
    }
    for (const [id, position] of component.positions) {
      positions.set(id, { x: x + position.x, y: y + position.y });
    }
    width = Math.max(width, x + component.width);
    height = Math.max(height, y + component.height);
    rowHeight = Math.max(rowHeight, component.height);
    x += component.width + COMPONENT_GAP;
  }
  return { positions, width, height };
}

export function layoutSiblings(boxes: LayoutBox[], edges: LayoutEdge[]): SiblingLayout {
  if (boxes.length === 0) {
    return { positions: new Map(), width: 0, height: 0 };
  }
  const components = connectedComponents(boxes, edges);
  const componentOf = new Map<string, number>();
  components.forEach((component, index) => {
    for (const box of component) {
      componentOf.set(box.id, index);
    }
  });
  const componentEdges = components.map((): LayoutEdge[] => []);
  for (const edge of edges) {
    componentEdges[componentOf.get(edge.source)!]!.push(edge);
  }
  return packComponents(
    components.map((component, index) => rankComponent(component, componentEdges[index]!)),
  );
}
