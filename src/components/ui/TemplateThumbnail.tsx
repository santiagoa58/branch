import type { DiagramTemplate } from "@/templates";
import { cn } from "@/lib/utils";
import { NODE_TYPES_CONFIG } from "@/constants";
import type { ArchitectureNodeType } from "@/types";

/** Lightweight card summaries: only the selected template should trigger an ELK layout. */
export function TemplateThumbnail({ template }: { template: DiagramTemplate }) {
  const components = template.data.nodes.filter((node) => node.type === "architecture");
  return (
    <span className="flex h-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5" aria-hidden="true">
        {components.slice(0, 7).map((node) => {
          const type = node.data["type"] as ArchitectureNodeType;
          return (
            <span
              key={node.id}
              className={cn(
                "size-5 rounded-md bg-current opacity-70",
                NODE_TYPES_CONFIG[type]?.iconColor ?? "text-zinc-500",
              )}
            />
          );
        })}
      </span>
      <span>{components.length} components · {template.data.edges.length} connections</span>
    </span>
  );
}
