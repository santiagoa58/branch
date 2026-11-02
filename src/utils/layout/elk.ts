import type { ELK, ElkExtendedEdge, ElkNode, LayoutOptions } from "elkjs/lib/elk-api";
import type { Point, Size } from "./geometry";
import { compareIds } from "./hierarchy";
import type { LayoutEdge } from "./projection";
import { countCrossings, sketchRoute } from "./crossings";

export interface LayoutBox extends Size {
  id: string;
  /** Zone index, left to right. Boxes without one (comments) are shelved below the graph. */
  tier: number | undefined;
}

export interface SiblingLayout extends Size {
  positions: Map<string, Point>;
}

/** Horizontal room between columns, on each side of the labels ELK places between them. */
export const LAYER_GAP = 48;
/** Vertical room between nodes of one column; it also separates fanned-out labels. */
const NODE_GAP = 64;
const SHELF_GAP = 80;
const SHELF_ITEM_GAP = 40;
/** Isolated nodes of one zone are packed into a near-square grid once there are this many. */
const PACK_THRESHOLD = 4;

/**
 * ELK layered, left to right.
 * - Partitions keep the zones in tier order across the whole graph, so connected components are
 *   not laid out apart (that would let one component's data sit left of another's services).
 * - Crossing minimization: a layer sweep with a greedy two-sided switch, thorough for diagrams of
 *   ordinary size (see `SMALL_GRAPH`).
 * - One fixed input port on the left and one output port on the right of each node, so ELK
 *   minimizes the crossings of the connections the canvas actually draws.
 * - Orthogonal routing, with labels centered between columns: each gap widens to fit its widest
 *   label, and column and row spacing leaves room for the label pills.
 * - Brandes-Köpf placement keeps long connections straight.
 * - A fixed seed and id-sorted input make it deterministic.
 */
const ELK_LAYOUT_OPTIONS: LayoutOptions = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.randomSeed": "1",
  "elk.padding": "[top=0,left=0,bottom=0,right=0]",
  "elk.partitioning.activate": "true",
  "elk.separateConnectedComponents": "false",
  "elk.edgeRouting": "ORTHOGONAL",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.crossingMinimization.greedySwitch.type": "TWO_SIDED",
  "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
  "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
  "elk.layered.spacing.nodeNodeBetweenLayers": String(LAYER_GAP),
  "elk.layered.spacing.edgeNodeBetweenLayers": "24",
  "elk.layered.spacing.edgeEdgeBetweenLayers": "16",
  "elk.spacing.nodeNode": String(NODE_GAP),
  "elk.spacing.edgeNode": "24",
  "elk.spacing.edgeEdge": "16",
  "elk.spacing.edgeLabel": "8",
  "elk.edgeLabels.placement": "CENTER",
};

/** Up to this many nodes plus connections, layout is thorough and tries every variant. */
const SMALL_GRAPH = 80;
const THOROUGH = { "elk.layered.thoroughness": "28" };
const QUICK = { "elk.layered.thoroughness": "7" };

/** Alternatives tried in order; see `layoutGraph`. */
const LAYOUT_VARIANTS: LayoutOptions[] = [
  {},
  { "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES" },
  { "elk.randomSeed": "7" },
  { "elk.layered.layering.strategy": "COFFMAN_GRAHAM" },
];

let engine: Promise<ELK> | undefined;

/** ELK is large, so it loads on first use; the bundled build runs in browsers and Node alike. */
function loadEngine(): Promise<ELK> {
  engine ??= import("elkjs/lib/elk.bundled.js").then(
    ({ default: Elk }) => new Elk(),
    (error: unknown) => {
      engine = undefined;
      throw error;
    },
  );
  return engine;
}

/**
 * Invisible edges that chain a zone's isolated nodes into rows, so many unconnected nodes form a
 * grid inside their zone instead of one tall column.
 */
function packingEdges(boxes: LayoutBox[], edges: LayoutEdge[]): LayoutEdge[] {
  const connected = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  const isolated = new Map<number, LayoutBox[]>();
  for (const box of boxes) {
    if (box.tier !== undefined && !connected.has(box.id)) {
      isolated.set(box.tier, [...(isolated.get(box.tier) ?? []), box]);
    }
  }
  const chains: LayoutEdge[] = [];
  for (const group of isolated.values()) {
    if (group.length < PACK_THRESHOLD) {
      continue;
    }
    const perRow = Math.ceil(group.length / Math.ceil(Math.sqrt(group.length)));
    group.forEach((box, index) => {
      const next = group[index + 1];
      if (next && (index + 1) % perRow !== 0) {
        chains.push({ source: box.id, target: next.id });
      }
    });
  }
  return chains;
}

function elkGraph(boxes: LayoutBox[], edges: LayoutEdge[], variant: LayoutOptions): ElkNode {
  // ELK sees index-based ids, so any node id is safe. Every node has one input port on its left
  // and one output port on its right, like the single side handles the canvas draws.
  const ids = new Map(boxes.map((box, position) => [box.id, `n${position}`]));
  const port = (id: string, side: "in" | "out") => `${ids.get(id)!}.${side}`;
  return {
    id: "root",
    layoutOptions: { ...ELK_LAYOUT_OPTIONS, ...variant },
    children: boxes.map((box) => ({
      id: ids.get(box.id)!,
      width: box.width,
      height: box.height,
      layoutOptions: {
        "elk.partitioning.partition": String(box.tier),
        "elk.portConstraints": "FIXED_SIDE",
        "elk.portAlignment.default": "CENTER",
      },
      ports: [
        { id: port(box.id, "in"), layoutOptions: { "elk.port.side": "WEST" } },
        { id: port(box.id, "out"), layoutOptions: { "elk.port.side": "EAST" } },
      ],
    })),
    edges: [...edges, ...packingEdges(boxes, edges)].map((edge, position): ElkExtendedEdge => ({
      id: `e${position}`,
      sources: [port(edge.source, "out")],
      targets: [port(edge.target, "in")],
      ...(edge.label ? { labels: [{ text: "", ...edge.label }] } : {}),
    })),
  };
}

function crossingsOf(layout: SiblingLayout, boxes: LayoutBox[], edges: LayoutEdge[]): number {
  const rects = new Map(boxes.map((box) => [box.id, { ...layout.positions.get(box.id)!, ...box }]));
  return countCrossings(
    edges.map((edge) => sketchRoute(rects.get(edge.source)!, rects.get(edge.target)!)),
  );
}

/**
 * ELK's crossing minimization counts crossings between its own routes, while the canvas routes
 * each connection itself. For a diagram of ordinary size each variant is laid out and the one
 * whose sketched routes cross least wins, the first on a tie, so the choice stays deterministic.
 * A large diagram gets one quicker pass, so layout stays well under a second.
 */
async function layoutGraph(boxes: LayoutBox[], edges: LayoutEdge[]): Promise<SiblingLayout> {
  if (boxes.length === 0) {
    return { positions: new Map(), width: 0, height: 0 };
  }
  const elk = await loadEngine();
  let best: { layout: SiblingLayout; crossings: number } | undefined;
  const small = boxes.length + edges.length <= SMALL_GRAPH;
  for (const variant of small ? LAYOUT_VARIANTS : LAYOUT_VARIANTS.slice(0, 1)) {
    // oxlint-disable-next-line no-await-in-loop -- one ELK engine runs one layout at a time
    const result = await elk.layout(
      elkGraph(boxes, edges, { ...(small ? THOROUGH : QUICK), ...variant }),
    );
    const layout = siblingLayout(boxes, result.children ?? []);
    const crossings = crossingsOf(layout, boxes, edges);
    if (!best || crossings < best.crossings) {
      best = { layout, crossings };
    }
    if (crossings === 0) {
      break;
    }
  }
  return best!.layout;
}

function siblingLayout(boxes: LayoutBox[], children: ElkNode[]): SiblingLayout {
  // Labels may sit above the topmost node; the content box starts at the nodes.
  const left = Math.min(...children.map((child) => child.x ?? 0));
  const top = Math.min(...children.map((child) => child.y ?? 0));
  const positions = new Map<string, Point>();
  let width = 0;
  let height = 0;
  for (const child of children) {
    // Whole pixels keep stored positions tidy; flooring never pushes a node past its container.
    const position = {
      x: Math.floor((child.x ?? 0) - left),
      y: Math.floor((child.y ?? 0) - top),
    };
    positions.set(boxes[Number(child.id.slice(1))]!.id, position);
    width = Math.max(width, position.x + (child.width ?? 0));
    height = Math.max(height, position.y + (child.height ?? 0));
  }
  return { positions, width: Math.ceil(width), height: Math.ceil(height) };
}

/** Comments are not part of any zone: they keep their size on a shelf under the graph. */
function shelve(layout: SiblingLayout, comments: LayoutBox[]): SiblingLayout {
  if (comments.length === 0) {
    return layout;
  }
  const positions = new Map(layout.positions);
  const rowWidth = Math.max(layout.width, ...comments.map((comment) => comment.width));
  let x = 0;
  let y = layout.positions.size > 0 ? layout.height + SHELF_GAP : 0;
  let rowHeight = 0;
  let width = layout.width;
  for (const comment of comments) {
    if (x > 0 && x + comment.width > rowWidth) {
      x = 0;
      y += rowHeight + SHELF_ITEM_GAP;
      rowHeight = 0;
    }
    positions.set(comment.id, { x, y });
    width = Math.max(width, x + comment.width);
    rowHeight = Math.max(rowHeight, comment.height);
    x += comment.width + SHELF_ITEM_GAP;
  }
  return { positions, width: Math.ceil(width), height: Math.ceil(y + rowHeight) };
}

/** Lay out one container's direct children. Positions are relative to its content box. */
export async function layoutSiblings(
  boxes: LayoutBox[],
  edges: LayoutEdge[],
): Promise<SiblingLayout> {
  const sorted = [...boxes].sort((a, b) => compareIds(a.id, b.id));
  const zoned = sorted.filter((box) => box.tier !== undefined);
  const ids = new Set(zoned.map((box) => box.id));
  const layout = await layoutGraph(
    zoned,
    edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
  );
  return shelve(
    layout,
    sorted.filter((box) => box.tier === undefined),
  );
}
