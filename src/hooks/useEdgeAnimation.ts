/**
 * useEdgeAnimation — Encapsulates GSAP timeline creation for animated edge flow effects.
 * Replaces the previous SVG SMIL <animateMotion> and CSS @keyframes approach.
 *
 * Returns refs to attach to the SVG elements (dashed path, inner dot, outer dot).
 * The GSAP timeline handles:
 *  - strokeDashoffset animation on the dashed path
 *  - MotionPathPlugin-based dot movement along the edge path
 */
import { useRef, useEffect } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

interface UseEdgeAnimationOptions {
  edgePath: string;
  isAnimated: boolean;
  speed?: number;
}

export function useEdgeAnimation({ edgePath, isAnimated, speed = 1 }: UseEdgeAnimationOptions) {
  const containerRef = useRef<SVGGElement>(null);
  const dashPathRef = useRef<SVGPathElement>(null);
  const dotInnerRef = useRef<SVGCircleElement>(null);
  const dotOuterRef = useRef<SVGCircleElement>(null);
  const timelineRef = useRef<gsap.core.Timeline | null>(null);

  useGSAP(
    () => {
      // Kill any existing timeline
      if (timelineRef.current) {
        timelineRef.current.kill();
        timelineRef.current = null;
      }

      if (!isAnimated || !containerRef.current) {
        return;
      }

      const tl = gsap.timeline({ repeat: -1 });

      // Animate stroke-dashoffset on the dashed path (replaces CSS flowAnimation)
      if (dashPathRef.current) {
        tl.fromTo(
          dashPathRef.current,
          { strokeDashoffset: 24 },
          { strokeDashoffset: 0, duration: 0.6, ease: "none", repeat: -1 },
          0,
        );
      }

      // Animate dots along the edge path using MotionPathPlugin
      if (dotInnerRef.current && edgePath) {
        tl.to(
          dotInnerRef.current,
          {
            motionPath: {
              path: edgePath,
              autoRotate: false,
            },
            duration: 1.5,
            ease: "none",
            repeat: -1,
          },
          0,
        );
      }

      if (dotOuterRef.current && edgePath) {
        tl.to(
          dotOuterRef.current,
          {
            motionPath: {
              path: edgePath,
              autoRotate: false,
            },
            duration: 1.5,
            ease: "none",
            repeat: -1,
          },
          0,
        );
      }

      tl.timeScale(speed);
      timelineRef.current = tl;
    },
    { scope: containerRef, dependencies: [edgePath, isAnimated] },
  );

  // Update timeScale when speed changes without rebuilding the timeline
  useEffect(() => {
    if (timelineRef.current) {
      timelineRef.current.timeScale(speed);
    }
  }, [speed]);

  return {
    containerRef,
    dashPathRef,
    dotInnerRef,
    dotOuterRef,
    timeline: timelineRef,
  };
}
