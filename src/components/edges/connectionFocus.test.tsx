import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { act, cleanup, render, screen } from "@testing-library/react";
import { Position, ReactFlowProvider } from "@xyflow/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useUIStore } from "@/store/uiStore";
import { ArchitectureEdge } from "./ArchitectureEdge";
import { RollupEdge } from "./RollupEdge";

vi.mock("@xyflow/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@xyflow/react")>()),
  EdgeLabelRenderer: ({ children }: { children: ReactNode }) =>
    createPortal(children, document.body),
}));

const props = {
  id: "connection",
  source: "client",
  target: "server",
  sourceX: 0,
  sourceY: 0,
  targetX: 240,
  targetY: 160,
  sourcePosition: Position.Right,
  targetPosition: Position.Left,
  selected: false,
  selectable: true,
  deletable: true,
};

afterEach(() => {
  cleanup();
  useUIStore.setState(useUIStore.getInitialState());
});

describe("focused connection rendering", () => {
  it.each([false, true])(
    "highlights the path, label and directional markers (bidirectional: %s)",
    (bidirectional) => {
      const { container } = render(
        <ReactFlowProvider>
          <svg>
            <ArchitectureEdge
              {...props}
              data={{
                label: "Request",
                protocol: "http",
                bidirectional,
                connectionFocus: "highlighted",
              }}
            />
          </svg>
        </ReactFlowProvider>,
      );
      expect(container.querySelector(".react-flow__edge-path")).toHaveStyle({
        stroke: "var(--edge-focus)",
        strokeWidth: "3",
      });
      expect(container.querySelector(".react-flow__edge-path")).toHaveAttribute(
        "marker-end",
        "url(#arrow-connection-end)",
      );
      expect(container.querySelector("#arrow-connection-end path")).toHaveAttribute(
        "fill",
        "var(--edge-focus)",
      );
      expect(screen.getByText("Request")).toHaveAttribute("data-connection-focus", "highlighted");
      expect(container.querySelector(".connection-focus-glow")).toBeInTheDocument();
      expect(container.querySelector(".react-flow__edge-path")?.getAttribute("marker-start")).toBe(
        bidirectional ? "url(#arrow-connection-start)" : null,
      );
    },
  );

  it("dims an unrelated path and its portal label without blocking edge inspection", () => {
    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <ArchitectureEdge {...props} data={{ label: "Request", connectionFocus: "dimmed" }} />
        </svg>
      </ReactFlowProvider>,
    );
    expect(container.querySelector("[data-edge-id]")).toHaveStyle({ opacity: "0.18" });
    expect(screen.getByText("Request")).toHaveStyle({ opacity: "0.2", pointerEvents: "all" });
  });

  it("keeps protocol filters in force for a highlighted connection", () => {
    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <ArchitectureEdge
            {...props}
            data={{ label: "Request", protocol: "http", connectionFocus: "highlighted" }}
          />
        </svg>
      </ReactFlowProvider>,
    );
    act(() => useUIStore.getState().toggleHiddenProtocol("http"));
    expect(container.querySelector("[data-edge-id]")).toHaveStyle({ opacity: "0.12" });
    expect(screen.getByText("Request")).toHaveStyle({ pointerEvents: "none" });
  });

  it("highlights collapsed-group paths and their count badge", () => {
    const { container } = render(
      <ReactFlowProvider>
        <svg>
          <RollupEdge
            {...props}
            data={{
              count: 2,
              protocols: ["http"],
              edgeIds: ["a", "b"],
              collapsedGroupIds: ["group"],
              connectionFocus: "highlighted",
            }}
          />
        </svg>
      </ReactFlowProvider>,
    );
    expect(container.querySelector(".react-flow__edge-path")).toHaveStyle({
      stroke: "var(--edge-focus)",
    });
    expect(screen.getByRole("button", { name: /2 connections/ })).toHaveAttribute(
      "data-connection-focus",
      "highlighted",
    );
  });
});
