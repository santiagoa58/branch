/**
 * HeroDiagram — the landing page's animated centerpiece, built around the
 * product's core thesis: not just *what* components exist, but *how data flows*.
 *
 * The diagram boots in a deliberately lifeless **"what" state** — gray boxes and
 * gray connector lines, the static picture most tools stop at — then blooms into
 * the **"how" state**: node accents and open-source Lucide icons regain color, protocol-tinted
 * edges light up, and request packets stream along every wire. The reveal
 * auto-plays once on mount, and the "What components exist / How data flows"
 * toggle lets a visitor flip between the two states on demand, so the difference
 * Branch adds is something they *feel*, not just read.
 *
 * Implementation note: the looping flow animations (the dashed "current" and the
 * traveling packets, both driven by GSAP's MotionPathPlugin — the same technique
 * the real editor uses in `useEdgeAnimation`) run continuously underneath but
 * start hidden. Switching state only tweens `opacity` / `filter`, never creates
 * or destroys the loops — so the loops are registered once inside `useGSAP` and
 * cleaned up automatically, and toggling stays cheap and flicker-free.
 *
 * The node cards intentionally mirror the real `ArchitectureNode`: a vertical
 * layout with a node-type-tinted icon chip on top, a bold display name, the
 * uppercase mono type label, a faint background tint, an accent glow, and the
 * four connection-handle dots. Edges + flow dots live in an SVG layer behind the
 * cards; both share the same 820×440 coordinate space, so percentage-positioned
 * cards line up with the SVG paths at any width.
 */
import { useEffect, useRef, useState } from "react";
import { Icon as IconifyIcon, loadIcons } from "@iconify/react";
import { gsap, useGSAP } from "@/lib/gsap";
import { cn } from "@/lib/utils";

// ── Coordinate space (matches the SVG viewBox) ───────────────────────────────
const W = 820;
const H = 440;
const NW = 150; // node width
const NH = 108; // node height (vertical layout, like the real node)

type Accent = "violet" | "purple" | "blue" | "emerald" | "red" | "amber";

interface DiagramNode {
  id: string;
  x: number;
  y: number;
  /** Display name (top, bold). */
  label: string;
  /** Node type — rendered uppercase/mono below the name, like the editor. */
  type: string;
  accent: Accent;
  /** Iconify icon id (Lucide icon) — same source the editor uses. */
  logo: string;
}

const NODES: DiagramNode[] = [
  {
    id: "client",
    x: 16,
    y: 186,
    label: "Web App",
    type: "Client",
    accent: "violet",
    logo: "lucide:monitor",
  },
  {
    id: "gateway",
    x: 232,
    y: 186,
    label: "API Gateway",
    type: "Gateway",
    accent: "purple",
    logo: "lucide:network",
  },
  {
    id: "auth",
    x: 452,
    y: 52,
    label: "Auth Service",
    type: "Service",
    accent: "blue",
    logo: "lucide:shield-check",
  },
  {
    id: "orders",
    x: 452,
    y: 320,
    label: "Orders Service",
    type: "Service",
    accent: "blue",
    logo: "lucide:server",
  },
  {
    id: "db",
    x: 654,
    y: 52,
    label: "PostgreSQL",
    type: "Database",
    accent: "emerald",
    logo: "lucide:database",
  },
  {
    id: "cache",
    x: 654,
    y: 186,
    label: "Redis",
    type: "Cache",
    accent: "red",
    logo: "lucide:hard-drive",
  },
  {
    id: "queue",
    x: 654,
    y: 320,
    label: "RabbitMQ",
    type: "Queue",
    accent: "amber",
    logo: "lucide:messages-square",
  },
];

interface DiagramEdge {
  from: string;
  to: string;
  /** Flow-dot color, keyed to the protocol (see PROTOCOL_CONFIG). */
  color: string;
}

const EDGES: DiagramEdge[] = [
  { from: "client", to: "gateway", color: "#60a5fa" }, // HTTP
  { from: "gateway", to: "auth", color: "#60a5fa" }, // HTTP
  { from: "gateway", to: "orders", color: "#60a5fa" }, // HTTP
  { from: "auth", to: "db", color: "#34d399" }, // gRPC
  { from: "auth", to: "cache", color: "#60a5fa" }, // HTTP
  { from: "orders", to: "cache", color: "#60a5fa" }, // HTTP
  { from: "orders", to: "queue", color: "#fbbf24" }, // AMQP
];

// Per-accent hex (drives the card border, glow and tint) + node-type chip classes
// mirroring `NODE_TYPES_CONFIG`'s `bgClass`/`borderClass`.
const ACCENT: Record<Accent, { hex: string; chipBg: string; chipBorder: string }> = {
  violet: { hex: "#a78bfa", chipBg: "bg-violet-500/10", chipBorder: "border-violet-500/20" },
  purple: { hex: "#c084fc", chipBg: "bg-purple-500/10", chipBorder: "border-purple-500/20" },
  blue: { hex: "#60a5fa", chipBg: "bg-blue-500/10", chipBorder: "border-blue-500/20" },
  emerald: { hex: "#34d399", chipBg: "bg-emerald-500/10", chipBorder: "border-emerald-500/20" },
  red: { hex: "#f87171", chipBg: "bg-red-500/10", chipBorder: "border-red-500/20" },
  amber: { hex: "#fbbf24", chipBg: "bg-amber-500/10", chipBorder: "border-amber-500/20" },
};

const nodeById = (id: string) => NODES.find((n) => n.id === id)!;

/** Smooth horizontal S-curve from a node's right edge to the next node's left edge. */
function edgePath(e: DiagramEdge): string {
  const s = nodeById(e.from);
  const t = nodeById(e.to);
  const sx = s.x + NW;
  const sy = s.y + NH / 2;
  const tx = t.x;
  const ty = t.y + NH / 2;
  const mx = (sx + tx) / 2;
  return `M ${sx},${sy} C ${mx},${sy} ${mx},${ty} ${tx},${ty}`;
}

const PATHS = EDGES.map(edgePath);

const prefersReducedMotion =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Phase = "what" | "how";

// First-paint values per phase. Non-reduced motion always opens on "what" so the
// reveal has somewhere to bloom from; reduced motion opens on a static "how".
const REST: Record<
  Phase,
  {
    nodeFilter: string;
    nodeOpacity: number;
    lineOpacity: number;
    packetOpacity: number;
    glowOpacity: number;
  }
> = {
  what: {
    nodeFilter: "grayscale(1)",
    nodeOpacity: 0.9,
    lineOpacity: 0,
    packetOpacity: 0,
    glowOpacity: 0,
  },
  how: {
    nodeFilter: "grayscale(0)",
    nodeOpacity: 1,
    lineOpacity: 0.5,
    packetOpacity: 1,
    glowOpacity: 1,
  },
};

const INITIAL_PHASE: Phase = prefersReducedMotion ? "how" : "what";
const initial = REST[INITIAL_PHASE];

/** A connection-handle dot, like the editor's React Flow handles. */
function Handle({ className }: { className: string }) {
  return (
    <span
      className={cn(
        "absolute h-2 w-2 rounded-full border-2 border-zinc-950 bg-zinc-700",
        className,
      )}
    />
  );
}

export function HeroDiagram({ className }: { className?: string }) {
  const scope = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>(INITIAL_PHASE);

  // Warm the Iconify cache for all open-source Lucide icons up front so they appear together
  // rather than popping in one-by-one as each <Icon> mounts.
  useEffect(() => {
    loadIcons(NODES.map((n) => n.logo));
  }, []);

  /**
   * Tween the diagram between the lifeless "what" picture and the living "how"
   * one. The looping flow tweens keep running underneath — we only fade the
   * color, the protocol-lit edges and the packets in or out.
   */
  function revealTo(next: Phase, delay = 0) {
    const r = REST[next];
    const tl = gsap.timeline({
      delay,
      defaults: { overwrite: "auto" },
      onStart: () => setPhase(next),
    });

    if (next === "how") {
      // Color blooms node-by-node, spreading left-to-right from the entry point.
      tl.fromTo(
        ".hero-node",
        { scale: 0.97 },
        {
          scale: 1,
          filter: r.nodeFilter,
          opacity: r.nodeOpacity,
          duration: 0.55,
          ease: "power2.out",
          stagger: 0.09,
        },
        0,
      )
        .to(".hero-glow", { opacity: r.glowOpacity, duration: 0.8 }, 0.1)
        .to(".hero-flow-line", { strokeOpacity: r.lineOpacity, duration: 0.5, stagger: 0.08 }, 0.3)
        .to(".hero-packet", { opacity: r.packetOpacity, duration: 0.4, stagger: 0.08 }, 0.5);
    } else {
      // Drain back to the static skeleton: packets first, then color.
      tl.to(".hero-packet", { opacity: r.packetOpacity, duration: 0.25 }, 0)
        .to(".hero-flow-line", { strokeOpacity: r.lineOpacity, duration: 0.3 }, 0)
        .to(".hero-glow", { opacity: r.glowOpacity, duration: 0.3 }, 0)
        .to(
          ".hero-node",
          { filter: r.nodeFilter, opacity: r.nodeOpacity, duration: 0.4, stagger: 0.05 },
          0.05,
        );
    }
    return tl;
  }

  const { contextSafe } = useGSAP(
    () => {
      // Establish the first-paint state here (not via React's `style` prop): this
      // callback runs as a layout effect *before* the browser paints, so there's
      // no flash — and because GSAP owns these props exclusively, a re-render
      // (e.g. the toggle's `setPhase`) can never clobber an in-flight animation.
      gsap.set(".hero-node", { filter: initial.nodeFilter, opacity: initial.nodeOpacity });
      gsap.set(".hero-flow-line", { strokeOpacity: initial.lineOpacity });
      gsap.set(".hero-packet", { opacity: initial.packetOpacity });
      gsap.set(".hero-glow", { opacity: initial.glowOpacity });

      if (prefersReducedMotion) {
        // Static "how" state: colored & protocol-lit, but no loops and no toggle.
        // Packets would otherwise sit frozen at the SVG origin, so hide them.
        gsap.set(".hero-packet", { opacity: 0 });
        return;
      }

      // The continuous "current" along the dashed edge overlays.
      gsap.to(".hero-flow-line", {
        strokeDashoffset: -16,
        duration: 0.8,
        ease: "none",
        repeat: -1,
      });

      // One traveling packet per edge, staggered so the whole graph feels alive.
      // Runs from the start (hidden) so the reveal just fades it into view.
      gsap.utils.toArray<SVGGElement>(".hero-packet").forEach((g) => {
        const i = Number(g.dataset["edge"]);
        const path = PATHS[i];
        if (!path) {
          return;
        }
        gsap.to(g, {
          motionPath: { path, autoRotate: false },
          duration: 1.7 + (i % 3) * 0.35,
          ease: "none",
          repeat: -1,
          delay: i * 0.28,
        });
      });

      // Hold on the lifeless "what" picture for a beat, then bloom into "how".
      revealTo("how", 0.7);
    },
    { scope },
  );

  const showWhat = contextSafe(() => revealTo("what"));
  const showHow = contextSafe(() => revealTo("how"));

  return (
    <div ref={scope} className={cn("w-full", className)}>
      {/* What ⇄ How toggle — the product thesis, made operable. Motion only. */}
      {!prefersReducedMotion && (
        <div className="mb-5 flex justify-center">
          <fieldset
            aria-label="Toggle what the diagram shows"
            className="inline-flex rounded-full border border-zinc-800 bg-zinc-900/80 p-0.5 backdrop-blur"
          >
            <button
              type="button"
              onClick={() => {
                showWhat();
              }}
              aria-pressed={phase === "what"}
              className={cn(
                "rounded-full px-3.5 py-1 text-xs font-medium transition-colors",
                phase === "what"
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              What components exist
            </button>
            <button
              type="button"
              onClick={() => {
                showHow();
              }}
              aria-pressed={phase === "how"}
              className={cn(
                "rounded-full px-3.5 py-1 text-xs font-medium transition-colors",
                phase === "how" ? "bg-blue-500 text-white" : "text-zinc-500 hover:text-zinc-300",
              )}
            >
              How data flows
            </button>
          </fieldset>
        </div>
      )}

      {/* Diagram visuals (decorative). */}
      <div
        className="relative w-full aspect-[820/440] select-none"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(63,63,70,0.5) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
        aria-hidden="true"
      >
        {/* Ambient "it's alive" glow — fades in with the "how" state.
            Opacity is owned by GSAP (set pre-paint in useGSAP). */}
        <div className="hero-glow pointer-events-none absolute left-1/2 top-1/2 h-3/4 w-3/4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-3xl" />

        {/* Edge + packet layer */}
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full overflow-visible">
          {EDGES.map((e, i) => (
            <g key={`${e.from}-${e.to}`}>
              {/* base line — the static skeleton, visible in both states */}
              <path d={PATHS[i]} fill="none" stroke="#3f3f46" strokeWidth={1.5} />
              {/* protocol-colored overlay — lit only in the "how" state */}
              <path
                className="hero-flow-line"
                d={PATHS[i]}
                fill="none"
                stroke={e.color}
                strokeWidth={1.5}
                strokeDasharray="2 6"
                strokeLinecap="round"
              />
            </g>
          ))}

          {/* traveling packets (a glow halo + bright core, moved together) */}
          {EDGES.map((e, i) => (
            <g className="hero-packet" data-edge={i} key={`packet-${e.from}-${e.to}`}>
              <circle r={6} fill={e.color} opacity={0.25} />
              <circle r={2.75} fill={e.color} />
            </g>
          ))}
        </svg>

        {/* Node cards — mirror the real ArchitectureNode layout */}
        {NODES.map((n) => {
          const a = ACCENT[n.accent];
          return (
            <div
              key={n.id}
              className="hero-node absolute"
              style={{
                left: `${(n.x / W) * 100}%`,
                top: `${(n.y / H) * 100}%`,
                width: `${(NW / W) * 100}%`,
                height: `${(NH / H) * 100}%`,
              }}
            >
              <div
                className="relative flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl border bg-zinc-900/90 p-3 backdrop-blur-sm"
                style={{ borderColor: `${a.hex}66`, boxShadow: `0 0 28px -8px ${a.hex}99` }}
              >
                {/* faint background tint (like the node's backgroundColor overlay) */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-xl"
                  style={{ backgroundColor: `${a.hex}1f` }}
                />

                {/* connection handles */}
                <Handle className="left-1/2 top-0 -translate-x-1/2 -translate-y-1/2" />
                <Handle className="bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2" />
                <Handle className="left-0 top-1/2 -translate-x-1/2 -translate-y-1/2" />
                <Handle className="right-0 top-1/2 -translate-y-1/2 translate-x-1/2" />

                {/* icon chip (node-type tinted) */}
                <div className={cn("relative rounded-lg border p-2.5", a.chipBg, a.chipBorder)}>
                  <IconifyIcon icon={n.logo} className="h-5 w-5" />
                </div>

                {/* name + type */}
                <div className="relative flex flex-col items-center text-center leading-none">
                  <span className="text-xs font-semibold text-zinc-100">{n.label}</span>
                  <span className="mt-1 font-mono text-[9px] uppercase tracking-tight text-zinc-500">
                    {n.type}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
