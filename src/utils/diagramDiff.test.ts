import { describe, expect, it } from "vite-plus/test";
import type { Edge, Node } from "@xyflow/react";
import { diffDiagrams } from "./diagramDiff";

function node(id: string, label = id): Node {
  return { id, type: "architecture", position: { x: 0, y: 0 }, data: { label, type: "service" } };
}
function edge(id: string, protocol = "http"): Edge {
  return { id, source: "a", target: "b", data: { protocol } };
}

describe("diffDiagrams", () => {
  it("tags nodes and edges as added, removed, modified or unchanged and counts nodes", () => {
    const diff = diffDiagrams(
      { nodes: [node("a"), node("b"), node("gone")], edges: [edge("ab"), edge("old")] },
      {
        nodes: [node("a"), node("b", "Renamed"), node("new")],
        edges: [edge("ab", "grpc"), edge("fresh")],
      },
    );

    expect(diff.nodes.map(({ node: { id }, status }) => [id, status])).toEqual([
      ["a", "unchanged"],
      ["b", "modified"],
      ["gone", "removed"],
      ["new", "added"],
    ]);
    expect(diff.edges.map(({ edge: { id }, status }) => [id, status])).toEqual([
      ["ab", "modified"],
      ["old", "removed"],
      ["fresh", "added"],
    ]);
    expect(diff.counts).toEqual({ added: 1, removed: 1, modified: 1 });
  });

  it("ignores moves, since position is layout rather than content", () => {
    const moved = { ...node("a"), position: { x: 400, y: 80 } };
    expect(
      diffDiagrams({ nodes: [node("a")], edges: [] }, { nodes: [moved], edges: [] }).counts,
    ).toEqual({
      added: 0,
      removed: 0,
      modified: 0,
    });
  });
});
