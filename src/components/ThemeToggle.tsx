import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { useThemeStore } from "@/store/themeStore";

/** Keep Magic UI controlled so the root, editor, and persisted preference share one theme. */
export function ThemeToggle() {
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const label = `Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`;

  return (
    <AnimatedThemeToggler
      theme={resolvedTheme}
      onThemeChange={setTheme}
      duration={500}
      aria-label={label}
      title={label}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-foreground hover:bg-accent active:scale-95 transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&_svg]:size-4"
    />
  );
}
