// oxlint-disable max-lines -- debt: 1218 lines (limit 450); split the module
/**
 * useSimulationAnimation — GSAP orchestration hook for simulation visual effects.
 *
 * Flow mode: Animates "packet" dots along edge paths via MotionPathPlugin,
 *            supports branching (parallel packets), latency-proportional speed,
 *            bottleneck edge highlighting, and round-trip return animation.
 *            Also supports step-by-step debugger mode for manual traversal.
 * Failure mode: Cascading domino-effect animation — failure ripples outward
 *               level-by-level via BFS depth, instead of instant marking.
 */
import { useEffect, useRef } from "react";
import { gsap, MotionPathPlugin } from "@/lib/gsap";
import { useSimulationStore } from "@/store/simulationStore";
import { PROTOCOL_CONFIG } from "@/constants";
import type { EdgeProtocol } from "@/types";
import type { SimulationStats, BranchLevel } from "@/types/simulation";

// ── Constants for latency-proportional timing ──────────────────────────────

const DEFAULT_LATENCY = 100; // ms — edges without latencyMs use this
const BASE_DURATION = 0.8; // seconds — animation duration at DEFAULT_LATENCY
const MIN_DURATION = 0.3; // seconds — minimum per-step animation duration
const MAX_DURATION = 3.0; // seconds — maximum per-step animation duration

/** Compute GSAP animation duration proportional to edge latency. */
export function computeStepDuration(latencyMs?: number): number {
  const latency = latencyMs ?? DEFAULT_LATENCY;
  const duration = (BASE_DURATION * latency) / DEFAULT_LATENCY;
  return Math.max(MIN_DURATION, Math.min(MAX_DURATION, duration));
}

/**
 * Position SVG circle elements at the start of a path.
 * Prevents the "flash at (0,0)" bug when dots become visible before
 * the first motionPath tween kicks in.
 */
function positionAtPathStart(pathEl: SVGPathElement, ...elements: SVGElement[]): void {
  const pt = pathEl.getPointAtLength(0);
  for (const el of elements) {
    el.setAttribute("cx", String(pt.x));
    el.setAttribute("cy", String(pt.y));
  }
}

/**
 * Position SVG circle elements at the end of a path (for reverse animations).
 */
function positionAtPathEnd(pathEl: SVGPathElement, ...elements: SVGElement[]): void {
  const pt = pathEl.getPointAtLength(pathEl.getTotalLength());
  for (const el of elements) {
    el.setAttribute("cx", String(pt.x));
    el.setAttribute("cy", String(pt.y));
  }
}

/**
 * Query a node DOM element by its data-node-id attribute.
 */
function getNodeElement(nodeId: string): HTMLElement | null {
  return document.querySelector(`[data-node-id="${nodeId}"]`);
}

/**
 * Query an edge DOM element by its data-edge-id attribute.
 */
function getEdgeElement(edgeId: string): Element | null {
  return document.querySelector(`[data-edge-id="${edgeId}"]`);
}

/**
 * Get the React Flow SVG edge layer where we can inject packet circles.
 */
export function getEdgeSvgLayer(): SVGSVGElement | null {
  return document.querySelector<SVGSVGElement>(".react-flow__edges svg");
}

/**
 * Find the first <path> element inside an edge group that has a `d` attribute
 * (skip markers). Prefer the BaseEdge path which is the direct child with the
 * edge path data.
 */
export function getEdgePath(edgeId: string): SVGPathElement | null {
  const edgeGroup = getEdgeElement(edgeId);
  if (!edgeGroup) {
    return null;
  }
  // Look for paths with a d attribute — the first one with stroke is usually the base edge
  const paths = edgeGroup.querySelectorAll("path[d]");
  for (const p of paths) {
    const d = p.getAttribute("d");
    if (d && d.length > 10) {
      return p as SVGPathElement;
    } // skip trivial marker paths
  }
  return null;
}

/**
 * Create the packet SVG elements (inner dot + outer glow).
 */
function createPacketDots(
  svgLayer: SVGSVGElement,
  color: string,
): { inner: SVGCircleElement; outer: SVGCircleElement } {
  const ns = "http://www.w3.org/2000/svg";

  const outer = document.createElementNS(ns, "circle");
  outer.setAttribute("r", "10");
  outer.setAttribute("fill", color);
  outer.setAttribute("opacity", "0.3");
  outer.setAttribute("pointer-events", "none");

  const inner = document.createElementNS(ns, "circle");
  inner.setAttribute("r", "5");
  inner.setAttribute("fill", color);
  inner.setAttribute("pointer-events", "none");
  inner.style.filter = `drop-shadow(0 0 4px ${color})`;

  svgLayer.appendChild(outer);
  svgLayer.appendChild(inner);

  return { inner, outer };
}

/**
 * Create a step number badge overlay positioned near a node.
 */
function createStepBadge(nodeId: string, stepNumber: number): HTMLElement | null {
  const nodeEl = getNodeElement(nodeId);
  if (!nodeEl) {
    return null;
  }

  const badge = document.createElement("div");
  badge.className = "simulation-step-badge";
  badge.textContent = String(stepNumber);
  badge.style.cssText = `
    position: absolute;
    top: -8px;
    right: -8px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #7c3aed;
    color: white;
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    pointer-events: none;
    box-shadow: 0 0 8px rgba(124, 58, 237, 0.5);
  `;

  // The node element needs relative positioning for absolute badge placement
  const currentPosition = window.getComputedStyle(nodeEl).position;
  if (currentPosition === "static") {
    nodeEl.style.position = "relative";
  }
  nodeEl.appendChild(badge);
  return badge;
}

/** Create response packet dots with muted visual (dashed outline, reduced opacity). */
function createResponsePacketDots(
  svgLayer: SVGSVGElement,
  color: string,
): { inner: SVGCircleElement; outer: SVGCircleElement } {
  const ns = "http://www.w3.org/2000/svg";

  const outer = document.createElementNS(ns, "circle");
  outer.setAttribute("r", "8");
  outer.setAttribute("fill", "none");
  outer.setAttribute("stroke", color);
  outer.setAttribute("stroke-width", "1.5");
  outer.setAttribute("stroke-dasharray", "3 3");
  outer.setAttribute("opacity", "0.4");
  outer.setAttribute("pointer-events", "none");

  const inner = document.createElementNS(ns, "circle");
  inner.setAttribute("r", "4");
  inner.setAttribute("fill", color);
  inner.setAttribute("opacity", "0.6");
  inner.setAttribute("pointer-events", "none");
  inner.style.filter = `drop-shadow(0 0 3px ${color})`;

  svgLayer.appendChild(outer);
  svgLayer.appendChild(inner);

  return { inner, outer };
}

// ── Stat computation helpers ───────────────────────────────────────────────

function computeFlowStats(
  steps: { protocol?: string; latencyMs?: number; edgeId: string }[],
  nodeCount: number,
  levels?: BranchLevel[],
  roundTripLatencyMs?: number | null,
): SimulationStats {
  const protocols = new Set<string>();
  let totalLatencyMs = 0;
  let maxLatency = 0;
  let bottleneckEdgeId: string | null = null;
  const branchIds = new Set<string>();

  for (const step of steps) {
    if (step.protocol) {
      protocols.add(step.protocol);
    }
    const lat = step.latencyMs ?? DEFAULT_LATENCY;
    totalLatencyMs += lat;
    if (lat > maxLatency) {
      maxLatency = lat;
      bottleneckEdgeId = step.edgeId;
    }
  }

  if (levels) {
    for (const level of levels) {
      for (const bStep of level.steps) {
        branchIds.add(bStep.branchId);
      }
    }
  }

  return {
    totalHops: steps.length,
    protocolsUsed: Array.from(protocols),
    pathLength: nodeCount,
    totalLatencyMs,
    bottleneckEdgeId,
    branchCount: branchIds.size,
    roundTripLatencyMs: roundTripLatencyMs ?? null,
    failedCount: 0,
    affectedCount: 0,
    impactPercentage: 0,
    brokenEdgeCount: 0,
    chaosRounds: 0,
    chaosTotalFailures: 0,
    chaosMTBF: null,
    chaosSeveredEdges: 0,
  };
}

// oxlint-disable-next-line max-lines-per-function -- debt: 1044 lines; split into smaller units
export function useSimulationAnimation() {
  const mode = useSimulationStore((s) => s.mode);
  const isRunning = useSimulationStore((s) => s.isRunning);
  const speed = useSimulationStore((s) => s.speed);
  const flowPath = useSimulationStore((s) => s.flowPath);
  const sourceNodeId = useSimulationStore((s) => s.sourceNodeId);
  const activePathNodeIds = useSimulationStore((s) => s.activePathNodeIds);
  const activePathEdgeIds = useSimulationStore((s) => s.activePathEdgeIds);
  const failedNodeIds = useSimulationStore((s) => s.failedNodeIds);
  const affectedNodeIds = useSimulationStore((s) => s.affectedNodeIds);
  const affectedEdgeIds = useSimulationStore((s) => s.affectedEdgeIds);
  const cascadeLevels = useSimulationStore((s) => s.cascadeLevels);
  const steppingMode = useSimulationStore((s) => s.steppingMode);
  const currentStepIndex = useSimulationStore((s) => s.currentStepIndex);
  const roundTripEnabled = useSimulationStore((s) => s.roundTripEnabled);

  // Track active GSAP contexts for cleanup
  const flowTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const failureTweensRef = useRef<gsap.core.Tween[]>([]);
  const failureTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const packetDotsRef = useRef<SVGElement[]>([]);

  // Track which IDs were animated so cleanup can clear styles even after store resets
  const animatedFailedIdsRef = useRef<string[]>([]);
  const animatedAffectedIdsRef = useRef<string[]>([]);
  const animatedAffectedEdgeIdsRef = useRef<string[]>([]);
  const animatedFlowNodeIdsRef = useRef<string[]>([]);
  const bottleneckWrapperRef = useRef<HTMLElement[]>([]);

  // Track dimmed elements for cleanup
  const dimmedNodeIdsRef = useRef<string[]>([]);
  const dimmedEdgeIdsRef = useRef<string[]>([]);
  const dimmingTweensRef = useRef<gsap.core.Tween[]>([]);

  // Track step badges for cleanup
  const stepBadgesRef = useRef<HTMLElement[]>([]);

  // Track whether stepping mode created packet dots (so we don't clean up continuous mode's dots)
  const steppingOwnedDotsRef = useRef(false);

  /**
   * Remove injected packet dots from the SVG layer.
   */
  function cleanupPacketDots() {
    for (const el of packetDotsRef.current) {
      el.remove();
    }
    packetDotsRef.current = [];
  }

  /**
   * Remove step badges from nodes.
   */
  function cleanupStepBadges() {
    for (const badge of stepBadgesRef.current) {
      badge.remove();
    }
    stepBadgesRef.current = [];
  }

  /**
   * Clean up dimming effects — restore opacity and filter.
   */
  function cleanupDimming() {
    for (const tw of dimmingTweensRef.current) {
      tw.kill();
    }
    dimmingTweensRef.current = [];

    for (const nodeId of dimmedNodeIdsRef.current) {
      const el = getNodeElement(nodeId);
      if (el) {
        gsap.set(el, { clearProps: "opacity,filter" });
      }
    }
    for (const edgeId of dimmedEdgeIdsRef.current) {
      // Dim the React Flow edge wrapper (contains BaseEdge + overlays)
      const wrapper = document.querySelector<HTMLElement>(`.react-flow__edge[data-id="${edgeId}"]`);
      if (wrapper) {
        gsap.set(wrapper, { clearProps: "opacity,filter" });
      }
    }
    dimmedNodeIdsRef.current = [];
    dimmedEdgeIdsRef.current = [];
  }

  /**
   * Clean up bottleneck glow effects on edge wrappers.
   */
  function cleanupBottleneckGlow() {
    for (const el of bottleneckWrapperRef.current) {
      gsap.set(el, { clearProps: "boxShadow" });
    }
    bottleneckWrapperRef.current = [];
  }

  // ── Flow Simulation Animation — Continuous Mode (Packet + Highlights) ────
  // oxlint-disable-next-line complexity, max-lines-per-function -- debt: complexity 64, 472 lines; extract branches and split into smaller units
  useEffect(() => {
    // Only run continuous flow animation when NOT in stepping mode
    if (mode !== "flow" || !isRunning || !flowPath || !sourceNodeId || steppingMode) {
      // Kill flow timeline if we stop
      if (flowTimelineRef.current) {
        flowTimelineRef.current.kill();
        flowTimelineRef.current = null;
      }
      // Clear inline styles using tracked IDs (store may already be reset)
      if (!steppingMode) {
        for (const nodeId of animatedFlowNodeIdsRef.current) {
          const el = getNodeElement(nodeId);
          if (el) {
            gsap.set(el, { clearProps: "boxShadow,opacity,filter" });
          }
        }
        animatedFlowNodeIdsRef.current = [];
        cleanupPacketDots();
        cleanupBottleneckGlow();
      }
      return;
    }

    const svgLayer = getEdgeSvgLayer();
    if (!svgLayer) {
      return;
    }

    // Track which nodes we're animating for later cleanup
    animatedFlowNodeIdsRef.current = [...flowPath.nodeIds];

    const levels = flowPath.levels ?? [];
    const hasBranching = levels.some((l) => l.steps.length > 1);

    // ── Compute bottleneck edge ──
    let maxLatency = 0;
    let bottleneckEdgeId: string | null = null;
    for (const step of flowPath.steps) {
      const lat = step.latencyMs ?? DEFAULT_LATENCY;
      if (lat > maxLatency) {
        maxLatency = lat;
        bottleneckEdgeId = step.edgeId;
      }
    }

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.8 });
    flowTimelineRef.current = tl;

    // Highlight source node with green glow
    const sourceEl = getNodeElement(sourceNodeId);
    if (sourceEl) {
      tl.to(
        sourceEl,
        {
          boxShadow: "0 0 25px rgba(16,185,129,0.6)",
          duration: 0.4,
          ease: "power2.out",
        },
        0,
      );
    }

    let timeOffset = 0.5;
    let forwardLatencyMs = 0;

    /**
     * Helper: add bottleneck amber glow for a step to the timeline.
     */
    const addBottleneckGlow = (edgeId: string, at: number, dur: number) => {
      if (edgeId !== bottleneckEdgeId) {
        return;
      }
      const wrapper = document.querySelector<HTMLElement>(`.react-flow__edge[data-id="${edgeId}"]`);
      if (!wrapper) {
        return;
      }
      bottleneckWrapperRef.current.push(wrapper);
      tl.to(
        wrapper,
        {
          boxShadow: "0 0 15px rgba(245,158,11,0.7)",
          duration: 0.2,
          ease: "power2.out",
        },
        at,
      );
      tl.to(
        wrapper,
        {
          clearProps: "boxShadow",
          duration: 0.3,
        },
        at + dur + 0.1,
      );
    };

    if (hasBranching && levels.length > 0) {
      // ── Branching Mode: Per-level parallel packets ─────────────────

      // Detect merge points: toNodeIds that appear from different branchIds
      const nodeAppearances = new Map<string, Set<string>>();
      for (const level of levels) {
        for (const step of level.steps) {
          if (!nodeAppearances.has(step.toNodeId)) {
            nodeAppearances.set(step.toNodeId, new Set());
          }
          nodeAppearances.get(step.toNodeId)!.add(step.branchId);
        }
      }
      const mergeNodeIds = new Set<string>();
      for (const [nodeId, branches] of nodeAppearances) {
        if (branches.size > 1) {
          mergeNodeIds.add(nodeId);
        }
      }

      for (const level of levels) {
        const levelDurations = level.steps.map((s) => computeStepDuration(s.latencyMs));
        const levelMaxDuration = Math.max(...levelDurations, MIN_DURATION);
        const levelMaxLatency = Math.max(...level.steps.map((s) => s.latencyMs ?? DEFAULT_LATENCY));
        forwardLatencyMs += levelMaxLatency;

        for (let si = 0; si < level.steps.length; si++) {
          const step = level.steps[si];
          const duration = levelDurations[si];
          if (!step || duration === undefined) {
            continue;
          }
          const protocol = (step.protocol || "http") as EdgeProtocol;
          const config = PROTOCOL_CONFIG[protocol];
          const color = config?.color?.primary || "#3b82f6";
          const pathEl = getEdgePath(step.edgeId);

          // Branch packets get slightly decreasing opacity
          const branchOpacity = level.steps.length > 1 ? Math.max(0.5, 1 - si * 0.15) : 1;
          const { inner, outer } = createPacketDots(svgLayer, color);
          packetDotsRef.current.push(inner, outer);

          // Position at start of edge so dots don't flash at SVG origin
          if (pathEl) {
            positionAtPathStart(pathEl, inner, outer);
          }

          gsap.set([inner, outer], { opacity: 0 });

          // Fade in
          tl.to(inner, { opacity: branchOpacity, duration: 0.12 }, timeOffset);
          tl.to(outer, { opacity: branchOpacity * 0.3, duration: 0.12 }, timeOffset);

          // Update color
          tl.call(
            () => {
              inner.setAttribute("fill", color);
              inner.style.filter = `drop-shadow(0 0 4px ${color})`;
              outer.setAttribute("fill", color);
            },
            [],
            timeOffset,
          );

          // Animate along path
          if (pathEl) {
            const rawPath = MotionPathPlugin.getRawPath(pathEl);
            MotionPathPlugin.cacheRawPathMeasurements(rawPath);
            tl.to(
              inner,
              {
                motionPath: {
                  path: pathEl,
                  align: pathEl,
                  alignOrigin: [0.5, 0.5],
                },
                duration,
                ease: "power1.inOut",
              },
              timeOffset,
            );
            tl.to(
              outer,
              {
                motionPath: {
                  path: pathEl,
                  align: pathEl,
                  alignOrigin: [0.5, 0.5],
                },
                duration,
                ease: "power1.inOut",
              },
              timeOffset,
            );
          }

          // Pulse on arrival
          tl.to(
            inner,
            {
              attr: { r: 8 },
              duration: 0.15,
              yoyo: true,
              repeat: 1,
              ease: "power2.out",
            },
            timeOffset + duration,
          );
          tl.to(
            outer,
            {
              attr: { r: 14 },
              duration: 0.15,
              yoyo: true,
              repeat: 1,
              ease: "power2.out",
            },
            timeOffset + duration,
          );

          // Flash destination node
          const toEl = getNodeElement(step.toNodeId);
          if (toEl) {
            tl.to(
              toEl,
              {
                boxShadow: `0 0 20px ${color}80`,
                duration: 0.3,
                ease: "power2.out",
              },
              timeOffset + duration - 0.1,
            );
            tl.to(
              toEl,
              {
                boxShadow: "0 0 0px transparent",
                duration: 0.4,
                ease: "power2.in",
              },
              timeOffset + duration + 0.3,
            );
            // Merge pulse (white flash) if this is a merge point
            // oxlint-disable-next-line max-depth -- debt: nesting depth 5; extract the inner block
            if (mergeNodeIds.has(step.toNodeId)) {
              tl.to(
                toEl,
                {
                  boxShadow: "0 0 25px rgba(255,255,255,0.8)",
                  duration: 0.15,
                  yoyo: true,
                  repeat: 1,
                  ease: "power2.out",
                },
                timeOffset + duration + 0.1,
              );
            }
          }

          // Bottleneck glow
          addBottleneckGlow(step.edgeId, timeOffset, duration);

          // Fade out after level
          tl.to(
            [inner, outer],
            { opacity: 0, duration: 0.12 },
            timeOffset + levelMaxDuration + 0.25,
          );
        }

        timeOffset += levelMaxDuration + 0.4;
      }
    } else {
      // ── Single-Path Mode: One persistent packet ───────────────────

      const firstProtocol = (flowPath.steps[0]?.protocol || "http") as EdgeProtocol;
      const firstConfig = PROTOCOL_CONFIG[firstProtocol];
      const firstColor = firstConfig?.color?.primary || "#3b82f6";

      const { inner, outer } = createPacketDots(svgLayer, firstColor);
      packetDotsRef.current = [inner, outer];

      // Position at start of first edge so dots don't flash at SVG origin
      const firstEdgeId = flowPath.steps[0]?.edgeId;
      const firstPathEl = firstEdgeId ? getEdgePath(firstEdgeId) : null;
      if (firstPathEl) {
        positionAtPathStart(firstPathEl, inner, outer);
      }

      gsap.set([inner, outer], { opacity: 0 });

      // Fade in
      tl.to([inner, outer], { opacity: 1, duration: 0.2 }, 0.2);

      for (const step of flowPath.steps) {
        const protocol = (step.protocol || "http") as EdgeProtocol;
        const config = PROTOCOL_CONFIG[protocol];
        const color = config?.color?.primary || "#3b82f6";
        const duration = computeStepDuration(step.latencyMs);
        const stepLatency = step.latencyMs ?? DEFAULT_LATENCY;
        forwardLatencyMs += stepLatency;

        const pathEl = getEdgePath(step.edgeId);

        // Update packet color if protocol changes
        tl.call(
          () => {
            inner.setAttribute("fill", color);
            inner.style.filter = `drop-shadow(0 0 4px ${color})`;
            outer.setAttribute("fill", color);
          },
          [],
          timeOffset,
        );

        // Animate packet along the edge path
        if (pathEl) {
          const rawPath = MotionPathPlugin.getRawPath(pathEl);
          MotionPathPlugin.cacheRawPathMeasurements(rawPath);

          tl.to(
            inner,
            {
              motionPath: {
                path: pathEl,
                align: pathEl,
                alignOrigin: [0.5, 0.5],
              },
              duration,
              ease: "power1.inOut",
            },
            timeOffset,
          );
          tl.to(
            outer,
            {
              motionPath: {
                path: pathEl,
                align: pathEl,
                alignOrigin: [0.5, 0.5],
              },
              duration,
              ease: "power1.inOut",
            },
            timeOffset,
          );
        }

        // Pulse packet on arrival
        tl.to(
          inner,
          {
            attr: { r: 8 },
            duration: 0.15,
            yoyo: true,
            repeat: 1,
            ease: "power2.out",
          },
          timeOffset + duration,
        );
        tl.to(
          outer,
          {
            attr: { r: 14 },
            duration: 0.15,
            yoyo: true,
            repeat: 1,
            ease: "power2.out",
          },
          timeOffset + duration,
        );

        // Flash-highlight the destination node
        const toEl = getNodeElement(step.toNodeId);
        if (toEl) {
          tl.to(
            toEl,
            {
              boxShadow: `0 0 20px ${color}80`,
              duration: 0.3,
              ease: "power2.out",
            },
            timeOffset + duration - 0.1,
          );
          tl.to(
            toEl,
            {
              boxShadow: "0 0 0px transparent",
              duration: 0.4,
              ease: "power2.in",
            },
            timeOffset + duration + 0.3,
          );
        }

        // Bottleneck glow
        addBottleneckGlow(step.edgeId, timeOffset, duration);

        timeOffset += duration + 0.4;
      }

      // Fade out packet at the end before repeat
      tl.to([inner, outer], { opacity: 0, duration: 0.3 }, timeOffset);
    }

    // ── Round-Trip Return Journey ──────────────────────────────────────
    let roundTripLatencyMs: number | null = null;
    if (roundTripEnabled && flowPath.steps.length > 0) {
      // Build return steps: reverse of forward path, filtering out non-request/response protocols
      const returnSteps = [...flowPath.steps]
        .filter((step) => {
          const protocol = (step.protocol || "http") as EdgeProtocol;
          const config = PROTOCOL_CONFIG[protocol];
          return config?.requestResponse;
        })
        .reverse()
        .map((step) => ({
          ...step,
          fromNodeId: step.toNodeId,
          toNodeId: step.fromNodeId,
        }));

      if (returnSteps.length > 0) {
        timeOffset += 0.5; // gap between forward and return

        // Signal round-trip phase
        tl.call(
          () => {
            useSimulationStore.getState().setRoundTripPhase("response");
          },
          [],
          timeOffset,
        );

        let returnLatencyMs = 0;

        for (const step of returnSteps) {
          const protocol = (step.protocol || "http") as EdgeProtocol;
          const config = PROTOCOL_CONFIG[protocol];
          const color = config?.color?.secondary || "#60a5fa";
          const duration = computeStepDuration(step.latencyMs);
          const stepLatency = step.latencyMs ?? DEFAULT_LATENCY;
          returnLatencyMs += stepLatency;

          const pathEl = getEdgePath(step.edgeId);

          // Create response packet dots (muted visual)
          const { inner: rInner, outer: rOuter } = createResponsePacketDots(svgLayer, color);
          packetDotsRef.current.push(rInner, rOuter);

          // Position at end of path (response travels in reverse)
          if (pathEl) {
            positionAtPathEnd(pathEl, rInner, rOuter);
          }

          gsap.set([rInner, rOuter], { opacity: 0 });

          // Fade in
          tl.to(rInner, { opacity: 0.6, duration: 0.12 }, timeOffset);
          tl.to(rOuter, { opacity: 0.4, duration: 0.12 }, timeOffset);

          // Animate along path in REVERSE direction (start:1 → end:0)
          if (pathEl) {
            const rawPath = MotionPathPlugin.getRawPath(pathEl);
            MotionPathPlugin.cacheRawPathMeasurements(rawPath);

            tl.to(
              rInner,
              {
                motionPath: {
                  path: pathEl,
                  align: pathEl,
                  alignOrigin: [0.5, 0.5],
                  start: 1,
                  end: 0,
                },
                duration,
                ease: "power1.inOut",
              },
              timeOffset,
            );
            tl.to(
              rOuter,
              {
                motionPath: {
                  path: pathEl,
                  align: pathEl,
                  alignOrigin: [0.5, 0.5],
                  start: 1,
                  end: 0,
                },
                duration,
                ease: "power1.inOut",
              },
              timeOffset,
            );
          }

          // Pulse on arrival
          tl.to(
            rInner,
            {
              attr: { r: 6 },
              duration: 0.12,
              yoyo: true,
              repeat: 1,
              ease: "power2.out",
            },
            timeOffset + duration,
          );

          // Flash destination node (muted)
          const toEl = getNodeElement(step.toNodeId);
          if (toEl) {
            tl.to(
              toEl,
              {
                boxShadow: `0 0 15px ${color}60`,
                duration: 0.25,
                ease: "power2.out",
              },
              timeOffset + duration - 0.1,
            );
            tl.to(
              toEl,
              {
                boxShadow: "0 0 0px transparent",
                duration: 0.3,
                ease: "power2.in",
              },
              timeOffset + duration + 0.2,
            );
          }

          // Fade out response packet
          tl.to([rInner, rOuter], { opacity: 0, duration: 0.12 }, timeOffset + duration + 0.15);

          timeOffset += duration + 0.3;
        }

        // End round-trip phase
        tl.call(
          () => {
            useSimulationStore.getState().setRoundTripPhase(null);
          },
          [],
          timeOffset,
        );

        roundTripLatencyMs = forwardLatencyMs + returnLatencyMs;
      }
    }

    tl.timeScale(speed);

    // Compute and set stats
    const stats = computeFlowStats(
      flowPath.steps,
      flowPath.nodeIds.length,
      flowPath.levels,
      roundTripLatencyMs,
    );
    useSimulationStore.getState().setStats(stats);

    return () => {
      tl.kill();
      flowTimelineRef.current = null;
      for (const nodeId of animatedFlowNodeIdsRef.current) {
        const el = getNodeElement(nodeId);
        if (el) {
          gsap.set(el, { clearProps: "boxShadow,opacity,filter" });
        }
      }
      animatedFlowNodeIdsRef.current = [];
      cleanupPacketDots();
      cleanupBottleneckGlow();
      useSimulationStore.getState().setRoundTripPhase(null);
    };
  }, [mode, isRunning, flowPath, sourceNodeId, steppingMode, roundTripEnabled, speed]);

  // ── Flow Simulation — Step-by-Step Debugger Mode ─────────────────────────
  // oxlint-disable-next-line complexity, max-lines-per-function -- debt: complexity 58, 237 lines; extract branches and split into smaller units
  useEffect(() => {
    if (mode !== "flow" || !steppingMode || !flowPath || !sourceNodeId || currentStepIndex < 0) {
      // Cleanup stepping visuals — only clean what stepping mode owns
      cleanupStepBadges();
      if (steppingOwnedDotsRef.current) {
        cleanupPacketDots();
        steppingOwnedDotsRef.current = false;
      }
      return;
    }

    // Clear previous step visuals
    cleanupStepBadges();
    for (const nodeId of animatedFlowNodeIdsRef.current) {
      const el = getNodeElement(nodeId);
      if (el) {
        gsap.set(el, { clearProps: "boxShadow,opacity,filter" });
      }
    }
    if (steppingOwnedDotsRef.current) {
      cleanupPacketDots();
    }

    animatedFlowNodeIdsRef.current = [...flowPath.nodeIds];

    // Highlight source node
    const sourceEl = getNodeElement(sourceNodeId);
    if (sourceEl) {
      gsap.to(sourceEl, {
        boxShadow: "0 0 20px rgba(16,185,129,0.5)",
        duration: 0.3,
        ease: "power2.out",
      });
      const sourceBadge = createStepBadge(sourceNodeId, 0);
      if (sourceBadge) {
        sourceBadge.style.background = "#10b981";
        sourceBadge.textContent = "S";
        stepBadgesRef.current.push(sourceBadge);
      }
    }

    const levels = flowPath.levels;

    if (levels && levels.length > 0) {
      // ── Level-based stepping (branch-aware) ──
      const clampedIndex = Math.min(currentStepIndex, levels.length - 1);

      for (let li = 0; li <= clampedIndex; li++) {
        const level = levels[li];
        if (!level) {
          continue;
        }
        const isCurrentLevel = li === clampedIndex;

        for (const step of level.steps) {
          const protocol = (step.protocol || "http") as EdgeProtocol;
          const config = PROTOCOL_CONFIG[protocol];
          const color = config?.color?.primary || "#3b82f6";

          // Highlight destination node
          const toEl = getNodeElement(step.toNodeId);
          if (toEl) {
            // oxlint-disable-next-line max-depth -- debt: nesting depth 5; extract the inner block
            if (isCurrentLevel) {
              gsap.to(toEl, {
                boxShadow: `0 0 30px ${color}`,
                duration: 0.4,
                ease: "power2.out",
              });
            } else {
              gsap.set(toEl, {
                boxShadow: `0 0 12px ${color}60`,
              });
            }
          }

          // Add depth badge
          const badge = createStepBadge(step.toNodeId, li + 1);
          if (badge) {
            // oxlint-disable-next-line max-depth -- debt: nesting depth 5; extract the inner block
            if (isCurrentLevel) {
              badge.style.background = color;
              badge.style.boxShadow = `0 0 12px ${color}`;
              badge.style.transform = "scale(1.2)";
            }
            stepBadgesRef.current.push(badge);
          }

          // Edge highlight
          const edgeEl = getEdgeElement(step.edgeId);
          if (edgeEl && isCurrentLevel) {
            gsap.to(edgeEl, { opacity: 1, duration: 0.3 });
          }
        }
      }

      // Animate packets for current level
      const svgLayer = getEdgeSvgLayer();
      if (svgLayer) {
        const currentLevel = levels[clampedIndex];
        if (!currentLevel) {
          return;
        }
        for (const step of currentLevel.steps) {
          const protocol = (step.protocol || "http") as EdgeProtocol;
          const config = PROTOCOL_CONFIG[protocol];
          const color = config?.color?.primary || "#3b82f6";
          const pathEl = getEdgePath(step.edgeId);
          const duration = Math.min(computeStepDuration(step.latencyMs), 0.5);

          if (pathEl) {
            const { inner, outer } = createPacketDots(svgLayer, color);
            packetDotsRef.current.push(inner, outer);
            steppingOwnedDotsRef.current = true;

            positionAtPathStart(pathEl, inner, outer);

            const rawPath = MotionPathPlugin.getRawPath(pathEl);
            MotionPathPlugin.cacheRawPathMeasurements(rawPath);

            gsap.fromTo([inner, outer], { opacity: 0 }, { opacity: 1, duration: 0.15 });
            gsap.to(inner, {
              motionPath: {
                path: pathEl,
                align: pathEl,
                alignOrigin: [0.5, 0.5],
              },
              duration,
              ease: "power1.inOut",
            });
            gsap.to(outer, {
              motionPath: {
                path: pathEl,
                align: pathEl,
                alignOrigin: [0.5, 0.5],
              },
              duration,
              ease: "power1.inOut",
            });
            gsap.to(inner, {
              attr: { r: 8 },
              duration: 0.15,
              yoyo: true,
              repeat: 1,
              delay: duration,
              ease: "power2.out",
            });
          }
        }
      }

      // Update stats for level-based stepping
      const stepsUpToLevel: typeof flowPath.steps = [];
      for (let li = 0; li <= clampedIndex; li++) {
        const level = levels[li];
        if (!level) {
          continue;
        }
        for (const step of level.steps) {
          stepsUpToLevel.push(step);
        }
      }
      const visitedNodeIds = new Set<string>([sourceNodeId]);
      for (const s of stepsUpToLevel) {
        visitedNodeIds.add(s.toNodeId);
      }
      const stats = computeFlowStats(stepsUpToLevel, visitedNodeIds.size, levels);
      useSimulationStore.getState().setStats(stats);
    } else {
      // ── Flat stepping (backward compat) ──
      for (let i = 0; i <= currentStepIndex; i++) {
        const step = flowPath.steps[i];
        if (!step) {
          continue;
        }
        const protocol = (step.protocol || "http") as EdgeProtocol;
        const config = PROTOCOL_CONFIG[protocol];
        const color = config?.color?.primary || "#3b82f6";

        const isCurrentStep = i === currentStepIndex;

        // Highlight destination node
        const toEl = getNodeElement(step.toNodeId);
        if (toEl) {
          if (isCurrentStep) {
            gsap.to(toEl, {
              boxShadow: `0 0 30px ${color}`,
              duration: 0.4,
              ease: "power2.out",
            });
          } else {
            gsap.set(toEl, {
              boxShadow: `0 0 12px ${color}60`,
            });
          }
        }

        // Add step number badge
        const badge = createStepBadge(step.toNodeId, i + 1);
        if (badge) {
          if (isCurrentStep) {
            badge.style.background = color;
            badge.style.boxShadow = `0 0 12px ${color}`;
            badge.style.transform = "scale(1.2)";
          }
          stepBadgesRef.current.push(badge);
        }

        // Show edge highlight for visited edges
        const edgeEl = getEdgeElement(step.edgeId);
        if (edgeEl && isCurrentStep) {
          gsap.to(edgeEl, { opacity: 1, duration: 0.3 });
        }
      }

      // Animate packet to current step position
      const svgLayer = getEdgeSvgLayer();
      if (svgLayer) {
        const currentStep = flowPath.steps[currentStepIndex];
        if (!currentStep) {
          return;
        }
        const protocol = (currentStep.protocol || "http") as EdgeProtocol;
        const config = PROTOCOL_CONFIG[protocol];
        const color = config?.color?.primary || "#3b82f6";
        const pathEl = getEdgePath(currentStep.edgeId);

        if (pathEl) {
          const { inner, outer } = createPacketDots(svgLayer, color);
          packetDotsRef.current = [inner, outer];
          steppingOwnedDotsRef.current = true;

          positionAtPathStart(pathEl, inner, outer);

          const rawPath = MotionPathPlugin.getRawPath(pathEl);
          MotionPathPlugin.cacheRawPathMeasurements(rawPath);

          gsap.fromTo([inner, outer], { opacity: 0 }, { opacity: 1, duration: 0.15 });
          gsap.to(inner, {
            motionPath: {
              path: pathEl,
              align: pathEl,
              alignOrigin: [0.5, 0.5],
            },
            duration: 0.5,
            ease: "power1.inOut",
          });
          gsap.to(outer, {
            motionPath: {
              path: pathEl,
              align: pathEl,
              alignOrigin: [0.5, 0.5],
            },
            duration: 0.5,
            ease: "power1.inOut",
          });

          gsap.to(inner, {
            attr: { r: 8 },
            duration: 0.15,
            yoyo: true,
            repeat: 1,
            delay: 0.5,
            ease: "power2.out",
          });
        }
      }

      // Update stats for flat stepping
      const stepsSlice = flowPath.steps.slice(0, currentStepIndex + 1);
      const stats = computeFlowStats(stepsSlice, currentStepIndex + 2);
      useSimulationStore.getState().setStats(stats);
    }

    return () => {
      cleanupStepBadges();
      if (steppingOwnedDotsRef.current) {
        cleanupPacketDots();
        steppingOwnedDotsRef.current = false;
      }
    };
  }, [mode, steppingMode, flowPath, sourceNodeId, currentStepIndex]);

  // Update flow timeline speed when speed changes
  useEffect(() => {
    if (flowTimelineRef.current) {
      flowTimelineRef.current.timeScale(speed);
    }
  }, [speed]);

  // ── Dimming Effect (Flow Simulation) ─────────────────────────────────────
  useEffect(() => {
    if (mode !== "flow" || !isRunning) {
      cleanupDimming();
      return;
    }

    const activeNodeSet = new Set(activePathNodeIds);
    const activeEdgeSet = new Set(activePathEdgeIds);
    const tweens: gsap.core.Tween[] = [];
    const dimmedNodes: string[] = [];
    const dimmedEdges: string[] = [];

    // Dim non-active nodes
    const allNodeEls = document.querySelectorAll("[data-node-id]");
    for (const el of allNodeEls) {
      const nodeId = el.getAttribute("data-node-id");
      if (nodeId && !activeNodeSet.has(nodeId)) {
        dimmedNodes.push(nodeId);
        const tw = gsap.to(el, {
          opacity: 0.25,
          filter: "grayscale(50%)",
          duration: 0.5,
          ease: "power2.out",
        });
        tweens.push(tw);
      }
    }

    // Dim non-active edges (target the React Flow edge wrapper for full coverage)
    const allEdgeWrappers = document.querySelectorAll(".react-flow__edge");
    for (const wrapper of allEdgeWrappers) {
      const edgeId = wrapper.getAttribute("data-id");
      if (edgeId && !activeEdgeSet.has(edgeId)) {
        dimmedEdges.push(edgeId);
        const tw = gsap.to(wrapper, {
          opacity: 0.15,
          duration: 0.5,
          ease: "power2.out",
        });
        tweens.push(tw);
      }
    }

    dimmedNodeIdsRef.current = dimmedNodes;
    dimmedEdgeIdsRef.current = dimmedEdges;
    dimmingTweensRef.current = tweens;

    return () => {
      cleanupDimming();
    };
  }, [mode, isRunning, activePathNodeIds, activePathEdgeIds]);

  // ── Failure Simulation Animation — Cascading Domino Effect ───────────────
  // oxlint-disable-next-line complexity, max-lines-per-function -- debt: complexity 26, 218 lines; extract branches and split into smaller units
  useEffect(() => {
    if (mode !== "failure" || !isRunning) {
      // Kill failure tweens & timeline
      if (failureTimelineRef.current) {
        failureTimelineRef.current.kill();
        failureTimelineRef.current = null;
      }
      for (const tw of failureTweensRef.current) {
        tw.kill();
      }
      failureTweensRef.current = [];
      // Reset styles using tracked refs (store arrays may already be empty)
      for (const nodeId of animatedFailedIdsRef.current) {
        const el = getNodeElement(nodeId);
        if (el) {
          gsap.set(el, { clearProps: "boxShadow,opacity,filter" });
        }
      }
      for (const nodeId of animatedAffectedIdsRef.current) {
        const el = getNodeElement(nodeId);
        if (el) {
          gsap.set(el, { clearProps: "boxShadow,opacity,filter" });
        }
      }
      for (const edgeId of animatedAffectedEdgeIdsRef.current) {
        const el = getEdgeElement(edgeId);
        if (el) {
          gsap.set(el, { clearProps: "opacity" });
        }
        // Also clear the wrapper
        const wrapper = document.querySelector<HTMLElement>(
          `.react-flow__edge[data-id="${edgeId}"]`,
        );
        if (wrapper) {
          gsap.set(wrapper, { clearProps: "opacity,filter" });
        }
      }
      animatedFailedIdsRef.current = [];
      animatedAffectedIdsRef.current = [];
      animatedAffectedEdgeIdsRef.current = [];
      return;
    }

    // Track which IDs we're animating for later cleanup
    animatedFailedIdsRef.current = [...failedNodeIds];
    animatedAffectedIdsRef.current = [...affectedNodeIds];
    animatedAffectedEdgeIdsRef.current = [...affectedEdgeIds];

    const tweens: gsap.core.Tween[] = [];

    // Count total nodes for impact percentage
    const totalNodes = document.querySelectorAll("[data-node-id]").length;

    // Step 1: Pulse failed nodes red (immediate)
    for (const nodeId of failedNodeIds) {
      const el = getNodeElement(nodeId);
      if (el) {
        const tw = gsap.to(el, {
          boxShadow: "0 0 20px rgba(239,68,68,0.7)",
          repeat: -1,
          yoyo: true,
          duration: 0.8,
          ease: "sine.inOut",
        });
        tweens.push(tw);
      }
    }

    // Step 2: Cascade failure outward level-by-level (domino effect)
    if (cascadeLevels.length > 0) {
      const cascadeTl = gsap.timeline();
      failureTimelineRef.current = cascadeTl;
      const DELAY_PER_HOP = 0.4 / speed; // Delay between cascade levels

      for (const level of cascadeLevels) {
        const levelDelay = level.depth * DELAY_PER_HOP;

        // Animate edges at this level — snap/pulse then go red
        for (const edgeId of level.edgeIds) {
          const edgeGroup = getEdgeElement(edgeId);
          const wrapper = document.querySelector<HTMLElement>(
            `.react-flow__edge[data-id="${edgeId}"]`,
          );

          if (wrapper) {
            // Brief scale pulse ("snap" effect)
            cascadeTl.fromTo(
              wrapper,
              { scale: 1 },
              {
                scale: 1.15,
                duration: 0.12,
                yoyo: true,
                repeat: 1,
                ease: "power2.out",
                transformOrigin: "center center",
              },
              levelDelay,
            );

            // Then dim with red tint
            cascadeTl.to(
              wrapper,
              {
                opacity: 0.5,
                filter: "hue-rotate(-40deg) saturate(2)",
                duration: 0.3,
                ease: "power2.out",
              },
              levelDelay + 0.25,
            );
          }

          // Crackle on the edge path
          if (edgeGroup) {
            const tw = gsap.to(edgeGroup, {
              opacity: 0.6,
              duration: 0.15,
              repeat: -1,
              yoyo: true,
              delay: levelDelay + 0.3,
              ease: "rough({ strength: 2, points: 10, taper: none, randomize: false })",
            });
            tweens.push(tw);
          }
        }

        // Animate nodes at this level — red flash then dim to grayscale
        for (const nodeId of level.nodeIds) {
          const el = getNodeElement(nodeId);
          if (el) {
            // Red flash
            cascadeTl.to(
              el,
              {
                boxShadow: "0 0 25px rgba(239,68,68,0.8)",
                duration: 0.2,
                ease: "power2.out",
              },
              levelDelay,
            );

            // Then dim to grayscale
            cascadeTl.to(
              el,
              {
                boxShadow: "0 0 5px rgba(239,68,68,0.2)",
                opacity: 0.4,
                filter: "grayscale(80%)",
                duration: 0.4,
                ease: "power2.out",
              },
              levelDelay + 0.25,
            );
          }
        }
      }
    } else {
      // Fallback: no cascade levels — use instant dimming (legacy behavior)
      for (const nodeId of affectedNodeIds) {
        const el = getNodeElement(nodeId);
        if (el) {
          const tw = gsap.to(el, {
            opacity: 0.4,
            filter: "grayscale(80%)",
            duration: 0.5,
            ease: "power2.out",
          });
          tweens.push(tw);
        }
      }

      for (const edgeId of affectedEdgeIds) {
        const el = getEdgeElement(edgeId);
        if (el) {
          const tw = gsap.to(el, {
            opacity: 0.6,
            duration: 0.15,
            repeat: -1,
            yoyo: true,
            ease: "rough({ strength: 2, points: 10, taper: none, randomize: false })",
          });
          tweens.push(tw);
        }
      }
    }

    failureTweensRef.current = tweens;

    // Set failure stats
    const stats: SimulationStats = {
      totalHops: 0,
      protocolsUsed: [],
      pathLength: 0,
      totalLatencyMs: 0,
      bottleneckEdgeId: null,
      branchCount: 0,
      roundTripLatencyMs: null,
      failedCount: failedNodeIds.length,
      affectedCount: affectedNodeIds.length,
      impactPercentage:
        totalNodes > 0
          ? Math.round(((failedNodeIds.length + affectedNodeIds.length) / totalNodes) * 100)
          : 0,
      brokenEdgeCount: affectedEdgeIds.length,
      chaosRounds: 0,
      chaosTotalFailures: 0,
      chaosMTBF: null,
      chaosSeveredEdges: 0,
    };
    useSimulationStore.getState().setStats(stats);

    return () => {
      if (failureTimelineRef.current) {
        failureTimelineRef.current.kill();
        failureTimelineRef.current = null;
      }
      for (const tw of tweens) {
        tw.kill();
      }
      failureTweensRef.current = [];
      // Clear inline styles using tracked IDs
      for (const nodeId of animatedFailedIdsRef.current) {
        const el = getNodeElement(nodeId);
        if (el) {
          gsap.set(el, { clearProps: "boxShadow,opacity,filter" });
        }
      }
      for (const nodeId of animatedAffectedIdsRef.current) {
        const el = getNodeElement(nodeId);
        if (el) {
          gsap.set(el, { clearProps: "boxShadow,opacity,filter" });
        }
      }
      for (const edgeId of animatedAffectedEdgeIdsRef.current) {
        const el = getEdgeElement(edgeId);
        if (el) {
          gsap.set(el, { clearProps: "opacity" });
        }
        const wrapper = document.querySelector<HTMLElement>(
          `.react-flow__edge[data-id="${edgeId}"]`,
        );
        if (wrapper) {
          gsap.set(wrapper, { clearProps: "opacity,filter" });
        }
      }
      animatedFailedIdsRef.current = [];
      animatedAffectedIdsRef.current = [];
      animatedAffectedEdgeIdsRef.current = [];
    };
  }, [mode, isRunning, failedNodeIds, affectedNodeIds, affectedEdgeIds, cascadeLevels, speed]);
}
