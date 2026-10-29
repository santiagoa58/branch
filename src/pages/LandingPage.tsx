/**
 * LandingPage — desktop marketing front door (local mode, route `/`).
 *
 * Follows the design system in `.cursor/design-system.md`: zinc neutral palette,
 * Inter type scale, per-node accent colors, and the established card / button
 * patterns. Self-contained dark aesthetic (explicit `zinc-*` utilities) to match
 * the `MobileLandingPage`, independent of the app's light/dark theme toggle.
 *
 * Content (features, use cases, copy) is shared with the mobile page via
 * `@/constants/landing` so the two surfaces stay in sync.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRightIcon, ArrowTopRightOnSquareIcon, CheckIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import { HeroDiagram } from "@/components/landing/HeroDiagram";
import { Reveal } from "@/components/landing/Reveal";
import { FeatureCard } from "@/components/landing/FeatureCard";
import { SimModeCard } from "@/components/landing/SimModePreview";
import { LogoMarquee } from "@/components/landing/LogoMarquee";
import { BRAND, EDITOR_PATH, FEATURES, USE_CASES, SIM_MODES, PROTOCOLS } from "@/constants/landing";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Simulation", href: "#simulation" },
  { label: "Use cases", href: "#use-cases" },
];

const HIGHLIGHTS = [
  "Local-first — no signup, your diagrams stay in the browser",
  "20+ node types",
  "Animated data-flow simulation",
];

function Logo() {
  return <span className="text-base font-semibold tracking-tight text-zinc-50">Branch</span>;
}

export function LandingPage() {
  // Header tightens (stronger blur/border, shorter) once scrolled past the hero top.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 antialiased">
      {/* ── Nav ──────────────────────────────────────── */}
      <header
        className={cn(
          "sticky top-0 z-50 border-b backdrop-blur-md transition-colors duration-300",
          scrolled
            ? "border-zinc-800 bg-zinc-950/90 shadow-lg shadow-black/30"
            : "border-zinc-900/80 bg-zinc-950/70",
        )}
      >
        <nav
          className={cn(
            "mx-auto flex max-w-6xl items-center justify-between px-6 transition-all duration-300",
            scrolled ? "h-14" : "h-16",
          )}
        >
          <div className="flex items-center gap-2.5">
            <img src="/branch-mark.svg" alt="" className="h-7 w-7" />
            <Logo />
          </div>
          <div className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm text-zinc-400 transition-colors hover:text-zinc-100"
              >
                {l.label}
              </a>
            ))}
          </div>
          <Link
            to={EDITOR_PATH}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white"
          >
            Launch editor
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </nav>
      </header>

      {/* ── Hero ─────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* ambient glow */}
        <div className="pointer-events-none absolute left-1/2 top-0 -z-0 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-[120px]" />

        <div className="relative mx-auto max-w-6xl px-6 pb-10 pt-20 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Free &amp; local-first — no account required
          </span>

          <h1 className="mx-auto mt-6 max-w-3xl text-balance text-5xl font-semibold tracking-tight text-zinc-50 sm:text-6xl">
            {BRAND.tagline}
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-zinc-400">
            Capture not just <span className="font-medium text-zinc-200">{BRAND.whatLabel}</span>{" "}
            components exist, but{" "}
            <span className="flow-shimmer font-semibold">{BRAND.howLabel}</span> between them — with
            animated simulation, failure &amp; chaos testing, and data contracts on every edge.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to={EDITOR_PATH}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-600 sm:w-auto"
            >
              Launch the editor
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-6 py-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800 sm:w-auto"
            >
              See how it works
            </a>
          </div>

          <ul className="mx-auto mt-7 flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-zinc-500">
            {HIGHLIGHTS.map((h) => (
              <li key={h} className="inline-flex items-center gap-1.5">
                <CheckIcon className="h-4 w-4 text-emerald-400" />
                {h}
              </li>
            ))}
          </ul>
        </div>

        {/* Animated diagram in a browser-chrome frame */}
        <div className="relative mx-auto max-w-5xl px-6 pb-20 pt-4">
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 shadow-[0_0_80px_-20px_rgba(0,0,0,0.8)]">
            <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              <div className="mx-2 flex h-5 flex-1 items-center rounded-md bg-zinc-800 px-3">
                <span className="truncate font-mono text-[10px] tracking-tight text-zinc-500">
                  localhost:5173
                </span>
              </div>
            </div>
            <div className="bg-zinc-950 p-6 sm:p-10">
              <HeroDiagram />
            </div>
          </div>
        </div>
      </section>

      {/* ── What vs How ──────────────────────────────── */}
      <section className="border-y border-zinc-900 bg-zinc-950">
        <Reveal
          stagger
          className="mx-auto grid max-w-5xl gap-px overflow-hidden rounded-xl md:grid-cols-2"
        >
          <div className="bg-zinc-900/40 p-8">
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
              Most tools stop at
            </p>
            <p className="mt-3 text-2xl font-semibold text-zinc-300">What components exist</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              Boxes and arrows on a static canvas. Accurate, but lifeless — they can't tell you what
              happens when something breaks.
            </p>
          </div>
          <div className="bg-zinc-900/40 p-8">
            <p className="text-xs font-medium uppercase tracking-widest text-blue-400">
              Branch adds
            </p>
            <p className="mt-3 text-2xl font-semibold text-zinc-50">How data flows between them</p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Typed protocols on every edge, animated request tracing, and failure simulation — so
              the diagram behaves like the system it describes.
            </p>
          </div>
        </Reveal>
      </section>

      {/* ── Tech-stack marquee ───────────────────────── */}
      <LogoMarquee />

      {/* ── Features ─────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            Everything you need to design with confidence
          </h2>
          <p className="mt-4 text-zinc-400">
            From the first box to a full resilience review — without leaving the canvas.
          </p>
        </Reveal>

        <Reveal stagger className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} />
          ))}
        </Reveal>
      </section>

      {/* ── Simulation showcase ──────────────────────── */}
      <section id="simulation" className="scroll-mt-20 border-y border-zinc-900 bg-zinc-900/20">
        <Reveal
          stagger
          className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-2"
        >
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
              Simulation engine
            </span>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
              Pressure-test the architecture before production does
            </h2>
            <p className="mt-4 leading-relaxed text-zinc-400">
              Trace a request through the graph, fail a node and watch the blast radius, or unleash
              chaos to see what survives. Every animation runs on your real diagram —{" "}
              <span className="text-zinc-300">hover a mode to preview it</span>.
            </p>

            <div className="mt-8 space-y-3">
              {SIM_MODES.map((m) => (
                <SimModeCard key={m.title} mode={m} />
              ))}
            </div>
          </div>

          {/* Protocol panel */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
              Data contracts on every edge
            </p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Pick a protocol per connection and Branch colors, styles, and animates it to match —
              so the wire format is part of the diagram, not a footnote.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {PROTOCOLS.map((p) => (
                <span
                  key={p.label}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-300"
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Use cases ────────────────────────────────── */}
      <section id="use-cases" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            Built for the way teams actually work
          </h2>
          <p className="mt-4 text-zinc-400">One canvas, from kickoff to incident review.</p>
        </Reveal>

        <Reveal stagger className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="flex items-start gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-900"
            >
              <div className="rounded-lg bg-zinc-800/80 p-2.5 text-zinc-300">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-100">{label}</h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-500">{desc}</p>
              </div>
            </div>
          ))}
        </Reveal>
      </section>

      {/* ── Final CTA ────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-zinc-900">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-[120px]" />
        <Reveal className="relative mx-auto max-w-3xl px-6 py-28 text-center">
          <h2 className="text-balance text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
            Map your system. Then make it flow.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-zinc-400">
            Open a blank canvas and start dragging — nothing to install, nothing to sign up for.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to={EDITOR_PATH}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-500 px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-blue-600 sm:w-auto"
            >
              Launch the editor
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ───────────────────────────────────── */}
      <footer className="border-t border-zinc-900">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <img src="/branch-mark.svg" alt="" className="h-5 w-5" />
            <Logo />
          </div>
          <p className="text-sm text-zinc-600">
            Design and simulate software architecture — visually.
          </p>
        </div>
      </footer>
    </div>
  );
}
