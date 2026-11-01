import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Node } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useDiagramStore } from "@/store/diagramStore";
import { NodeDetailPopup } from "./NodeDetailPopup";

vi.mock("@iconify/react", () => ({ Icon: () => <svg aria-hidden="true" /> }));

const decision = {
  choice: "Cache frequent reads in Redis",
  reason: "Most reads repeat within a minute, so the primary can focus on writes.",
  benefits: ["Fewer database reads", "Faster page loads"],
  drawbacks: ["Reads can be up to 60 s stale"],
  considered: [{ option: "Read replicas", whyNot: "More to operate for this load" }],
  revisitWhen: ["Every read must be strongly consistent"],
};

function component(id = "cache"): Node {
  return {
    id,
    type: "architecture",
    position: { x: 0, y: 0 },
    data: {
      label: id === "cache" ? "Read cache" : "Another cache",
      type: "cache",
      description: "Own the hot read path",
      iconifyIcon: "logos:redis",
      decision,
      attributes: [
        { name: "Cache TTL", value: "60", unit: "s" },
        { name: "Replicas", value: "3", unit: "replicas" },
        { name: "Eviction policy", value: "LRU" },
        { name: "Port", value: "6379" },
        { name: "Technology", value: "Redis" },
      ],
      port: "6379",
      technology: "Redis",
      status: "warning",
      healthCheckUrl: "https://example.com/retired-health",
      tags: ["retired-tag"],
      iconColor: "#123456",
      accentColor: "#234567",
      backgroundColor: "#345678",
    },
  };
}

function popup() {
  return screen.getByRole("region", { name: "Selected component decision" });
}

function expectDismissed() {
  expect(
    screen.queryByRole("region", { name: "Selected component decision" }),
  ).not.toBeInTheDocument();
  expect(useDiagramStore.getState().selectedNodeId).toBe("cache");
}

beforeEach(() => {
  useDiagramStore.getState().resetDiagramState();
  useDiagramStore.setState({ nodes: [component(), component("other")], selectedNodeId: "cache" });
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected network request"));
});

afterEach(() => {
  cleanup();
  useDiagramStore.getState().resetDiagramState();
  const requests = vi.mocked(globalThis.fetch).mock.calls;
  vi.restoreAllMocks();
  // oxlint-disable-next-line vitest/no-standalone-expect -- Enforce offline behavior for every test, including cleanup.
  expect(requests).toHaveLength(0);
});

describe("NodeDetailPopup", () => {
  it("shows the choice, why, gains, costs and alternatives without disclosure", () => {
    render(<NodeDetailPopup />);
    const details = within(popup());
    expect(details.getByRole("heading", { name: "Read cache" })).toBeVisible();
    expect(details.getByText("Own the hot read path")).toBeVisible();
    const summary = details.getByRole("region", { name: "Decision" });
    expect(within(summary).getByText(decision.choice)).toBeVisible();
    expect(within(summary).getByText(decision.reason)).toBeVisible();
    const sections = {
      Gains: decision.benefits,
      Costs: decision.drawbacks,
      "Considered instead": ["Read replicas — More to operate for this load"],
      "Revisit when": decision.revisitWhen,
    };
    for (const [name, items] of Object.entries(sections)) {
      const section = within(summary).getByRole("region", { name });
      const listItems = within(section).getAllByRole("listitem");
      // Gains and Costs prefix each item with an aria-hidden + or − marker.
      expect(listItems.map((item) => item.textContent?.replace(/^[+−]/, ""))).toEqual(items);
      for (const item of listItems) {
        expect(item).toBeVisible();
        expect(item.closest('details, [hidden], [class*="line-clamp"], .truncate')).toBeNull();
      }
    }
    expect(summary.querySelector("details, summary")).not.toBeInTheDocument();
    expect(details.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows every attribute with units and does not duplicate legacy port or technology badges", () => {
    render(<NodeDetailPopup />);
    const attributes = within(popup()).getByRole("region", { name: "Architecture attributes" });
    expect(Array.from(attributes.querySelectorAll("dt"), (term) => term.textContent)).toEqual([
      "Cache TTL",
      "Replicas",
      "Eviction policy",
      "Port",
      "Technology",
    ]);
    expect(
      Array.from(attributes.querySelectorAll("dd"), (definition) => definition.textContent),
    ).toEqual(["60 s", "3 replicas", "LRU", "6379", "Redis"]);
    for (const value of ["60 s", "3 replicas", "LRU", "6379", "Redis"]) {
      expect(within(popup()).getAllByText(value, { exact: true })).toHaveLength(1);
      expect(within(popup()).getByText(value, { exact: true })).toBeVisible();
    }
    expect(within(popup()).queryByText(":6379")).not.toBeInTheDocument();
    expect(within(popup()).queryByText(/\+\d+ more/)).not.toBeInTheDocument();
    for (const text of ["warning", "retired-tag", "https://example.com/retired-health"]) {
      expect(within(popup()).queryByText(text)).not.toBeInTheDocument();
    }
    expect(
      popup().querySelector(
        'input[type="color"], [style*="#123456"], [style*="#234567"], [style*="#345678"]',
      ),
    ).not.toBeInTheDocument();
  });

  it("does not render legacy-only port and technology as separate badges", () => {
    const node = component();
    node.data["attributes"] = [];
    useDiagramStore.setState({ nodes: [node] });
    render(<NodeDetailPopup />);
    expect(within(popup()).queryByText("6379")).not.toBeInTheDocument();
    expect(within(popup()).queryByText(":6379")).not.toBeInTheDocument();
    expect(within(popup()).queryByText("Redis", { exact: true })).not.toBeInTheDocument();
    expect(
      within(popup()).queryByRole("region", { name: "Architecture attributes" }),
    ).not.toBeInTheDocument();
  });

  it("shows an honest empty decision state without empty attribute or reasoning sections", () => {
    useDiagramStore.setState({
      nodes: [
        {
          id: "cache",
          type: "architecture",
          position: { x: 0, y: 0 },
          data: { label: "Undocumented cache", type: "cache" },
        },
      ],
    });
    render(<NodeDetailPopup />);
    expect(within(popup()).getByText("No decision documented yet.")).toBeVisible();
    expect(within(popup()).queryByRole("region", { name: "Decision" })).not.toBeInTheDocument();
    expect(
      within(popup()).queryByRole("region", { name: "Architecture attributes" }),
    ).not.toBeInTheDocument();
  });

  it.each(["none", "missing", "group", "comment"])(
    "does not open for %s selection",
    (selection) => {
      useDiagramStore.setState({
        selectedNodeId: selection === "none" ? null : selection,
        nodes: [
          {
            id: "group",
            type: "group",
            position: { x: 0, y: 0 },
            data: { label: "VPC", groupType: "vpc" },
          },
          { id: "comment", type: "comment", position: { x: 0, y: 0 }, data: { text: "Note" } },
        ],
      });
      render(<NodeDetailPopup />);
      expect(
        screen.queryByRole("region", { name: "Selected component decision" }),
      ).not.toBeInTheDocument();
    },
  );

  it("dismisses by button without deselecting or editing the node, and opens for another selection", () => {
    render(<NodeDetailPopup />);
    const nodes = useDiagramStore.getState().nodes;
    fireEvent.click(screen.getByRole("button", { name: "Dismiss component decision" }));
    expectDismissed();
    expect(useDiagramStore.getState().nodes).toBe(nodes);
    act(() => useDiagramStore.setState({ selectedNodeId: "other" }));
    expect(within(popup()).getByRole("heading", { name: "Another cache" })).toBeVisible();
  });

  it("supports keyboard activation of the dismiss button", async () => {
    const user = userEvent.setup();
    render(<NodeDetailPopup />);
    await user.tab();
    expect(screen.getByRole("button", { name: "Dismiss component decision" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expectDismissed();
  });

  it("dismisses on an unhandled canvas Escape but not other keys", () => {
    render(<NodeDetailPopup />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(popup()).toBeVisible();
    fireEvent.keyDown(window, { key: "Escape" });
    expectDismissed();
  });

  it("does not consume an Escape already handled by another editor", () => {
    render(<NodeDetailPopup />);
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    event.preventDefault();
    fireEvent(window, event);
    expect(popup()).toBeVisible();
  });

  it.each([
    <input key="input" aria-label="Editing target" />,
    <textarea key="textarea" aria-label="Editing target" />,
    <select key="select" aria-label="Editing target">
      <option>Choose</option>
    </select>,
    <div key="editable" contentEditable suppressContentEditableWarning>
      <span>Editing target</span>
    </div>,
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Custom ARIA editors must also preserve Escape.
    <div key="textbox" role="textbox" contentEditable suppressContentEditableWarning>
      <span>Editing target</span>
    </div>,
    <div
      key="combobox"
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Exercise a custom combobox rather than a native select.
      role="combobox"
      aria-controls="suggestions"
      aria-expanded="false"
      aria-label="Editing target"
      tabIndex={0}
    >
      <span>Nested target</span>
    </div>,
    <div key="codemirror" className="cm-editor">
      <span>Editing target</span>
    </div>,
  ])("keeps the popup open while Escape originates in editing scope %#", (target) => {
    render(
      <>
        <NodeDetailPopup />
        <div data-testid="editing-scope">{target}</div>
      </>,
    );
    const scope = screen.getByTestId("editing-scope");
    fireEvent.keyDown(scope.querySelector("span") ?? scope.firstElementChild ?? scope, {
      key: "Escape",
    });
    expect(popup()).toBeVisible();
    fireEvent.keyDown(window, { key: "Escape" });
    expectDismissed();
  });

  it.each([
    <dialog key="dialog" open>
      Blocking overlay
    </dialog>,
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Third-party overlays may use an ARIA dialog, not a native dialog.
    <div key="role" role="dialog" aria-label="Blocking overlay" />,
    <div key="modal" aria-modal="true" />,
    <div key="blocked" data-editor-shortcuts="blocked" />,
  ])("defers Escape to blocking overlays %# even before focus moves", (overlay) => {
    const view = render(
      <>
        <NodeDetailPopup />
        {overlay}
      </>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(popup()).toBeVisible();
    view.rerender(<NodeDetailPopup />);
    fireEvent.keyDown(window, { key: "Escape" });
    expectDismissed();
  });

  it("removes its keyboard listener on unmount", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const view = render(<NodeDetailPopup />);
    const registration = add.mock.calls.find(([type]) => type === "keydown");
    expect(registration).toBeDefined();
    view.unmount();
    expect(remove).toHaveBeenCalledWith("keydown", registration?.[1]);
  });
});
