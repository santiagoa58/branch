import { cleanup, render, screen } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { ArchitectureNode as ArchitectureFlowNode, ArchitectureNodeData } from "@/types";
import { act } from "react";
import { useAiDesignStore } from "@/store/aiDesignStore";
import { useAnimationStore } from "@/store/animationStore";
import { useSimulationStore } from "@/store/simulationStore";
import { ArchitectureNode } from "./ArchitectureNode";

vi.mock("@iconify/react", () => ({ Icon: () => <svg aria-hidden="true" /> }));
vi.mock("@/components/ui/IconPickerDialog", () => ({ IconPickerDialog: () => null }));

function renderNode(data: ArchitectureNodeData) {
  const props: NodeProps<ArchitectureFlowNode> = {
    id: "cache",
    type: "architecture",
    data,
    selected: false,
    dragging: false,
    draggable: true,
    selectable: true,
    deletable: true,
    isConnectable: true,
    zIndex: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
  };
  return render(
    <ReactFlowProvider>
      <ArchitectureNode {...props} />
    </ReactFlowProvider>,
  );
}

beforeEach(() => {
  useSimulationStore.getState().setMode("idle");
  useAnimationStore.setState({ pendingDeletions: new Set() });
  useAiDesignStore.setState(useAiDesignStore.getInitialState());
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected network request"));
});

afterEach(() => {
  cleanup();
  const requests = vi.mocked(globalThis.fetch).mock.calls;
  vi.restoreAllMocks();
  // oxlint-disable-next-line vitest/no-standalone-expect -- Enforce offline behavior for every test, including cleanup.
  expect(requests).toHaveLength(0);
});

describe("architecture node details", () => {
  it("rings the node while its id is highlighted", () => {
    const { container } = renderNode({ label: "Read cache", type: "cache" });
    const node = container.querySelector("[data-node-id='cache']");
    expect(node).not.toHaveAttribute("data-highlighted");

    act(() => useAiDesignStore.getState().setHighlight(["other"]));
    expect(node).not.toHaveAttribute("data-highlighted");
    act(() => useAiDesignStore.getState().setHighlight(["cache"]));
    expect(node).toHaveAttribute("data-highlighted", "true");
    expect(node).toHaveClass("ring-primary");
    act(() => useAiDesignStore.getState().setHighlight([]));
    expect(node).not.toHaveAttribute("data-highlighted");
  });

  it("shows the first three attributes with units and includes all facts in the summary tooltip", () => {
    renderNode({
      label: "Read cache",
      type: "cache",
      attributes: [
        { name: "Cache TTL", value: "60", unit: "s" },
        { name: "Replicas", value: "3", unit: "replicas" },
        { name: "Eviction policy", value: "LRU" },
        { name: "Memory", value: "512", unit: "MiB" },
      ],
    });
    for (const value of ["Cache TTL", "60 s", "Replicas", "3 replicas", "Eviction policy", "LRU"]) {
      expect(screen.getByText(value, { exact: true })).toBeVisible();
    }
    expect(screen.getByText("+1 more")).toBeVisible();
    expect(screen.queryByText("Memory", { exact: true })).not.toBeInTheDocument();
    const summary = screen.getByTitle(/Cache TTL:/);
    expect(summary).toBeVisible();
    expect(summary).toHaveAttribute(
      "title",
      "Cache TTL: 60 s\nReplicas: 3 replicas\nEviction policy: LRU\nMemory: 512 MiB",
    );
  });

  it("shows the chosen approach on the node with the why on hover", () => {
    renderNode({
      label: "Read cache",
      type: "cache",
      decision: {
        choice: "Redis cache-aside",
        reason: "Most reads repeat within a minute",
        drawbacks: ["Stale reads"],
      },
    });
    const badge = screen.getByText("Redis cache-aside");
    expect(badge).toBeVisible();
    expect(badge).toHaveAttribute("title", "Redis cache-aside\nMost reads repeat within a minute");
    expect(screen.queryByText("Decision")).not.toBeInTheDocument();
  });

  it("falls back to a generic badge when a decision has no choice yet", () => {
    renderNode({
      label: "Read cache",
      type: "cache",
      decision: { drawbacks: ["Stale reads"], choice: "  " },
    });
    expect(screen.getByText("Decision")).toBeVisible();
  });

  it("shows no decision badge for an empty decision", () => {
    renderNode({ label: "Read cache", type: "cache", decision: { choice: " ", benefits: [""] } });
    expect(screen.queryByText("Decision")).not.toBeInTheDocument();
  });

  it("does not render retired status, health, port, technology, tags or custom colors", () => {
    const { container } = renderNode({
      label: "Read cache",
      type: "cache",
      iconifyIcon: "logos:redis",
      status: "warning",
      healthCheckUrl: "https://example.com/retired-health",
      port: "6379",
      technology: "Legacy Redis runtime",
      tags: ["retired-tag"],
      iconColor: "#123456",
      accentColor: "#234567",
      backgroundColor: "#345678",
    });
    expect(screen.getByText("Read cache")).toBeVisible();
    for (const text of ["warning", "6379", ":6379", "Legacy Redis runtime", "retired-tag"]) {
      expect(screen.queryByText(text, { exact: true })).not.toBeInTheDocument();
    }
    expect(screen.queryByLabelText(/health|status|tags|colou?r/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/health|status|tags|colou?r/i)).not.toBeInTheDocument();
    expect(container.querySelector("[style]")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /health|check/i })).not.toBeInTheDocument();
  });
});
