import type { Edge, Node } from "@xyflow/react";
import { describe, expect, it } from "vite-plus/test";
import { applyGroupCollapse } from "./groupRollup";
import { focusConnections } from "./connectionFocus";

const nodes: Node[] = ["client", "api", "db", "other"].map((id) => ({
  id,
  type: "architecture",
  position: { x: 0, y: 0 },
  data: { label: id, type: "service" },
}));
const edges: Edge[] = [
  { id: "in", source: "client", target: "api", data: { protocol: "http" } },
  { id: "out", source: "api", target: "db", data: { protocol: "sql" } },
  { id: "unrelated", source: "db", target: "other" },
];

describe("connection focus", () => {
  it("highlights incoming and outgoing paths, raises them above unrelated paths, and dims the rest", () => {
    const result = focusConnections(nodes, edges, "api");
    expect(result.map((edge) => edge.data?.["connectionFocus"])).toEqual([
      "highlighted",
      "highlighted",
      "dimmed",
    ]);
    expect(result[0]?.zIndex).toBeGreaterThan(result[2]?.zIndex ?? 0);
    expect(result[0]?.data?.["protocol"]).toBe("http");
    expect(result.every((edge) => !edge.selected)).toBe(true);
    expect(edges[0]?.data).toEqual({ protocol: "http" });
    expect(edges[0]).not.toHaveProperty("zIndex");
  });

  it("clears focus without modifying stored connections", () => {
    expect(focusConnections(nodes, edges, null)).toBe(edges);
    expect(focusConnections(nodes, edges, "deleted-node")).toBe(edges);
  });

  it("includes keyboard and multiple node selections", () => {
    const selection = nodes.map((node) => ({
      ...node,
      selected: node.id === "client" || node.id === "other",
    }));
    expect(
      focusConnections(selection, edges, null).map((edge) => edge.data?.["connectionFocus"]),
    ).toEqual(["highlighted", "dimmed", "highlighted"]);
  });

  it("focuses the contents of a selected group, including nested groups", () => {
    const grouped: Node[] = [
      { id: "group", type: "group", position: { x: 0, y: 0 }, data: {} },
      { id: "nested", parentId: "group", type: "group", position: { x: 0, y: 0 }, data: {} },
      ...nodes.map((node) => (node.id === "api" ? { ...node, parentId: "nested" } : node)),
    ];
    expect(
      focusConnections(grouped, edges, "group").map((edge) => edge.data?.["connectionFocus"]),
    ).toEqual(["highlighted", "highlighted", "dimmed"]);
  });

  it("focuses rolled-up connections at a collapsed group boundary", () => {
    const { displayNodes, displayEdges } = applyGroupCollapse(
      [
        { id: "group", type: "group", position: { x: 0, y: 0 }, data: { collapsed: true } },
        ...nodes.map((node) => (node.id === "api" ? { ...node, parentId: "group" } : node)),
      ],
      edges,
    );
    const focused = focusConnections(displayNodes, displayEdges, "group");
    expect(focused.filter((edge) => edge.type === "rollup")).toHaveLength(2);
    expect(
      focused
        .filter((edge) => edge.type === "rollup")
        .every((edge) => edge.data?.["connectionFocus"] === "highlighted"),
    ).toBe(true);
    expect(focused.find((edge) => edge.id === "unrelated")?.data?.["connectionFocus"]).toBe(
      "dimmed",
    );
  });
});
