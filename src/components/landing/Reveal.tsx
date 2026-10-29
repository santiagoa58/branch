/**
 * Reveal — scroll-triggered "boot to life" wrapper for landing sections.
 *
 * As the element scrolls into view it fades up and de-saturates from gray to
 * full color — the same what→how motif the `HeroDiagram` opens with, applied to
 * the whole page so it reads as one system powering on. Because most landing
 * text is already zinc-neutral, the grayscale tween mainly bites on the colored
 * accents (icon chips, protocol dots), which is exactly the "color blooms in"
 * effect we want.
 *
 * Two modes:
 *   <Reveal>…</Reveal>            → animates the wrapper as one unit
 *   <Reveal stagger>…children…</Reveal> → animates direct children in sequence
 *
 * Respects prefers-reduced-motion (renders fully visible, no animation).
 */
import { useRef } from "react";
import type { ElementType, ReactNode } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

const prefersReducedMotion =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Animate direct children in sequence instead of the wrapper as a whole. */
  stagger?: boolean;
  /** Render as a different element (e.g. 'section'). Defaults to 'div'. */
  as?: ElementType;
  /** Vertical travel distance, px. */
  y?: number;
}

export function Reveal({
  children,
  className,
  stagger = false,
  as: Tag = "div",
  y = 24,
}: RevealProps) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (prefersReducedMotion) {
        return;
      } // visible by default; nothing to animate
      const el = ref.current!;
      const targets = stagger ? (Array.from(el.children) as HTMLElement[]) : el;

      gsap.fromTo(
        targets,
        { opacity: 0, y, filter: "grayscale(1)" },
        {
          opacity: 1,
          y: 0,
          filter: "grayscale(0)",
          duration: 0.7,
          ease: "power2.out",
          stagger: stagger ? 0.1 : 0,
          clearProps: "filter,transform,opacity", // hand styling back to CSS once shown
          scrollTrigger: { trigger: el, start: "top 85%", once: true },
        },
      );
    },
    { scope: ref },
  );

  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}
