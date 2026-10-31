import { Toaster, type SileoOptions } from "sileo";
import { useThemeStore } from "@/store/themeStore";

const options = {
  // Sileo's default surfaces contrast with the page theme instead of matching it.
  fill: "var(--popover)",
  roundness: 12,
  styles: {
    title: "text-sm font-semibold text-popover-foreground!",
    description: "text-sm text-muted-foreground!",
    badge: "bg-muted!",
    button:
      "bg-secondary! text-secondary-foreground! hover:bg-accent! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
  },
} satisfies SileoOptions;

export function ToastNotifications() {
  const theme = useThemeStore((state) => state.resolvedTheme);

  return (
    <Toaster position="top-right" offset={{ top: 16, right: 16 }} theme={theme} options={options} />
  );
}
