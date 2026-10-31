import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { getBezierPath, Position, ReactFlowProvider, type Node } from "@xyflow/react";
import type { EdgeDetailsDialog } from "@/components/ui/EdgeDetailsDialog";
import { useEdgeAnimation } from "@/hooks/useEdgeAnimation";
import { useDiagramStore } from "@/store/diagramStore";
import { ArchitectureEdge } from "./ArchitectureEdge";
import { RollupEdge } from "./RollupEdge";

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...actual,
    EdgeLabelRenderer: ({ children }: ComponentProps<typeof actual.EdgeLabelRenderer>) => (
      <foreignObject>{children}</foreignObject>
    ),
  };
});

vi.mock("@/components/ui/EdgeDetailsDialog", () => ({
  EdgeDetailsDialog: vi.fn<typeof EdgeDetailsDialog>().mockImplementation(({ open, edgeId }) => (
    <foreignObject>
      {open && (
        <dialog open aria-label="Edge details">
          {edgeId}
        </dialog>
      )}
    </foreignObject>
  )),
}));

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
  id: "label-edge",
  source: "source",
  target: "target",
  ...geometry,
  selected: false,
  selectable: true,
  deletable: true,
};
const [, midpointX, midpointY] = getBezierPath(geometry);
const obstacle: Node = {
  id: "obstacle",
  position: { x: midpointX + 40, y: midpointY - 30 },
  measured: { width: 160, height: 100 },
  data: {},
};

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class implements ResizeObserver {
      observe = vi.fn<ResizeObserver["observe"]>();
      unobserve = vi.fn<ResizeObserver["unobserve"]>();
      disconnect = vi.fn<ResizeObserver["disconnect"]>();
    },
  );
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.style.width === "24px" ? 24 : 180;
  });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.style.height === "24px" ? 24 : 20;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function renderEdge(edge: ReactNode, nodes = [obstacle]) {
  return render(
    <ReactFlowProvider initialNodes={nodes}>
      <svg>{edge}</svg>
    </ReactFlowProvider>,
  );
}

function expectLabelClear(element: HTMLElement) {
  const match = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)$/.exec(element.style.transform);
  expect(match).not.toBeNull();
  const x = Number(match?.[1]);
  const y = Number(match?.[2]);
  // The midpoint itself is clear; only the measured label's full bounds collide.
  expect(midpointX).toBeLessThan(obstacle.position.x);
  expect(
    x + element.offsetWidth / 2 <= obstacle.position.x ||
      x - element.offsetWidth / 2 >= obstacle.position.x + 160 ||
      y + element.offsetHeight / 2 <= obstacle.position.y ||
      y - element.offsetHeight / 2 >= obstacle.position.y + 100,
  ).toBe(true);
}

describe("edge label interactions", () => {
  it("clears an obstacle with the visible architecture label and still opens its dialog", () => {
    const { getByText, getByRole, queryByRole } = renderEdge(
      <ArchitectureEdge {...props} data={{ label: "persist operations" }} />,
    );
    const label = getByText("persist operations");

    expectLabelClear(label);
    expect(queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.doubleClick(label);
    expect(getByRole("dialog", { name: "Edge details" })).toHaveTextContent(props.id);
  });

  it("clears an obstacle with the rollup button and still expands its collapsed groups", () => {
    const expand = vi
      .spyOn(useDiagramStore.getState(), "toggleGroupCollapse")
      .mockImplementation(() => {});
    const { getByRole } = renderEdge(
      <RollupEdge
        {...props}
        data={{
          count: 2,
          edgeIds: ["first", "second"],
          protocols: ["grpc"],
          collapsedGroupIds: ["source-group", "target-group"],
        }}
      />,
    );
    const button = getByRole("button", { name: "2 connections" });

    expectLabelClear(button);
    fireEvent.click(button);
    expect(expand).toHaveBeenCalledTimes(2);
    expect(expand).toHaveBeenNthCalledWith(1, "source-group");
    expect(expand).toHaveBeenNthCalledWith(2, "target-group");
  });

  it("keeps an unlabeled edge's invisible double-click target at the Bezier midpoint", () => {
    const nearObstacle = {
      ...obstacle,
      position: { x: midpointX + 10, y: obstacle.position.y },
    };
    const { container, getByRole } = renderEdge(<ArchitectureEdge {...props} />, [nearObstacle]);
    const hitArea = container.querySelector<HTMLElement>("foreignObject > div")!;

    expect(hitArea).toHaveStyle({
      width: "24px",
      height: "24px",
      transform: `translate(-50%, -50%) translate(${midpointX}px, ${midpointY}px)`,
    });
    fireEvent.doubleClick(hitArea);
    expect(getByRole("dialog", { name: "Edge details" })).toHaveTextContent(props.id);
  });
});
