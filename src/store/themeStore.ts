import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { themeStateSchema, type Theme } from "@/schemas/persistence";

type ResolvedTheme = Exclude<Theme, "system">;

interface ThemeStore {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "system"
    ? typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
    : theme;
}

function applyTheme(theme: ResolvedTheme) {
  if (typeof document === "undefined") {
    return;
  }
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.style.colorScheme = theme;
}

// Preferences are optional: blocked or full storage must not prevent theme changes.
const storage = createJSONStorage(() => ({
  getItem: (name: string) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // Keep the selected theme in memory when persistence is unavailable.
    }
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // Storage may be disabled by browser privacy settings.
    }
  },
}));

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: "system",
      resolvedTheme: resolveTheme("system"),
      setTheme: (theme) => {
        const resolvedTheme = resolveTheme(theme);
        applyTheme(resolvedTheme);
        set({ theme, resolvedTheme });
      },
    }),
    {
      name: "theme-storage",
      storage,
      partialize: ({ theme }) => ({ theme }),
      merge: (persistedState, currentState) => {
        const result = themeStateSchema.safeParse(persistedState);
        const theme = result.success ? result.data.theme : currentState.theme;
        return { ...currentState, theme, resolvedTheme: resolveTheme(theme) };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.resolvedTheme);
        }
      },
    },
  ),
);

/** One application-wide owner for system preference changes, including before auth. */
export function initializeTheme() {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const update = () => {
    const { theme } = useThemeStore.getState();
    const resolvedTheme = resolveTheme(theme);
    applyTheme(resolvedTheme);
    if (useThemeStore.getState().resolvedTheme !== resolvedTheme) {
      useThemeStore.setState({ resolvedTheme });
    }
  };
  update();
  query.addEventListener("change", update);
  return () => query.removeEventListener("change", update);
}
