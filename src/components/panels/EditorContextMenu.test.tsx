import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Node } from "@xyflow/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { EditorContextMenu } from "./EditorContextMenu";

afterEach(cleanup);

function node(id: string, overrides: Partial<Node> = {}): Node {
  return { id, type: "architecture", position: { x: 0, y: 0 }, data: {}, ...overrides };
}

const ITEM_NAMES = [
  "Copy Ctrl+C",
  "Paste Ctrl+V",
  "Bring to Front",
  "Send to Back",
  "Export Selection as SVG",
  "Export Selection as PNG",
];

function renderMenu({
  nodes = [] as Node[],
  hasClipboardContent = false,
}: { nodes?: Node[]; hasClipboardContent?: boolean } = {}) {
  const handlers = {
    onClose: vi.fn<() => void>(),
    onCopy: vi.fn<() => void>(),
    onPaste: vi.fn<() => void>(),
    onBringToFront: vi.fn<(nodeId: string) => void>(),
    onSendToBack: vi.fn<(nodeId: string) => void>(),
    onExportSvg: vi.fn<() => Promise<void>>(() => Promise.resolve()),
    onExportPng: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  };
  render(
    <EditorContextMenu
      x={120}
      y={80}
      nodes={nodes}
      hasClipboardContent={hasClipboardContent}
      {...handlers}
    />,
  );
  return handlers;
}

/** The menu items in order, leaving out the full-screen close backdrop. */
function visibleItems() {
  const backdrop = screen.getByRole("button", { name: "Close context menu" });
  return screen
    .getAllByRole("button")
    .filter((button) => button !== backdrop)
    .map((button) => button.textContent);
}

describe("EditorContextMenu", () => {
  it("shows no items with neither a selection nor clipboard content", () => {
    renderMenu({ nodes: [node("a"), node("b")] });

    expect(screen.getByRole("button", { name: "Close context menu" })).toBeInTheDocument();
    for (const name of ITEM_NAMES) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("opens at the given screen position", () => {
    renderMenu({ hasClipboardContent: true });

    const menu = screen.getByRole("button", { name: "Paste Ctrl+V" }).closest("[style]");
    expect(menu).toHaveStyle({ left: "120px", top: "80px" });
    expect(menu).toHaveAttribute("data-editor-shortcuts", "blocked");
  });

  it("offers copy and both exports for a node selection, without layer order", () => {
    renderMenu({ nodes: [node("a", { selected: true }), node("b")] });

    expect(visibleItems()).toEqual([
      "CopyCtrl+C",
      "Export Selection as SVG",
      "Export Selection as PNG",
    ]);
  });

  it("adds paste when the clipboard has content", () => {
    renderMenu({ nodes: [node("a", { selected: true })], hasClipboardContent: true });

    expect(visibleItems()).toEqual([
      "CopyCtrl+C",
      "PasteCtrl+V",
      "Export Selection as SVG",
      "Export Selection as PNG",
    ]);
  });

  it("offers only paste when nothing is selected but the clipboard has content", () => {
    renderMenu({ nodes: [node("a")], hasClipboardContent: true });

    expect(visibleItems()).toEqual(["PasteCtrl+V"]);
  });

  it("adds layer order for a single selected group", () => {
    renderMenu({
      nodes: [node("g", { type: "group", selected: true }), node("a", { selected: true })],
    });

    expect(visibleItems()).toEqual([
      "CopyCtrl+C",
      "Bring to Front",
      "Send to Back",
      "Export Selection as SVG",
      "Export Selection as PNG",
    ]);
  });

  it("hides layer order when more than one group is selected", () => {
    renderMenu({
      nodes: [
        node("g1", { type: "group", selected: true }),
        node("g2", { type: "group", selected: true }),
      ],
    });

    expect(screen.queryByRole("button", { name: "Bring to Front" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send to Back" })).not.toBeInTheDocument();
  });

  it("closes when the backdrop is clicked", async () => {
    const handlers = renderMenu({ hasClipboardContent: true });

    await userEvent.click(screen.getByRole("button", { name: "Close context menu" }));

    expect(handlers.onClose).toHaveBeenCalledOnce();
  });

  it("brings the selected group to front and closes", async () => {
    const handlers = renderMenu({ nodes: [node("g", { type: "group", selected: true })] });

    await userEvent.click(screen.getByRole("button", { name: "Bring to Front" }));

    expect(handlers.onBringToFront).toHaveBeenCalledWith("g");
    expect(handlers.onSendToBack).not.toHaveBeenCalled();
    expect(handlers.onClose).toHaveBeenCalledOnce();
  });

  it("sends the selected group to back and closes", async () => {
    const handlers = renderMenu({ nodes: [node("g", { type: "group", selected: true })] });

    await userEvent.click(screen.getByRole("button", { name: "Send to Back" }));

    expect(handlers.onSendToBack).toHaveBeenCalledWith("g");
    expect(handlers.onBringToFront).not.toHaveBeenCalled();
    expect(handlers.onClose).toHaveBeenCalledOnce();
  });

  // Copy, paste and the exports close the menu from the editor's own handlers (an export only
  // closes it once it succeeds), so the menu itself calls just the handler.
  it.each([
    ["Copy Ctrl+C", "onCopy"],
    ["Paste Ctrl+V", "onPaste"],
    ["Export Selection as SVG", "onExportSvg"],
    ["Export Selection as PNG", "onExportPng"],
  ] as const)("%s calls %s and leaves closing to it", async (name, handler) => {
    const handlers = renderMenu({
      nodes: [node("a", { selected: true })],
      hasClipboardContent: true,
    });

    await userEvent.click(screen.getByRole("button", { name }));

    expect(handlers[handler]).toHaveBeenCalledOnce();
    const called = Object.entries(handlers)
      .filter(([, fn]) => fn.mock.calls.length > 0)
      .map(([key]) => key);
    expect(called).toEqual([handler]);
  });
});
