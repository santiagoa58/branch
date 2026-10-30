import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ThemeToggle } from "./ThemeToggle";
import { initializeTheme, useThemeStore } from "@/store/themeStore";

beforeEach(() => {
  useThemeStore.getState().setTheme("light");
  vi.spyOn(localStorage, "setItem").mockClear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useThemeStore.getState().setTheme("system");
});

describe("application theme toggle", () => {
  it.each(["light", "dark"] as const)(
    "switches from %s and persists only the store's preference",
    (theme) => {
      useThemeStore.getState().setTheme(theme);
      const persist = vi.spyOn(localStorage, "setItem").mockClear();
      const opposite = theme === "dark" ? "light" : "dark";
      render(<ThemeToggle />);

      fireEvent.click(screen.getByRole("button", { name: `Switch to ${opposite} theme` }));

      expect(useThemeStore.getState().theme).toBe(opposite);
      expect(useThemeStore.getState().resolvedTheme).toBe(opposite);
      expect(document.documentElement).toHaveClass(opposite);
      expect(document.documentElement).not.toHaveClass(theme);
      expect(document.documentElement.style.colorScheme).toBe(opposite);
      expect(screen.getByRole("button", { name: `Switch to ${theme} theme` })).toBeVisible();
      expect(persist).toHaveBeenCalledExactlyOnceWith(
        "theme-storage",
        JSON.stringify({ state: { theme: opposite }, version: 0 }),
      );
    },
  );

  it("switches system dark to light on the first click instead of cycling to another dark state", () => {
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
    const persist = vi.spyOn(localStorage, "setItem").mockClear();
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));

    expect(useThemeStore.getState().theme).toBe("light");
    expect(document.documentElement).toHaveClass("light");
    expect(persist).toHaveBeenCalledExactlyOnceWith(
      "theme-storage",
      JSON.stringify({ state: { theme: "light" }, version: 0 }),
    );
  });

  it("tracks system changes until the user makes an explicit choice", () => {
    let dark = false;
    const target = new EventTarget();
    vi.spyOn(window, "matchMedia").mockImplementation((media) => ({
      get matches() {
        return media === "(prefers-color-scheme: dark)" && dark;
      },
      media,
      onchange: null,
      addListener: vi.fn<MediaQueryList["addListener"]>(),
      removeListener: vi.fn<MediaQueryList["removeListener"]>(),
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
      dispatchEvent: target.dispatchEvent.bind(target),
    }));
    useThemeStore.getState().setTheme("system");
    const dispose = initializeTheme();
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeVisible();

    act(() => {
      dark = true;
      target.dispatchEvent(new Event("change"));
    });
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
    expect(useThemeStore.getState().theme).toBe("system");
    fireEvent.click(screen.getByRole("button", { name: "Switch to light theme" }));
    act(() => {
      target.dispatchEvent(new Event("change"));
    });
    expect(useThemeStore.getState().theme).toBe("light");
    expect(useThemeStore.getState().resolvedTheme).toBe("light");
    dispose();
  });

  it("keeps all mounted toggles synchronized without a reload", () => {
    render(
      <>
        <ThemeToggle />
        <ThemeToggle />
      </>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Switch to dark theme" })[0]!);

    expect(screen.getAllByRole("button", { name: "Switch to light theme" })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Switch to light theme" })[1]!);
    expect(screen.getAllByRole("button", { name: "Switch to dark theme" })).toHaveLength(2);
  });
});
