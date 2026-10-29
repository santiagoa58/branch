/**
 * Central GSAP initialization file.
 * All animation code should import from here instead of directly from 'gsap'.
 * This ensures MotionPathPlugin is registered once and provides a single source of truth.
 */
import gsap from "gsap";
import { MotionPathPlugin } from "gsap/MotionPathPlugin";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

// Register plugins once at module load
gsap.registerPlugin(MotionPathPlugin, ScrollTrigger);

// Register GSAP for React (suppresses useLayoutEffect warnings in SSR)
gsap.registerPlugin(useGSAP);

export { gsap, MotionPathPlugin, ScrollTrigger, useGSAP };
