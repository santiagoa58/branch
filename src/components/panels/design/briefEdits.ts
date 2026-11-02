import type { DesignBrief } from "@/schemas/aiDesign";
import { useDiagramStore } from "@/store/diagramStore";

/** Ids for input lines and answers the panel adds. */
export const newId = () => crypto.randomUUID();

/** Applies a user edit to the open brief (one history entry; ignored while editing is locked). */
export function editBrief(edit: (brief: DesignBrief) => DesignBrief): void {
  useDiagramStore.getState().updateBrief((brief) => (brief ? edit(brief) : brief));
}

/** Shared text styles for the panel's section labels and tags. */
export const sectionLabelClass =
  "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
export const tagClass =
  "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
export const inputClass =
  "w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
