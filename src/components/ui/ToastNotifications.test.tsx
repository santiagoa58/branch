import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { sileo } from "sileo";
import { notify, type NotifyType } from "@/services/notify";
import { initializeTheme, useThemeStore } from "@/store/themeStore";
import { ToastNotifications } from "./ToastNotifications";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn<ResizeObserver["observe"]>();
      unobserve = vi.fn<ResizeObserver["unobserve"]>();
      disconnect = vi.fn<ResizeObserver["disconnect"]>();
    },
  );
  useThemeStore.getState().setTheme("light");
});

afterEach(() => {
  act(() => sileo.clear());
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useThemeStore.getState().setTheme("system");
});

function expectThemedToast(container: HTMLElement, theme: "light" | "dark") {
  expect(container.querySelector("[data-sileo-viewport]")).toHaveAttribute("data-theme", theme);
  expect(container.querySelector("[data-sileo-pill]")).toHaveAttribute("fill", "var(--popover)");
  expect(container.querySelector("[data-sileo-body]")).toHaveAttribute("fill", "var(--popover)");
  expect(container.querySelector("[data-sileo-title]")).toHaveClass("text-popover-foreground!");
  expect(container.querySelector("[data-sileo-description]")).toHaveClass("text-muted-foreground!");
  expect(container.querySelector("[data-sileo-badge]")).toHaveClass("bg-muted!");
}

describe("toast notification themes", () => {
  it.each(["light", "dark"] as const)("uses app palette tokens in %s mode", (theme) => {
    useThemeStore.getState().setTheme(theme);
    const { container } = render(<ToastNotifications />);

    act(() => {
      notify.success({ title: "Diagram saved", message: "All changes are saved.", duration: null });
    });

    expectThemedToast(container, theme);
    expect(container.querySelector("[data-sileo-title]")).toHaveTextContent("Diagram saved");
  });

  it.each<NotifyType>(["success", "error", "warning", "info"])(
    "preserves the %s status while using the app palette",
    (type) => {
      const { container } = render(<ToastNotifications />);

      act(() => {
        notify.show(type, { title: "Notification", message: "Details", duration: null });
      });

      expectThemedToast(container, "light");
      expect(container.querySelector("[data-sileo-badge]")).toHaveAttribute("data-state", type);
    },
  );

  it("updates an existing toast when the application theme changes", () => {
    const { container } = render(<ToastNotifications />);
    act(() => {
      notify.info({ title: "Export ready", message: "Your diagram is ready.", duration: null });
    });
    const toast = container.querySelector("[data-sileo-toast]");

    for (const theme of ["dark", "light"] as const) {
      act(() => useThemeStore.getState().setTheme(theme));

      expectThemedToast(container, theme);
      expect(container.querySelector("[data-sileo-toast]")).toBe(toast);
    }
  });

  it("uses the resolved application theme for system preferences", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((media) => ({
      matches: media === "(prefers-color-scheme: dark)",
      media,
      onchange: null,
      addListener: vi.fn<MediaQueryList["addListener"]>(),
      removeListener: vi.fn<MediaQueryList["removeListener"]>(),
      addEventListener: vi.fn<MediaQueryList["addEventListener"]>(),
      removeEventListener: vi.fn<MediaQueryList["removeEventListener"]>(),
      dispatchEvent: vi.fn<MediaQueryList["dispatchEvent"]>().mockReturnValue(false),
    }));
    useThemeStore.getState().setTheme("system");
    const dispose = initializeTheme();
    const { container } = render(<ToastNotifications />);
    act(() => {
      notify.warning({ title: "Unsaved changes", message: "Please try again.", duration: null });
    });

    expectThemedToast(container, "dark");
    expect(useThemeStore.getState()).toMatchObject({ theme: "system", resolvedTheme: "dark" });
    dispose();
  });

  it("themes action buttons using semantic tokens", () => {
    const { container } = render(<ToastNotifications />);
    act(() => {
      sileo.action({
        title: "Export ready",
        description: "Download your diagram.",
        duration: null,
        button: { title: "Download", onClick: vi.fn<() => void>() },
      });
    });

    expect(container.querySelector("[data-sileo-button]")).toHaveClass(
      "bg-secondary!",
      "text-secondary-foreground!",
      "hover:bg-accent!",
    );
  });
});
