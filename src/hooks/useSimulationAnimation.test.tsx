import { cleanup, render } from "@testing-library/react";
import { Position, ReactFlowProvider } from "@xyflow/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ArchitectureEdge } from "@/components/edges/ArchitectureEdge";
import { RollupEdge } from "@/components/edges/RollupEdge";
import { getEdgePath } from "./useSimulationAnimation";

vi.mock("@/hooks/useEdgeAnimation", () => ({
  useEdgeAnimation: () => ({
    containerRef: { current: null },
    dashPathRef: { current: null },
    dotInnerRef: { current: null },
    dotOuterRef: { current: null },
  }),
}));

const props = {
  id: "payload-path",
  source: "client",
  target: "server",
  sourceX: 100,
  sourceY: 200,
  targetX: 400,
  targetY: 300,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  selected: false,
  selectable: true,
  deletable: true,
};

afterEach(cleanup);

describe("simulation connection path lookup", () => {
  it.each([false, true])(
    "follows the real connection instead of its arrowhead or glow (bidirectional: %s)",
    (bidirectional) => {
      const { container } = render(
        <ReactFlowProvider>
          <svg>
            <ArchitectureEdge {...props} data={{ bidirectional, connectionFocus: "highlighted" }} />
          </svg>
        </ReactFlowProvider>,
      );
      const path = getEdgePath(props.id);
      expect(path).toHaveClass("react-flow__edge-path");
      expect(path?.getAttribute("d")).toBe(
        container.querySelector(".react-flow__edge-path")?.getAttribute("d"),
      );
      expect(path?.closest("marker")).toBeNull();
    },
  );

  it("follows a collapsed group's connection instead of its count marker", () => {
    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <RollupEdge {...props} data={{ count: 2 }} />
        </svg>
      </ReactFlowProvider>,
    );
    expect(getEdgePath(props.id)).toHaveClass("react-flow__edge-path");
    expect(getEdgePath(props.id)?.getAttribute("d")).toBe(
      container.querySelector(".react-flow__edge-path")?.getAttribute("d"),
    );
  });

  it("supports short straight connections without guessing from path length", () => {
    const { container } = render(
      <svg>
        <g data-edge-id={props.id}>
          <path className="react-flow__edge-path" d="M0 0L1 1" />
        </g>
      </svg>,
    );
    expect(getEdgePath(props.id)).toBe(container.querySelector(".react-flow__edge-path"));
  });

  it("returns no path for a missing connection or a group containing only decorations", () => {
    render(
      <svg>
        <g data-edge-id={props.id}>
          <defs>
            <marker id="arrow">
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          </defs>
        </g>
      </svg>,
    );
    expect(getEdgePath("missing")).toBeNull();
    expect(getEdgePath(props.id)).toBeNull();
  });
});
