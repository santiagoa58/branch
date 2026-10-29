import { create } from "zustand";
import { persist } from "zustand/middleware";
import { persistedThemeStoreSchema, themeStateSchema, type Theme } from "@/schemas/persistence";

interface ThemeStore {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
    }),
    {
      name: "theme-storage",
      merge: (persistedState, currentState) => {
        const result = themeStateSchema.safeParse(persistedState);
        return result.success ? { ...currentState, ...result.data } : currentState;
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.theme);
        }
      },
    },
  ),
);

function applyTheme(theme: Theme) {
  const root = window.document.documentElement;
  root.classList.remove("light", "dark");

  if (theme === "system") {
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    root.classList.add(systemTheme);
  } else {
    root.classList.add(theme);
  }
}

// Initialize theme on load
if (typeof window !== "undefined") {
  const stored = localStorage.getItem("theme-storage");
  if (stored) {
    try {
      const rawState: unknown = JSON.parse(stored);
      const result = persistedThemeStoreSchema.safeParse(rawState);
      applyTheme(result.success ? result.data.state.theme : "system");
    } catch {
      applyTheme("system");
    }
  } else {
    applyTheme("system");
  }
}
