import type { ArchitectureEdgeData } from "@/types";
import type { PortPreference } from "@/utils/layout/ports";

const OPTIONS: { value: PortPreference; label: string }[] = [
  { value: "auto", label: "Auto (nearest)" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
];

/** Set endpoint sides explicitly, or allow auto-format to choose based on geometry. */
export function ConnectionPortsEditor({
  data,
  onChange,
}: {
  data: ArchitectureEdgeData;
  onChange: (patch: Partial<ArchitectureEdgeData>) => void;
}) {
  return (
    <section aria-label="Connection attachment sides" className="space-y-2">
      <h3 className="text-xs font-semibold text-foreground">Connection sides</h3>
      <p className="text-xs text-muted-foreground">
        Auto uses the nearest facing sides. Pin either endpoint for a clearer route.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {(["sourceSide", "targetSide"] as const).map((key) => (
          <label key={key} className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
            {key === "sourceSide" ? "From" : "To"}
            <select
              aria-label={key === "sourceSide" ? "Source side" : "Target side"}
              value={data[key] ?? "auto"}
              onChange={(event) => onChange({ [key]: event.target.value })}
              onKeyDown={(event) => event.stopPropagation()}
              className="min-w-0 rounded-md border border-input bg-background px-2 py-2 text-sm text-foreground"
            >
              {OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}
