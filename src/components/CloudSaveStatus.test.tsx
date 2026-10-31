import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { render, screen, waitFor, fireEvent, cleanup, act, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useNavigate } from "react-router-dom";
import { CloudNavigationGuard, CloudSaveError } from "./CloudSaveStatus";
import { useAnimationStore } from "@/store/animationStore";
import { cloudWorkspace } from "@/services/cloudWorkspace";
import {
  diagramsApi,
  versionsApi,
  ApiError,
  type ApiDiagram,
  type ApiDiagramVersion,
} from "@/services/api";
import { diagramDataSchema } from "@/schemas/diagram";
const empty = { nodes: [], edges: [], flows: [] };
const otherCopy = {
  nodes: [
    {
      id: "added-elsewhere",
      type: "architecture",
      position: { x: 0, y: 0 },
      data: { label: "Cache", type: "cache" },
    },
  ],
  edges: [],
  flows: [],
};
const diagram: ApiDiagram = {
  id: "a",
  projectId: "p",
  name: "A",
  data: diagramDataSchema.parse(empty),
  revision: 1,
  version: 0,
  thumbnail: null,
  description: null,
  createdAt: "today",
  updatedAt: "today",
};
function Editor() {
  const navigate = useNavigate();
  return (
    <>
      <CloudNavigationGuard />
      <CloudSaveError />
      <button
        type="button"
        onClick={() => {
          void navigate("/other");
        }}
      >
        Leave editor
      </button>
    </>
  );
}
function mount() {
  const router = createMemoryRouter([
    { path: "/", element: <Editor /> },
    { path: "/other", element: <p>Other page</p> },
  ]);
  render(<RouterProvider router={router} />);
  return router;
}
beforeEach(async () => {
  vi.spyOn(diagramsApi, "get").mockResolvedValue(diagram);
  await cloudWorkspace.load("a");
});
afterEach(() => {
  cleanup();
  cloudWorkspace.reset();
  vi.restoreAllMocks();
});
describe("cloud navigation and save recovery", () => {
  it("saves pending edits before navigating", async () => {
    const save = vi.spyOn(diagramsApi, "update").mockResolvedValue({ ...diagram, revision: 2 });
    cloudWorkspace.schedule(empty);
    mount();
    fireEvent.click(screen.getByText("Leave editor"));
    await screen.findByText("Other page");
    expect(save).toHaveBeenCalledWith("a", { expectedRevision: 1, data: empty });
  });
  it("keeps the route and pending edits when save fails, then retries", async () => {
    vi.spyOn(diagramsApi, "update")
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValue({ ...diagram, revision: 2 });
    cloudWorkspace.schedule(empty);
    const router = mount();
    fireEvent.click(screen.getByText("Leave editor"));
    await screen.findByText("Your edits have not been saved");
    expect(screen.getByText("Network unavailable")).toHaveClass("text-muted-foreground");
    expect(router.state.location.pathname).toBe("/");
    expect(cloudWorkspace.getState().dirty).toBe(true);
    fireEvent.click(screen.getByText("Stay in editor"));
    fireEvent.click(screen.getByText("Retry save"));
    await waitFor(() => expect(cloudWorkspace.getState().dirty).toBe(false));
    fireEvent.click(screen.getByText("Leave editor"));
    await screen.findByText("Other page");
  });
  it("waits for requested animated deletions before leaving the document", async () => {
    act(() => {
      useAnimationStore.getState().requestDelete("s");
    });
    const router = mount();
    fireEvent.click(screen.getByText("Leave editor"));
    expect(router.state.location.pathname).toBe("/");
    await act(async () => {
      useAnimationStore.getState().confirmDelete("s");
    });
    await screen.findByText("Other page");
  });
  it("does not automatically retry a deferred navigation save failure", async () => {
    let rejectSave!: (reason: Error) => void;
    const pending = new Promise<ApiDiagram>((_resolve, reject) => {
      rejectSave = reject;
    });
    const save = vi.spyOn(diagramsApi, "update").mockReturnValue(pending);
    cloudWorkspace.schedule(empty);
    mount();
    fireEvent.click(screen.getByText("Leave editor"));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    await act(async () => {
      rejectSave(new Error("Still offline"));
    });
    await screen.findByText("Your edits have not been saved");
    expect(save).toHaveBeenCalledTimes(1);
  });
  it("blocks global keyboard mutations throughout a version operation", async () => {
    mount();
    let resolveVersion!: (version: ApiDiagramVersion) => void;
    vi.spyOn(versionsApi, "create").mockReturnValue(
      new Promise<ApiDiagramVersion>((resolve) => {
        resolveVersion = resolve;
      }),
    );
    let operation!: Promise<ApiDiagramVersion>;
    await act(async () => {
      operation = cloudWorkspace.createVersion();
      await Promise.resolve();
    });
    const shortcut = vi.fn<(event: KeyboardEvent) => void>();
    window.addEventListener("keydown", shortcut);
    fireEvent.keyDown(window, { key: "s" });
    expect(shortcut).not.toHaveBeenCalled();
    window.removeEventListener("keydown", shortcut);
    await act(async () => {
      resolveVersion({
        id: "v",
        diagramId: "a",
        versionNumber: 1,
        label: null,
        thumbnail: null,
        createdAt: "today",
      });
      await operation;
    });
  });
  it("keeps native text editing, Tab, and Escape available while the workspace is locked", () => {
    mount();
    act(() => cloudWorkspace.suspend());
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    try {
      expect(fireEvent.keyDown(input, { key: "s" })).toBe(true);
      expect(fireEvent.keyDown(input, { key: "c", metaKey: true })).toBe(true);
      expect(fireEvent.keyDown(input, { key: "z", ctrlKey: true })).toBe(true);
      input.blur();
      expect(fireEvent.keyDown(window, { key: "Tab" })).toBe(true);
      expect(fireEvent.keyDown(window, { key: "Escape" })).toBe(true);
      expect(fireEvent.keyDown(window, { key: "s" })).toBe(false);
    } finally {
      input.remove();
    }
  });

  it("allows copying selected read-only text while the workspace is locked", () => {
    mount();
    act(() => cloudWorkspace.suspend());
    const note = document.createElement("p");
    note.textContent = "Your edits are still in memory.";
    document.body.append(note);
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(note);
    selection?.addRange(range);
    try {
      expect(selection?.toString()).toBe(note.textContent);
      expect(fireEvent.keyDown(note, { key: "c", metaKey: true })).toBe(true);
    } finally {
      selection?.removeAllRanges();
      note.remove();
    }
  });

  it("shows a conflict without silently overwriting and supports explicit discard", async () => {
    vi.spyOn(diagramsApi, "update").mockRejectedValue(new ApiError(409, "Changed elsewhere"));
    cloudWorkspace.schedule(empty);
    await expect(cloudWorkspace.flush()).rejects.toThrow("Changed elsewhere");
    const router = mount();
    expect(screen.queryByText("Retry save")).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByText("Leave editor"));
    await screen.findByText("Your edits have not been saved");
    expect(router.state.location.pathname).toBe("/");
    fireEvent.click(screen.getByText("Discard edits and leave"));
    await screen.findByText("Other page");
  });

  it("compares both copies on a conflict and saves the one the person keeps", async () => {
    const remote = { ...diagram, revision: 7, data: diagramDataSchema.parse(otherCopy) };
    vi.spyOn(diagramsApi, "get").mockResolvedValue(remote);
    const update = vi
      .spyOn(diagramsApi, "update")
      .mockRejectedValueOnce(new ApiError(409, "Changed elsewhere"))
      .mockImplementation(async (_id, input) => ({
        ...remote,
        revision: input.expectedRevision + 1,
      }));
    cloudWorkspace.schedule(empty);
    await expect(cloudWorkspace.flush()).rejects.toThrow("Changed elsewhere");
    mount();

    const dialog = await screen.findByRole("dialog", {
      name: "This diagram was changed somewhere else",
    });
    expect(within(dialog).getByText("-1 removed")).toBeInTheDocument();
    // The modal hides the page behind it from assistive technology, banner included.
    expect(screen.getByRole("alert", { hidden: true })).toHaveTextContent(
      "This diagram was changed in another tab or window. Your edits in this tab aren't saved yet.",
    );
    expect(screen.queryByText(/Export/)).toBeNull();

    fireEvent.click(within(dialog).getByRole("button", { name: "Keep my version" }));

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(update).toHaveBeenLastCalledWith("a", { data: empty, expectedRevision: 7 });
    expect(cloudWorkspace.getState()).toMatchObject({ status: "saved", dirty: false });
  });

  it("can reopen the comparison and switch to the other copy, dropping this tab's edits", async () => {
    const remote = { ...diagram, revision: 7, data: diagramDataSchema.parse(otherCopy) };
    vi.spyOn(diagramsApi, "get").mockResolvedValue(remote);
    const update = vi
      .spyOn(diagramsApi, "update")
      .mockRejectedValue(new ApiError(409, "Changed elsewhere"));
    cloudWorkspace.schedule(empty);
    await expect(cloudWorkspace.flush()).rejects.toThrow("Changed elsewhere");
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Review changes" }));
    fireEvent.click(await screen.findByRole("button", { name: "Discard mine, use other copy" }));

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(update).toHaveBeenCalledTimes(1);
    expect(cloudWorkspace.getState()).toMatchObject({
      status: "saved",
      dirty: false,
      diagram: { revision: 7 },
    });
  });
});
