import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { getCollections, getFeaturedCollections, searchIcons } from "@/services/iconify";
import { notify } from "@/services/notify";
import { IconPickerDialog } from "./IconPickerDialog";

vi.mock("@iconify/react", () => ({
  Icon: ({ icon }: { icon: string }) => <span aria-hidden="true" data-icon={icon} />,
}));

vi.mock("@/services/iconify", () => ({
  searchIcons: vi.fn<typeof searchIcons>(),
  getCollections: vi.fn<typeof getCollections>(),
  getFeaturedCollections: vi.fn<typeof getFeaturedCollections>(),
}));

vi.mock("@/services/notify", () => ({
  notify: { error: vi.fn<typeof notify.error>() },
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
    await Promise.resolve();
  });
  return { ...view, props };
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
  vi.resetAllMocks();
  vi.mocked(getCollections).mockResolvedValue([
    { prefix: "logos", name: "SVG Logos", total: 100 },
    { prefix: "devicon", name: "Devicon", total: 100 },
    { prefix: "lucide", name: "Lucide", total: 100 },
  ]);
  vi.mocked(getFeaturedCollections).mockReturnValue(["logos", "devicon", "lucide"]);
  vi.mocked(searchIcons).mockResolvedValue({ icons: [], total: 0 });
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("IconPickerDialog", () => {
  it("browses recognizable brands in technology groups without a search", async () => {
    await mount();

    expect(
      within(screen.getByRole("region", { name: "Frontend" })).getByRole("button", {
        name: "Select React (logos:react)",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Select Node.js (logos:nodejs-icon)" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Select AWS (logos:aws)" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Select PostgreSQL (logos:postgresql)" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Select OpenAI (logos:openai-icon)" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Select Icon" })).toBeDisabled();

    await advanceSearch();
    expect(searchIcons).not.toHaveBeenCalled();
  });

  it("selects a brand and sends its Iconify ID only on confirmation", async () => {
    const { props } = await mount();
    const react = screen.getByRole("button", { name: "Select React (logos:react)" });

    fireEvent.click(react);
    expect(react).toHaveAttribute("aria-pressed", "true");
    expect(props.onSelect).not.toHaveBeenCalled();
    expect(props.onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Select Icon" }));
    expect(props.onSelect).toHaveBeenCalledExactlyOnceWith("logos:react");
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("filters featured brands by collection and passes that filter to search", async () => {
    await mount();
    const collection = screen.getByRole("combobox", { name: "Collection:" });
    expect(collection).toBeEnabled();

    fireEvent.change(collection, { target: { value: "devicon" } });
    expect(screen.getByRole("button", { name: "Select Keras (devicon:keras)" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Select React (logos:react)" }),
    ).not.toBeInTheDocument();

    fireEvent.change(collection, { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Select React (logos:react)" })).toBeVisible();

    fireEvent.change(collection, { target: { value: "lucide" } });
    expect(screen.getByText(/No featured icons in this collection/)).toBeVisible();
    vi.mocked(searchIcons).mockResolvedValueOnce({ icons: ["lucide:server"], total: 1 });
    fireEvent.change(screen.getByRole("textbox", { name: "Search icons" }), {
      target: { value: "server" },
    });
    await advanceSearch();

    expect(searchIcons).toHaveBeenCalledExactlyOnceWith(
      "server",
      "lucide",
      48,
      expect.any(AbortSignal),
    );
    expect(screen.getByRole("button", { name: "Select lucide:server" })).toBeVisible();
  });

  it.each([
    { currentIcon: "logos:react", label: "Select React (logos:react)" },
    { currentIcon: "logos:aws", label: "Select AWS (logos:aws)" },
  ])(
    "resets an unconfirmed selection to $currentIcon on reopening",
    async ({ currentIcon, label }) => {
      const { rerender, props } = await mount({ currentIcon: "logos:react" });
      fireEvent.click(screen.getByRole("button", { name: "Select Node.js (logos:nodejs-icon)" }));
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(props.onSelect).not.toHaveBeenCalled();

      rerender(<IconPickerDialog {...props} isOpen={false} />);
      expect(screen.queryByRole("textbox", { name: "Search icons" })).not.toBeInTheDocument();
      await act(async () => {
        rerender(
          <IconPickerDialog
            isOpen
            onClose={props.onClose}
            onSelect={props.onSelect}
            {...(currentIcon ? { currentIcon } : {})}
          />,
        );
      });

      expect(
        screen.getByRole("button", { name: "Select Node.js (logos:nodejs-icon)" }),
      ).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true");
      fireEvent.click(screen.getByRole("button", { name: "Select Icon" }));
      expect(props.onSelect).toHaveBeenCalledExactlyOnceWith(currentIcon);
    },
  );

  it("clears an unconfirmed selection when reopened without a current icon", async () => {
    const { rerender, props } = await mount({ currentIcon: "logos:react" });
    fireEvent.click(screen.getByRole("button", { name: "Select Node.js (logos:nodejs-icon)" }));
    rerender(<IconPickerDialog {...props} isOpen={false} />);
    await act(async () => {
      rerender(<IconPickerDialog isOpen onClose={props.onClose} onSelect={props.onSelect} />);
    });

    expect(screen.getByText("No icon selected")).toBeVisible();
    expect(screen.getByRole("button", { name: "Select Icon" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Select Node.js (logos:nodejs-icon)" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it("ignores an older response that resolves after the latest search", async () => {
    const older = deferredSearch();
    const latest = deferredSearch();
    vi.mocked(searchIcons).mockReturnValueOnce(older.promise).mockReturnValueOnce(latest.promise);
    await mount();
    const search = screen.getByRole("textbox", { name: "Search icons" });

    fireEvent.change(search, { target: { value: "react" } });
    await advanceSearch();
    expect(searchIcons).toHaveBeenCalledTimes(1);
    const olderSignal = vi.mocked(searchIcons).mock.calls[0]?.[3];
    expect(olderSignal?.aborted).toBe(false);

    fireEvent.change(search, { target: { value: "docker" } });
    expect(olderSignal?.aborted).toBe(true);
    await advanceSearch();
    expect(searchIcons).toHaveBeenCalledTimes(2);

    await act(async () => {
      latest.resolve({ icons: ["logos:docker-icon"], total: 1 });
      await latest.promise;
    });
    expect(screen.getByRole("button", { name: "Select logos:docker-icon" })).toBeVisible();

    // Deliberately resolve despite cancellation: the component must guard stale results too.
    await act(async () => {
      older.resolve({ icons: ["logos:react"], total: 99 });
      await older.promise;
    });
    expect(screen.getByRole("button", { name: "Select logos:docker-icon" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Select logos:react" })).not.toBeInTheDocument();
    expect(screen.getByText("Found 1 icon")).toBeVisible();
    expect(notify.error).not.toHaveBeenCalled();
  });
});
