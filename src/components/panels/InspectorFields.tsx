import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useEditBlocked } from "@/store/editLock";

/**
 * The inspector's editable body. While edits are blocked, such as during an AI run, the fieldset
 * disables every input, select and button inside it, so the selection reads as read-only; the
 * header's close button and the tabs sit outside and keep working.
 */
export function InspectorFields({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const editBlocked = useEditBlocked();
  return (
    <fieldset disabled={editBlocked} className={cn("m-0 min-w-0 border-0", className)}>
      {children}
    </fieldset>
  );
}
