import { useMemo } from "react";
import { useNodes, useViewport } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { zoneBands } from "@/utils/layout/zones";

const LABEL_INSET = 16;

/**
 * Labeled background bands for the auto-layout zones (clients, edge, services, async, data),
 * drawn behind the canvas from the current node positions, with a stronger divider between the
 * client side and the server side. Display-only: nothing is stored or saved. Render it inside
 * `<ReactFlow>`; it pans and zooms with the viewport and shows nothing when zones do not apply.
 */
export function ZoneBands({ className }: { className?: string }) {
  const nodes = useNodes();
  const { x, y, zoom } = useViewport();
  const zones = useMemo(() => zoneBands(nodes), [nodes]);
  if (!zones) {
    return null;
  }
  const { bands, top, height, divider } = zones;
  return (
    <svg
      aria-hidden="true"
      data-testid="zone-bands"
      className={cn("pointer-events-none absolute inset-0 z-0 size-full", className)}
    >
      <g transform={`translate(${x} ${y}) scale(${zoom})`}>
        {bands.map((band, index) => (
          <g key={band.zone} data-zone={band.zone}>
            <rect
              x={band.x}
              y={top}
              width={band.width}
              height={height}
              rx={24}
              fill={index % 2 === 0 ? "var(--zone-band)" : "var(--zone-band-alt)"}
              stroke="var(--zone-border)"
              strokeWidth={1}
            />
            <text
              x={band.x + LABEL_INSET}
              y={top + 28}
              fill="var(--zone-label)"
              fontSize={13}
              fontWeight={600}
              letterSpacing={1.5}
            >
              {band.label.toUpperCase()}
            </text>
          </g>
        ))}
        {divider !== undefined && (
          <g data-testid="client-server-divider">
            <line
              x1={divider}
              x2={divider}
              y1={top - 36}
              y2={top + height}
              stroke="var(--zone-divider)"
              strokeWidth={2}
              strokeDasharray="10 6"
            />
            <text
              x={divider - LABEL_INSET}
              y={top - 14}
              textAnchor="end"
              fill="var(--zone-label)"
              fontSize={13}
              fontWeight={600}
            >
              Client side
            </text>
            <text
              x={divider + LABEL_INSET}
              y={top - 14}
              fill="var(--zone-label)"
              fontSize={13}
              fontWeight={600}
            >
              Server side
            </text>
          </g>
        )}
      </g>
    </svg>
  );
}
