import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { iconLoaded } from "@iconify/react";
import { getCollections, searchIcons } from "@/services/iconify";
import { IconPickerDialog } from "./IconPickerDialog";

const { previewLoads } = vi.hoisted(() => ({ previewLoads: new Map<string, () => void>() }));

vi.mock("@iconify/react", () => ({
  iconLoaded: vi.fn<(icon: string) => boolean>(() => false),
  Icon: ({ icon, onLoad }: { icon: string; onLoad?: (icon: string) => void }) => {
    if (onLoad) {
      previewLoads.set(icon, () => onLoad(icon));
    }
    return <span aria-hidden="true" data-icon={icon} />;
  },
}));

vi.mock("@/services/iconify", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/iconify")>()),
  searchIcons: vi.fn<typeof searchIcons>(),
  getCollections: vi.fn<typeof getCollections>(),
}));

type PickerProps = ComponentProps<typeof IconPickerDialog>;
type SearchResult = Awaited<ReturnType<typeof searchIcons>>;

async function mount(overrides: Partial<PickerProps> = {}) {
  const props: PickerProps = {
    isOpen: true,
    onClose: vi.fn<PickerProps["onClose"]>(),
    onSelect: vi.fn<PickerProps["onSelect"]>(),
    ...overrides,
  };
  const view = render(<IconPickerDialog {...props} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(50);
  });
  return { ...view, props };
}

function searchFor(value: string) {
  fireEvent.change(screen.getByRole("searchbox", { name: "Search icons" }), {
    target: { value },
  });
}

async function advanceSearch() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
}

function deferredSearch() {
  let resolve!: (result: SearchResult) => void;
  const promise = new Promise<SearchResult>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  previewLoads.clear();
  vi.mocked(iconLoaded).mockReturnValue(false);
  vi.mocked(searchIcons).mockReset().mockResolvedValue({ icons: [], total: 0 });
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("IconPickerDialog", () => {
  it("browses named technologies immediately without searching or fetching collections", async () => {
    await mount();

    expect(screen.getByRole("dialog", { name: "Choose an icon" })).toHaveAccessibleDescription(
      /Browse popular technologies/,
    );
    expect(
      within(screen.getByRole("region", { name: "Frontend" })).getByRole("button", {
        name: "Select React",
      }),
    ).toHaveTextContent("React");
    for (const name of ["Node.js", "AWS", "PostgreSQL", "OpenAI"]) {
      expect(screen.getByRole("button", { name: `Select ${name}` })).toHaveTextContent(name);
    }
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText("logos:react")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use icon" })).toBeDisabled();
    await advanceSearch();
    expect(searchIcons).not.toHaveBeenCalled();
    expect(getCollections).not.toHaveBeenCalled();
  });

  it("confirms a curated selection immediately without waiting for an icon load", async () => {
    const { props } = await mount();
    const react = screen.getByRole("button", { name: "Select React" });
    fireEvent.click(react);
    expect(react).toHaveAttribute("aria-pressed", "true");
    expect(props.onSelect).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Use icon" }));
    expect(props.onSelect).toHaveBeenCalledExactlyOnceWith("logos:react");
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["Postgres", "PostgreSQL", "postgresql"],
    ["Node.js", "Node.js", "nodejs"],
    ["node js", "Node.js", "nodejs"],
    ["Amazon Web Services", "AWS", "aws"],
    ["AWS", "AWS", "aws"],
  ])("matches %s locally before the debounced catalog search", async (query, name, apiQuery) => {
    await mount();
    searchFor(query);
    expect(screen.getByRole("button", { name: `Select ${name}` })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Select React" })).not.toBeInTheDocument();
    expect(searchIcons).not.toHaveBeenCalled();
    expect(screen.getByText("Searching the wider catalog…")).toBeVisible();
    await advanceSearch();
    expect(searchIcons).toHaveBeenCalledExactlyOnceWith(
      apiQuery,
      undefined,
      48,
      expect.any(AbortSignal),
    );
  });

  it.each(["logos:react", "logos:aws"])(
    "resets the draft and query to currentIcon %s on reopening after cancel",
    async (currentIcon) => {
      const { rerender, props } = await mount({ currentIcon: "logos:react" });
      searchFor("node");
      fireEvent.click(screen.getByRole("button", { name: "Select Node.js" }));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(props.onSelect).not.toHaveBeenCalled();
      expect(props.onClose).toHaveBeenCalledTimes(1);
      rerender(<IconPickerDialog {...props} isOpen={false} />);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      rerender(
        <IconPickerDialog
          isOpen
          onClose={props.onClose}
          onSelect={props.onSelect}
          {...(currentIcon ? { currentIcon } : {})}
        />,
      );
      expect(screen.getByRole("searchbox")).toHaveValue("");
      expect(screen.getByRole("button", { name: "Select Node.js" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      const name = currentIcon === "logos:react" ? "React" : "AWS";
      expect(screen.getByRole("button", { name: `Select ${name}` })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      fireEvent.click(screen.getByRole("button", { name: "Use icon" }));
      expect(props.onSelect).toHaveBeenCalledExactlyOnceWith(currentIcon);
    },
  );

  it("clears a draft when reopened without a current icon", async () => {
    const { rerender, props } = await mount({ currentIcon: "logos:react" });
    fireEvent.click(screen.getByRole("button", { name: "Select Node.js" }));
    rerender(<IconPickerDialog {...props} isOpen={false} />);
    rerender(<IconPickerDialog isOpen onClose={props.onClose} onSelect={props.onSelect} />);
    expect(screen.getByText("No icon selected")).toBeVisible();
    expect(screen.getByRole("button", { name: "Use icon" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Select Node.js" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("debounces typing, cancels requests, and ignores stale results", async () => {
    const older = deferredSearch();
    const latest = deferredSearch();
    vi.mocked(searchIcons).mockReturnValueOnce(older.promise).mockReturnValueOnce(latest.promise);
    const { unmount } = await mount();
    searchFor("net");
    searchFor("network");
    await advanceSearch();
    expect(searchIcons).toHaveBeenCalledTimes(1);
    const olderSignal = vi.mocked(searchIcons).mock.calls[0]?.[3];
    expect(olderSignal?.aborted).toBe(false);

    searchFor("server");
    expect(olderSignal?.aborted).toBe(true);
    await advanceSearch();
    await act(async () => latest.resolve({ icons: ["lucide:server"], total: 1 }));
    expect(screen.getByRole("button", { name: "Select Server" })).toHaveTextContent("Server");
    await act(async () => older.resolve({ icons: ["lucide:network"], total: 99 }));
    expect(screen.queryByRole("button", { name: "Select Network" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select Server" })).toBeVisible();
    unmount();
    expect(vi.mocked(searchIcons).mock.calls[1]?.[3]?.aborted).toBe(true);
  });

  it("cancels on close and never runs a pending debounce after unmount", async () => {
    const pending = deferredSearch();
    vi.mocked(searchIcons).mockReturnValueOnce(pending.promise);
    const { rerender, props, unmount } = await mount();
    searchFor("server");
    await advanceSearch();
    rerender(<IconPickerDialog {...props} isOpen={false} />);
    expect(vi.mocked(searchIcons).mock.calls[0]?.[3]?.aborted).toBe(true);
    await act(async () => pending.resolve({ icons: ["lucide:server"], total: 1 }));
    rerender(<IconPickerDialog {...props} />);
    searchFor("network");
    unmount();
    await advanceSearch();
    expect(searchIcons).toHaveBeenCalledTimes(1);
  });

  it("keeps local matches usable after an offline error and supports retry", async () => {
    vi.mocked(searchIcons)
      .mockRejectedValueOnce(new Error("Unable to search. Check your connection."))
      .mockResolvedValueOnce({ icons: ["logos:postgresql", "devicon:postgresql-plain"], total: 2 });
    const { props } = await mount();
    searchFor("Postgres");
    await advanceSearch();
    expect(screen.getByRole("alert")).toHaveTextContent("Check your connection");
    fireEvent.click(screen.getByRole("button", { name: "Select PostgreSQL" }));
    expect(screen.getByRole("button", { name: "Use icon" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry search" }));
    await advanceSearch();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Select PostgreSQL" })).toHaveLength(2);
    expect(screen.queryByText("devicon:postgresql-plain")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use icon" }));
    expect(props.onSelect).toHaveBeenCalledExactlyOnceWith("logos:postgresql");
  });

  it("clears stale remote results immediately and returns to curated browsing when cleared", async () => {
    vi.mocked(searchIcons).mockResolvedValueOnce({ icons: ["lucide:server"], total: 1 });
    await mount();
    searchFor("server");
    await advanceSearch();
    expect(screen.getByRole("button", { name: "Select Server" })).toBeVisible();
    searchFor("no such technology");
    expect(screen.queryByRole("button", { name: "Select Server" })).not.toBeInTheDocument();
    await advanceSearch();
    expect(screen.getByText(/No icons found/)).toBeVisible();
    searchFor("   ");
    expect(screen.getByRole("button", { name: "Select React" })).toBeVisible();
    expect(screen.queryByRole("region", { name: "More icons" })).not.toBeInTheDocument();
    await advanceSearch();
    expect(searchIcons).toHaveBeenCalledTimes(2);
  });

  it("requires a remote preview to load, ignores another selection's late load, and offers retry", async () => {
    vi.mocked(searchIcons).mockResolvedValueOnce({
      icons: ["lucide:server", "lucide:network"],
      total: 2,
    });
    const { props } = await mount();
    searchFor("server");
    await advanceSearch();
    fireEvent.click(screen.getByRole("button", { name: "Select Network" }));
    const oldLoad = previewLoads.get("lucide:network");
    fireEvent.click(screen.getByRole("button", { name: "Select Server" }));
    const confirm = screen.getByRole("button", { name: "Use icon" });
    expect(confirm).toBeDisabled();
    act(() => oldLoad?.());
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(props.onSelect).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTimeAsync(8000));
    expect(screen.getByRole("alert")).toHaveTextContent("Icon preview could not load");
    fireEvent.click(screen.getByRole("button", { name: "Retry preview" }));
    expect(screen.getByText("Loading icon preview…")).toBeVisible();
    expect(confirm).toBeDisabled();
    act(() => previewLoads.get("lucide:server")?.());
    expect(confirm).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(confirm);
    expect(props.onSelect).toHaveBeenCalledExactlyOnceWith("lucide:server");
  });

  it("supports cached remote current icons without a loading delay", async () => {
    vi.mocked(iconLoaded).mockImplementation((id) => id === "lucide:server");
    await mount({ currentIcon: "lucide:server" });
    expect(screen.getByRole("button", { name: "Use icon" })).toBeEnabled();
    expect(screen.queryByText("Loading icon preview…")).not.toBeInTheDocument();
  });

  it("focuses search, traps keyboard focus, selects by keyboard, and cancels with Escape", async () => {
    const { props } = await mount();
    vi.useRealTimers();
    const user = userEvent.setup();
    expect(screen.getByRole("searchbox")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Select React" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Select React" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    screen.getByRole("button", { name: "Close" }).focus();
    await user.tab();
    await waitFor(() => {
      expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
    });
    await user.keyboard("{Escape}");
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onSelect).not.toHaveBeenCalled();
  });
});
