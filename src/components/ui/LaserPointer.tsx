import { useEffect, useRef, useCallback } from "react";

interface TrailPoint {
  x: number;
  y: number;
  time: number;
}

const TRAIL_LIFETIME_MS = 1000;
const TRAIL_COLOR = "#ef4444";
const DOT_RADIUS = 4;

interface LaserPointerProps {
  active: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
}

export function LaserPointer({ active, containerRef }: LaserPointerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const trailRef = useRef<TrailPoint[]>([]);
  const rafRef = useRef<number>(0);
  const cursorRef = useRef<{ x: number; y: number } | null>(null);

  const render = useCallback(function renderFrame() {
    const svg = svgRef.current;
    if (!svg) {
      return;
    }

    const now = Date.now();
    // Remove expired points
    trailRef.current = trailRef.current.filter((p) => now - p.time < TRAIL_LIFETIME_MS);

    const trail = trailRef.current;
    const cursor = cursorRef.current;

    // Build path segments with varying opacity
    let pathD = "";
    const circles: { cx: number; cy: number; opacity: number; r: number }[] = [];

    if (trail.length >= 2) {
      for (let i = 1; i < trail.length; i++) {
        const prev = trail[i - 1];
        const curr = trail[i];
        if (!prev || !curr) {
          continue;
        }
        const age = now - curr.time;
        const opacity = Math.max(0, 1 - age / TRAIL_LIFETIME_MS);

        // We'll render individual line segments via the circles array for simplicity
        circles.push({ cx: curr.x, cy: curr.y, opacity, r: 2.5 * opacity + 0.5 });

        if (i === 1) {
          pathD = `M ${prev.x} ${prev.y}`;
        }
        pathD += ` L ${curr.x} ${curr.y}`;
      }
    }

    // Build SVG content
    let html = `<defs>
      <filter id="laser-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <filter id="dot-glow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="4" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>`;

    // Trail circles (fading dots along the path)
    for (const c of circles) {
      html += `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" fill="${TRAIL_COLOR}" opacity="${c.opacity}" filter="url(#laser-glow)"/>`;
    }

    // Trail line
    if (trail.length >= 2) {
      // Render multiple line segments with per-segment opacity
      for (let i = 1; i < trail.length; i++) {
        const prev = trail[i - 1];
        const curr = trail[i];
        if (!prev || !curr) {
          continue;
        }
        const age = now - curr.time;
        const opacity = Math.max(0, 1 - age / TRAIL_LIFETIME_MS);
        html += `<line x1="${prev.x}" y1="${prev.y}" x2="${curr.x}" y2="${curr.y}" stroke="${TRAIL_COLOR}" stroke-width="${2 * opacity + 0.5}" stroke-opacity="${opacity}" stroke-linecap="round" filter="url(#laser-glow)"/>`;
      }
    }

    // Cursor dot
    if (cursor) {
      html += `<circle cx="${cursor.x}" cy="${cursor.y}" r="${DOT_RADIUS}" fill="${TRAIL_COLOR}" filter="url(#dot-glow)"/>`;
      html += `<circle cx="${cursor.x}" cy="${cursor.y}" r="${DOT_RADIUS * 0.5}" fill="white" opacity="0.8"/>`;
    }

    svg.innerHTML = html;

    rafRef.current = requestAnimationFrame(renderFrame);
  }, []);

  useEffect(() => {
    if (!active) {
      trailRef.current = [];
      cursorRef.current = null;
      if (svgRef.current) {
        svgRef.current.innerHTML = "";
      }
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const bounds = container.getBoundingClientRect();
      const x = e.clientX - bounds.left;
      const y = e.clientY - bounds.top;
      cursorRef.current = { x, y };
      trailRef.current.push({ x, y, time: Date.now() });
    };

    const handleMouseLeave = () => {
      cursorRef.current = null;
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);

    // Start render loop
    rafRef.current = requestAnimationFrame(render);

    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(rafRef.current);
    };
  }, [active, containerRef, render]);

  if (!active) {
    return null;
  }

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-30"
      style={{ cursor: "none" }}
    />
  );
}
