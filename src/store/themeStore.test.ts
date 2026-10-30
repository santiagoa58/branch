import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { initializeTheme, useThemeStore } from "./themeStore";

describe("theme persistence", () => {
  beforeEach(() => {
    vi.spyOn(localStorage, "getItem").mockReset();
    useThemeStore.getState().setTheme("system");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not hydrate unknown storage keys over store actions", async () => {
    vi.spyOn(localStorage, "getItem").mockReturnValue(
      JSON.stringify({
        state: { theme: "dark", setTheme: "not a function" },
        version: 0,
      }),
    );
    await useThemeStore.persist.rehydrate();
    expect(typeof useThemeStore.getState().setTheme).toBe("function");
    expect(useThemeStore.getState().theme).toBe("system");
  });

  it("hydrates a supported theme", async () => {
    vi.spyOn(localStorage, "getItem").mockReturnValue(
      JSON.stringify({ state: { theme: "dark" }, version: 0 }),
    );
    await useThemeStore.persist.rehydrate();
    expect(useThemeStore.getState().theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(useThemeStore.getState().resolvedTheme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });

  it("applies exclusive root classes and native control color schemes", () => {
    for (const theme of ["dark", "light"] as const) {
      useThemeStore.getState().setTheme(theme);
      expect(document.documentElement.classList.contains(theme)).toBe(true);
      expect(document.documentElement.classList.contains(theme === "dark" ? "light" : "dark")).toBe(
        false,
      );
      expect(document.documentElement.style.colorScheme).toBe(theme);
      expect(useThemeStore.getState().resolvedTheme).toBe(theme);
    }
  });

  it("reacts to OS changes only in system mode and cleans up its listener", () => {
    let dark = false;
    const target = new EventTarget();
    const removeListener = vi.spyOn(target, "removeEventListener");
    vi.spyOn(window, "matchMedia").mockImplementation((media) => ({
      media,
      get matches() {
        return dark;
      },
      onchange: null,
      addListener: vi.fn<MediaQueryList["addListener"]>(),
      removeListener: vi.fn<MediaQueryList["removeListener"]>(),
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
      dispatchEvent: () => true,
    }));
    useThemeStore.getState().setTheme("system");
    const dispose = initializeTheme();
    expect(useThemeStore.getState().resolvedTheme).toBe("light");
    dark = true;
    target.dispatchEvent(new Event("change"));
    expect(useThemeStore.getState().resolvedTheme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    useThemeStore.getState().setTheme("light");
    target.dispatchEvent(new Event("change"));
    expect(useThemeStore.getState().resolvedTheme).toBe("light");
    dispose();
    expect(removeListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("keeps a working theme when storage is blocked", async () => {
    vi.spyOn(localStorage, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    await useThemeStore.persist.rehydrate();
    expect(() => useThemeStore.getState().setTheme("dark")).not.toThrow();
    expect(useThemeStore.getState().resolvedTheme).toBe("dark");
  });

  it("rejects malformed storage and persists only the preference", async () => {
    vi.spyOn(localStorage, "getItem").mockReturnValue("not json");
    await useThemeStore.persist.rehydrate();
    expect(useThemeStore.getState().theme).toBe("system");
    const setItem = vi.spyOn(localStorage, "setItem");
    useThemeStore.getState().setTheme("light");
    expect(setItem).toHaveBeenLastCalledWith(
      "theme-storage",
      JSON.stringify({ state: { theme: "light" }, version: 0 }),
    );
  });
});
