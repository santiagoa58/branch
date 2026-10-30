import { cn } from "@/lib/utils";

export type InspectorTab = "basics" | "design" | "advanced" | "contract";

export interface InspectorTabItem {
  id: InspectorTab;
  label: string;
  /** Indicates a section already contains user-authored content. */
  populated?: boolean;
}

interface InspectorTabsProps {
  items: readonly InspectorTabItem[];
  value: InspectorTab;
  onChange: (tab: InspectorTab) => void;
}

/** Compact navigation stays visible while the inspector body scrolls. */
export function InspectorTabs({ items, value, onChange }: InspectorTabsProps) {
  return (
    <nav
      aria-label="Property sections"
      className="shrink-0 border-b border-zinc-200 dark:border-zinc-800 px-3 py-2"
    >
      <div className="flex items-center gap-1 rounded-lg bg-zinc-100/80 dark:bg-zinc-900 p-1">
        {items.map((item) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={value === item.id}
            onClick={() => onChange(item.id)}
            className={cn(
              "min-w-0 flex-1 rounded-md px-2 py-2 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500",
              value === item.id
                ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm"
                : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white",
            )}
          >
            <span className="inline-flex items-center justify-center gap-1">
              <span className="truncate">{item.label}</span>
              {item.populated && (
                <span
                  aria-label="Has content"
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                />
              )}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
}
