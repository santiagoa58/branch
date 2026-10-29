/**
 * SimModePreview + SimModeCard — turn each simulation-mode description into a
 * tiny working demo of that mode, played on hover/focus.
 *
 * All four share one mini topology (entry → hub → two leaves) and differ only in
 * what the GSAP timeline does to it:
 *   flow      — a protocol-colored packet streams entry → hub → leaf
 *   cascade   — failure ripples downstream, nodes turning red in sequence
 *   partition — a divider severs the graph; the stranded leaves dim out
 *   chaos     — nodes flicker red / green / idle at random
 *
 * The animation only runs while the card is hovered/focused (the `active` prop);
 * a `gsap.context` is reverted on teardown, restoring the idle gray state. The
 * whole thing is decorative (aria-hidden) and inert under reduced motion.
 */
import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import type { SimMode } from "@/constants/landing";

const prefersReducedMotion =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ── Mini topology (matches the SVG viewBox) ──────────────────────────────────
const VW = 96;
const VH = 56;
const R = 5.5;
const N = {
  a: { x: 13, y: 28 }, // entry
  b: { x: 42, y: 28 }, // hub
  c: { x: 73, y: 13 }, // leaf (top)
  d: { x: 73, y: 43 }, // leaf (bottom)
} as const;
const EDGES: [keyof typeof N, keyof typeof N][] = [
  ["a", "b"],
  ["b", "c"],
  ["b", "d"],
];

const IDLE = "#52525b"; // zinc-600
const FAIL = "#f87171"; // red-400
const OK = "#34d399"; // emerald-400

export function SimModePreview({
  kind,
  color,
  active,
}: {
  kind: SimMode["kind"];
  color: string;
  active: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion || !active) {
      return;
    }

    const q = gsap.utils.selector(root);
    const ctx = gsap.context(() => {
      switch (kind) {
        case "flow": {
          const packet = q(".pv-packet");
          gsap.set(packet, { x: N.a.x, y: N.a.y, opacity: 1 });
          gsap
            .timeline({ repeat: -1, repeatDelay: 0.25 })
            .to(packet, {
              motionPath: {
                path: [N.a, N.b, N.c],
                autoRotate: false,
                curviness: 0,
              },
              duration: 1.1,
              ease: "power1.inOut",
            })
            .to(packet, { opacity: 0, duration: 0.18 })
            .set(packet, { x: N.a.x, y: N.a.y, opacity: 1 });
          break;
        }
        case "cascade": {
          gsap
            .timeline({ repeat: -1, repeatDelay: 0.5 })
            .to(q('[data-id="b"]'), { fill: FAIL, duration: 0.2 })
            .to(
              [q('[data-id="c"]'), q('[data-id="d"]')],
              { fill: FAIL, duration: 0.2, stagger: 0.15 },
              ">-0.05",
            )
            .to(q(".pv-node"), { fill: IDLE, duration: 0.35 }, "+=0.45");
          break;
        }
        case "partition": {
          // Vertical divider: scale on Y (grow from its center), not X.
          gsap.set(q(".pv-split"), {
            opacity: 0,
            scaleY: 0,
            svgOrigin: `${(N.b.x + N.c.x) / 2} ${VH / 2}`,
          });
          gsap
            .timeline({ repeat: -1, yoyo: true, repeatDelay: 0.5 })
            .to(q(".pv-split"), { opacity: 1, scaleY: 1, duration: 0.4, ease: "power2.out" })
            .to(
              [
                q('[data-id="c"]'),
                q('[data-id="d"]'),
                q('[data-edge="bc"]'),
                q('[data-edge="bd"]'),
              ],
              { opacity: 0.2, duration: 0.4 },
              "<",
            );
          break;
        }
        case "chaos": {
          gsap.timeline({ repeat: -1, repeatRefresh: true }).to(q(".pv-node"), {
            fill: () => gsap.utils.random([FAIL, OK, IDLE, IDLE]),
            duration: 0.3,
            ease: "none",
            stagger: { each: 0.13, from: "random" },
          });
          break;
        }
      }
    }, root);

    return () => ctx.revert(); // restore the idle gray state
  }, [active, kind]);

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${VW} ${VH}`}
      className="hidden h-12 w-[96px] shrink-0 sm:block"
      aria-hidden="true"
    >
      {EDGES.map(([f, t]) => (
        <line
          key={`${f}${t}`}
          className="pv-edge"
          data-edge={`${f}${t}`}
          x1={N[f].x}
          y1={N[f].y}
          x2={N[t].x}
          y2={N[t].y}
          stroke={IDLE}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      ))}

      {/* partition divider — drawn only for that mode */}
      {kind === "partition" && (
        <line
          className="pv-split"
          x1={(N.b.x + N.c.x) / 2}
          y1={5}
          x2={(N.b.x + N.c.x) / 2}
          y2={VH - 5}
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray="3 3"
          strokeLinecap="round"
        />
      )}

      {(Object.keys(N) as (keyof typeof N)[]).map((id) => (
        <circle
          key={id}
          className="pv-node"
          data-id={id}
          cx={N[id].x}
          cy={N[id].y}
          r={R}
          fill={IDLE}
        />
      ))}

      {/* flow packet — positioned by GSAP via transform (cx/cy stay at origin) */}
      {kind === "flow" && <circle className="pv-packet" r={3.25} fill={color} opacity={0} />}
    </svg>
  );
}

export function SimModeCard({ mode }: { mode: SimMode }) {
  const [active, setActive] = useState(false);

  return (
    <button
      type="button"
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      className="flex items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 outline-none transition-colors hover:border-zinc-700 focus-visible:border-zinc-600"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: mode.color, boxShadow: `0 0 12px ${mode.color}` }}
          />
          <p className="text-sm font-medium text-zinc-100">{mode.title}</p>
        </div>
        <p className="mt-1 text-sm leading-snug text-zinc-500">{mode.desc}</p>
      </div>
      <SimModePreview kind={mode.kind} color={mode.color} active={active} />
    </button>
  );
}
