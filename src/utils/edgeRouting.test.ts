import { describe, expect, it } from "vite-plus/test";
import { Position, type Rect, type XYPosition } from "@xyflow/react";
import { placeEdgeLabels } from "./edgeLabels";
import { routeEdge, routeEdges, routePath, type EdgeEnds } from "./edgeRouting";

function ends(sx: number, sy: number, tx: number, ty: number): EdgeEnds {
  return {
    sourceX: sx,
    sourceY: sy,
    sourcePosition: Position.Right,
    targetX: tx,
    targetY: ty,
    targetPosition: Position.Left,
  };
}

function crossesRect(points: XYPosition[], rect: Rect): boolean {
  return points.slice(1).some((to, index) => {
    const from = points[index]!;
    return (
      Math.max(from.x, to.x) > rect.x &&
      Math.min(from.x, to.x) < rect.x + rect.width &&
      Math.max(from.y, to.y) > rect.y &&
      Math.min(from.y, to.y) < rect.y + rect.height
    );
  });
}

function verticalRunXs(points: XYPosition[]): number[] {
  return points
    .slice(1)
    .flatMap((to, index) => (points[index]!.x === to.x && points[index]!.y !== to.y ? [to.x] : []));
}

describe("routeEdge", () => {
  it("runs straight when the ports line up", () => {
    expect(routeEdge(ends(0, 50, 300, 50), []).points).toEqual([
      { x: 0, y: 50 },
      { x: 300, y: 50 },
    ]);
  });

  it("turns halfway, with the label on the turn", () => {
    const route = routeEdge(ends(0, 0, 240, 160), []);
    expect(route.points).toEqual([
      { x: 0, y: 0 },
      { x: 120, y: 0 },
      { x: 120, y: 160 },
      { x: 240, y: 160 },
    ]);
    expect({ x: route.labelX, y: route.labelY }).toEqual({ x: 120, y: 80 });
  });

  it("turns beside a node that stands halfway instead of running across it", () => {
    const node = { x: 280, y: 60, width: 180, height: 140 };
    const route = routeEdge(ends(0, 0, 800, 300), [node]);
    expect(route.points).toHaveLength(4);
    expect(crossesRect(route.points, node)).toBe(false);
  });

  it("detours along a free row when a column of nodes blocks every single turn", () => {
    const column = [
      { x: 300, y: -200, width: 180, height: 180 },
      { x: 300, y: 20, width: 180, height: 180 },
      { x: 300, y: 240, width: 180, height: 180 },
    ];
    const route = routeEdge(ends(0, 100, 800, 330), column);
    expect(route.points).toHaveLength(6);
    for (const node of column) {
      expect(crossesRect(route.points, node)).toBe(false);
    }
  });

  it("keeps React Flow's smooth step for connections that run backwards or stacked", () => {
    const backward = routeEdge(ends(500, 0, 100, 200), []);
    expect(backward.points[0]).toEqual({ x: 500, y: 0 });
    expect(backward.points.at(-1)).toEqual({ x: 100, y: 200 });
    expect(backward.points.length).toBeGreaterThan(4);
    const stacked = routeEdge(
      { ...ends(50, 100, 50, 300), sourcePosition: Position.Bottom, targetPosition: Position.Top },
      [],
    );
    expect(stacked.points).toEqual([
      { x: 50, y: 100 },
      { x: 50, y: 300 },
    ]);
  });
});

describe("routeEdges", () => {
  it("gives different connections their own lanes in a shared gap", () => {
    const routes = routeEdges(
      [
        { id: "high", ends: ends(0, 0, 400, 300) },
        { id: "low", ends: ends(0, 200, 400, 500) },
      ],
      [],
    );
    const lanes = [...routes.values()].flatMap((route) => verticalRunXs(route.points));
    expect(new Set(lanes).size).toBe(2);
    // The connection that starts higher turns further right, so the two do not cross.
    expect(verticalRunXs(routes.get("high")!.points)[0]).toBeGreaterThan(
      verticalRunXs(routes.get("low")!.points)[0]!,
    );
  });

  it("keeps a shared trunk for connections leaving the same port", () => {
    const routes = routeEdges(
      [
        { id: "a", ends: ends(0, 200, 400, 0) },
        { id: "b", ends: ends(0, 200, 400, 400) },
      ],
      [],
    );
    expect(verticalRunXs(routes.get("a")!.points)).toEqual(verticalRunXs(routes.get("b")!.points));
  });

  it("does not depend on the order of the connections", () => {
    const requests = [
      { id: "c", ends: ends(0, 300, 400, 0) },
      { id: "a", ends: ends(0, 0, 400, 300) },
      { id: "b", ends: ends(0, 100, 400, 500) },
    ];
    expect(routeEdges([...requests].reverse(), [])).toEqual(routeEdges(requests, []));
  });
});

describe("routePath", () => {
  it("rounds each turn and keeps straight runs straight", () => {
    expect(
      routePath([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 200, y: 100 },
      ]),
    ).toBe("M0 0L92 0Q100 0 100 8L100 92Q100 100 108 100L200 100");
    expect(routePath([])).toBe("");
  });
});

describe("placeEdgeLabels", () => {
  it("keeps labels that want the same spot from stacking, whatever the order", () => {
    const box = { x: -40, y: -10, width: 80, height: 20 };
    const requests = ["b", "a", "c"].map((id) => ({ id, anchor: { x: 100, y: 100 }, box }));
    const placed = placeEdgeLabels(requests, []);
    expect(placed.get("a")).toEqual({ x: 100, y: 100 });
    const rects = [...placed.values()].map((point) => ({ x: point.x - 40, y: point.y - 10 }));
    for (const [index, first] of rects.entries()) {
      for (const second of rects.slice(index + 1)) {
        const apart = Math.abs(first.x - second.x) >= 80 || Math.abs(first.y - second.y) >= 20;
        expect(apart).toBe(true);
      }
    }
    expect(placeEdgeLabels([...requests].reverse(), [])).toEqual(placed);
  });
});
