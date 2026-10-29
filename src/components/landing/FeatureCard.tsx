/**
 * FeatureCard — a feature-grid tile with two on-brand hover effects:
 *
 *  1. Border-flow: a light in the card's accent color travels around the border,
 *     echoing the data-flow packets in the hero — the card literally "flows".
 *     Driven entirely in CSS (`.border-flow`, see index.css); the arc spins
 *     continuously but is faded in only on hover.
 *  2. Magnetic lift: the card rises and its shadow deepens on hover.
 *
 * Accent color comes from the feature's `accentHex` (see `@/constants/landing`).
 */
import type { CSSProperties } from "react";
import type { LandingFeature } from "@/constants/landing";

export function FeatureCard({ feature }: { feature: LandingFeature }) {
  const { icon: Icon, title, desc, accentText, accentBg, accentBorder, accentHex } = feature;

  return (
    <div className="group relative rounded-xl transition-transform duration-300 ease-out hover:-translate-y-1">
      {/* traveling accent border light (CSS-driven; revealed on hover) */}
      <div
        aria-hidden="true"
        className="border-flow pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ "--bf-color": accentHex } as CSSProperties}
      />

      {/* card body */}
      <div className="relative h-full rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 transition-colors duration-300 group-hover:border-zinc-700 group-hover:bg-zinc-900 group-hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.7)]">
        <div className={`inline-flex rounded-lg border p-2.5 ${accentBg} ${accentBorder}`}>
          <Icon className={`h-5 w-5 ${accentText}`} />
        </div>
        <h3 className="mt-4 text-base font-semibold text-zinc-100">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{desc}</p>
      </div>
    </div>
  );
}
