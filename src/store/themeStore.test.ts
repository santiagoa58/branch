import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { useThemeStore } from "./themeStore";

describe("theme persistence", () => {
  beforeEach(() => {
    vi.spyOn(localStorage, "getItem").mockReset();
    useThemeStore.setState({ theme: "system" });
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
  });
});
