import { describe, expect, it } from "vite-plus/test";
import type { Rect, XYPosition } from "@xyflow/react";
import { placeEdgeLabel } from "./edgeLabels";

const label: Rect = { x: -90, y: -10, width: 180, height: 20 };

function overlaps(position: XYPosition, bounds: Rect, obstacle: Rect): boolean {
  return (
    position.x + bounds.x < obstacle.x + obstacle.width &&
    position.x + bounds.x + bounds.width > obstacle.x &&
    position.y + bounds.y < obstacle.y + obstacle.height &&
    position.y + bounds.y + bounds.height > obstacle.y
  );
}

function expectClear(position: XYPosition, bounds: Rect, obstacles: Rect[]) {
  expect(obstacles.filter((obstacle) => overlaps(position, bounds, obstacle))).toEqual([]);
}

describe("edge label placement", () => {
  it("keeps the Bezier midpoint when its entire label is unobstructed", () => {
    const midpoint = { x: 100, y: 150 };
    expect(placeEdgeLabel(midpoint, label, [])).toBe(midpoint);
    expect(placeEdgeLabel(midpoint, label, [{ x: 20, y: 0, width: 160, height: 100 }])).toBe(
      midpoint,
    );
  });

  it("moves a label hidden behind a node without merely drawing it above the node", () => {
    const midpoint = { x: 100, y: 150 };
    const obstacles = [{ x: 20, y: 100, width: 160, height: 100 }];
    const result = placeEdgeLabel(midpoint, label, obstacles);

    expect(result).toEqual({ x: 100, y: 82 });
    expectClear(result, label, obstacles);
  });

  it("checks the full label width even when the anchor is outside a node", () => {
    const midpoint = { x: 0, y: 150 };
    const obstacles = [{ x: 60, y: 100, width: 160, height: 100 }];
    const result = placeEdgeLabel(midpoint, label, obstacles);

    expect(result).not.toEqual(midpoint);
    expectClear(result, label, obstacles);
  });

  it("does not push a label out of one node and into another", () => {
    const obstacles = [
      { x: 20, y: 100, width: 160, height: 100 },
      { x: 20, y: 20, width: 160, height: 60 },
      { x: 20, y: 220, width: 160, height: 60 },
      { x: -170, y: 80, width: 180, height: 160 },
    ];
    const result = placeEdgeLabel({ x: 100, y: 150 }, label, obstacles);

    expect(Number.isFinite(result.x) && Number.isFinite(result.y)).toBe(true);
    expectClear(result, label, obstacles);
    expect(placeEdgeLabel({ x: 100, y: 150 }, label, obstacles)).toEqual(result);
    expect(placeEdgeLabel({ x: 100, y: 150 }, label, [...obstacles].reverse())).toEqual(result);
  });

  it("includes an offset decision badge in the collision bounds", () => {
    const bounds = { x: -10, y: -32, width: 58, height: 42 };
    const midpoint = { x: 0, y: 0 };
    const obstacles = [{ x: 24, y: -30, width: 20, height: 16 }];
    expect(placeEdgeLabel(midpoint, { x: -10, y: -10, width: 20, height: 20 }, obstacles)).toBe(
      midpoint,
    );

    const result = placeEdgeLabel(midpoint, bounds, obstacles);

    expect(result).not.toEqual(midpoint);
    expectClear(result, bounds, obstacles);
  });

  it("finds clear space in a dense diagram with overlapping obstacles", () => {
    const obstacles = Array.from({ length: 400 }, (_, index) => ({
      x: (index % 20) * 10 - 100,
      y: Math.floor(index / 20) * 10 - 100,
      width: 100,
      height: 100,
    }));
    const result = placeEdgeLabel({ x: 0, y: 0 }, label, obstacles);

    expect(Number.isFinite(result.x) && Number.isFinite(result.y)).toBe(true);
    expectClear(result, label, obstacles);
  });

  it("does not mutate node or label geometry", () => {
    const midpoint = Object.freeze({ x: -200, y: -100 });
    const bounds = Object.freeze({ ...label });
    const obstacles = [Object.freeze({ x: -300, y: -150, width: 200, height: 100 })];
    const snapshot = structuredClone(obstacles);

    const result = placeEdgeLabel(midpoint, bounds, obstacles);

    expectClear(result, bounds, obstacles);
    expect(obstacles).toEqual(snapshot);
    expect(midpoint).toEqual({ x: -200, y: -100 });
    expect(bounds).toEqual(label);
  });
});
