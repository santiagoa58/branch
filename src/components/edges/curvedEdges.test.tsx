import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, render } from "@testing-library/react";
import { getBezierPath, Position, ReactFlowProvider } from "@xyflow/react";
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

describe("fixed curved edge routing", () => {
  it.each([false, true])(
    "uses a Bezier curve for an architecture edge (animated: %s)",
    (animated) => {
      const { container } = render(
        <ReactFlowProvider>
          <svg>
            <ArchitectureEdge {...props} data={{ animated }} />
          </svg>
        </ReactFlowProvider>,
      );
      const [path] = getBezierPath(geometry);

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

  it("uses the same curved routing for collapsed-group connections", () => {
    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <RollupEdge {...props} />
        </svg>
      </ReactFlowProvider>,
    );

    expect(container.querySelector(".react-flow__edge-path")).toHaveAttribute(
      "d",
      getBezierPath(geometry)[0],
    );
  });

  it("does not expose an edge-style preference or toggle", () => {
    expect(useUIStore.getState()).not.toHaveProperty("edgeStyle");
    expect(useUIStore.getState()).not.toHaveProperty("toggleEdgeStyle");
  });
});
