import { useEffect, useState } from "react";
import { layoutTemplate, type DiagramTemplate } from "@/templates";
import type { DiagramData } from "@/types";

/** A template's laid-out data once auto-layout has run for it, else null (also on failure). */
export function useTemplateLayout(template: DiagramTemplate, enabled = true): DiagramData | null {
  const [laidOut, setLaidOut] = useState<{ source: DiagramTemplate; result: DiagramTemplate } | null>(
    null,
  );
  useEffect(() => {
    if (!enabled) {
      return;
    }
    let active = true;
    layoutTemplate(template)
      .then((result) => {
        if (active) {
          setLaidOut({ source: template, result });
        }
      })
      .catch(() => {
        // The preview stays empty; loading the template reports the failure.
      });
    return () => {
      active = false;
    };
  }, [template, enabled]);
  return enabled && laidOut?.source === template ? laidOut.result.data : null;
}
