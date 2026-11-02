import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, render } from "@testing-library/react";
import { Position, ReactFlowProvider } from "@xyflow/react";
import { routeEdge, routePath } from "@/utils/edgeRouting";
import { ArchitectureEdge } from "./ArchitectureEdge";
import { RollupEdge } from "./RollupEdge";
import { useEdgeAnimation } from "@/hooks/useEdgeAnimation";
import { useUIStore } from "@/store/uiStore";

vi.mock("@/hooks/useEdgeAnimation", () => ({
  useEdgeAnimation: vi.fn<typeof useEdgeAnimation>().mockReturnValue({
    containerRef: { current: null },
    dashPathRef: { current: null },
    dotInnerRef: { current: null },
    dotOuterRef: { current: null },
    timeline: { current: null },
  }),
}));

const geometry = {
  sourceX: 0,
  sourceY: 0,
  sourcePosition: Position.Right,
  targetX: 240,
  targetY: 160,
  targetPosition: Position.Left,
};
const props = {
  id: "curved-edge",
  source: "source",
  target: "target",
  ...geometry,
  selected: false,
  selectable: true,
  deletable: true,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("orthogonal edge routing", () => {
  it.each([false, true])(
    "draws an orthogonal path for an architecture edge (animated: %s)",
    (animated) => {
      const { container } = render(
        <ReactFlowProvider>
          <svg>
            <ArchitectureEdge {...props} data={{ animated }} />
          </svg>
        </ReactFlowProvider>,
      );
      const path = routePath(routeEdge(geometry, []).points);
      // Straight runs and rounded corners only: no Bezier curve.
      expect(path).toMatch(/^M0 0L/);
      expect(path).not.toContain("C");

      expect(container.querySelector(".react-flow__edge-path")).toHaveAttribute("d", path);
      expect(useEdgeAnimation).toHaveBeenCalledWith({
        edgePath: path,
        isAnimated: animated,
        speed: 1,
      });
      for (const overlay of container.querySelectorAll("g[data-edge-id] > g > path")) {
        expect(overlay).toHaveAttribute("d", path);
      }
    },
  );

  it("uses the same orthogonal routing for collapsed-group connections", () => {
    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <RollupEdge {...props} />
        </svg>
      </ReactFlowProvider>,
    );

    expect(container.querySelector(".react-flow__edge-path")).toHaveAttribute(
      "d",
      routePath(routeEdge(geometry, []).points),
    );
  });

  it("does not expose an edge-style preference or toggle", () => {
    expect(useUIStore.getState()).not.toHaveProperty("edgeStyle");
    expect(useUIStore.getState()).not.toHaveProperty("toggleEdgeStyle");
  });
});
