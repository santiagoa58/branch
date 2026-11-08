// oxlint-disable max-lines -- debt: shared step and failure effects; split into dedicated hooks
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
import type { Edge } from "@xyflow/react";
import { gsap, MotionPathPlugin } from "@/lib/gsap";
import { useSimulationStore } from "@/store/simulationStore";
import { useDiagramStore } from "@/store/diagramStore";
import { planSimulation } from "@/services/simulationPlanning";
import { PROTOCOL_CONFIG } from "@/constants";
import { edgeProtocolSchema } from "@/schemas/catalogEnums";
import { planRequest, type TrafficHop } from "@/utils/trafficSimulation";
import type { EdgeProtocol } from "@/types";
import type { SimulationStats, BranchLevel } from "@/types/simulation";

// ── Constants for latency-proportional timing ──────────────────────────────

const DEFAULT_LATENCY = 100; // ms — edges without latencyMs use this
/** Readable visual time; logarithmic compression preserves fast/slow ordering. Not a metric. */
export function computeStepDuration(latencyMs?: number): number {
  const latency = Math.max(0, latencyMs ?? DEFAULT_LATENCY);
  return 0.15 + 0.22 * Math.log2(1 + latency / 2);
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
 * Follow React Flow's BaseEdge path, never arrowhead definitions, hit areas or glow overlays.
 * Marker paths also have `d` attributes and use coordinates near (0, 0).
 */
export function getEdgePath(edgeId: string): SVGPathElement | null {
  return (
    getEdgeElement(edgeId)?.querySelector<SVGPathElement>("path.react-flow__edge-path") ?? null
  );
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

interface FlowHopAnimation {
  tl: gsap.core.Timeline;
  hop: TrafficHop;
  layer: SVGSVGElement;
  edgesById: ReadonlyMap<string, Edge>;
  bottleneck: boolean;
}

/** Render one already-timed hop; animation never decides when a response is due. */
function animateFlowHop({ tl, hop, layer, edgesById, bottleneck }: FlowHopAnimation) {
  const path = getEdgePath(hop.edgeId);
  if (!path) {
    return { dots: [], wrappers: [] };
  }
  const parsed = edgeProtocolSchema.safeParse(edgesById.get(hop.edgeId)?.data?.["protocol"]);
  const color = PROTOCOL_CONFIG[parsed.success ? parsed.data : "http"].color.primary;
  const { inner, outer } = hop.reverse
    ? createResponsePacketDots(layer, color)
    : createPacketDots(layer, color);
  if (hop.reverse) {
    positionAtPathEnd(path, inner, outer);
  } else {
    positionAtPathStart(path, inner, outer);
  }
  const dots = [inner, outer];
  gsap.set(dots, { opacity: 0 });
  const at = hop.startMs / 1000;
  const duration = hop.durationMs / 1000;
  const wrapper = bottleneck
    ? document.querySelector<HTMLElement>(`.react-flow__edge[data-id="${hop.edgeId}"]`)
    : null;
  if (wrapper) {
    tl.to(wrapper, { boxShadow: `0 0 15px ${color}`, duration: 0.1 }, at);
    tl.set(wrapper, { clearProps: "boxShadow" }, at + duration);
  }
  tl.set(dots, { opacity: hop.reverse ? 0.6 : 1 }, at);
  tl.to(
    dots,
    {
      motionPath: {
        path,
        align: path,
        alignOrigin: [0.5, 0.5],
        start: hop.reverse ? 1 : 0,
        end: hop.reverse ? 0 : 1,
      },
      duration,
      ease: "none",
    },
    at,
  );
  tl.set(dots, { opacity: 0 }, at + duration);
  return { dots, wrappers: wrapper ? [wrapper] : [] };
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

// oxlint-disable-next-line max-lines-per-function -- debt: shared step and failure effects; split into dedicated hooks
export function useSimulationAnimation() {
  const nodes = useDiagramStore((s) => s.nodes);
  const edges = useDiagramStore((s) => s.edges);
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

  // Trace and Traffic use the same causal planner. Each response starts when its own
  // dependency returns, rather than waiting for a graph-wide BFS/reverse sweep.
  useEffect(() => {
    if (mode !== "flow" || !isRunning || !flowPath || !sourceNodeId || steppingMode) {
      return;
    }
    const layer = getEdgeSvgLayer();
    if (!layer) {
      return;
    }
    const byId = new Map(edges.map((edge) => [edge.id, edge]));
    const tracedEdges = flowPath.steps.flatMap((step) => {
      const edge = byId.get(step.edgeId);
      return edge ? [{ ...edge, source: step.fromNodeId, target: step.toNodeId }] : [];
    });
    const options = { nodes };
    const planned = planSimulation(() => ({
      plan: planRequest(tracedEdges, sourceNodeId, new Set(), "trace", options),
      visual: planRequest(tracedEdges, sourceNodeId, new Set(), "trace", {
        ...options,
        durationOf: (latencyMs: number) => computeStepDuration(latencyMs) * 1000,
      }),
    }));
    if (!planned?.plan || !planned.visual) {
      return;
    }
    const { plan, visual } = planned;
    animatedFlowNodeIdsRef.current = [...flowPath.nodeIds];
    const stats = computeFlowStats(flowPath.steps, flowPath.nodeIds.length, flowPath.levels);
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.8 });
    flowTimelineRef.current = tl;
    const visibleHops = visual.hops.filter((hop) => roundTripEnabled || !hop.reverse);
    const firstResponseMs = visibleHops.reduce(
      (first, hop) => (hop.reverse ? Math.min(first, hop.startMs) : first),
      Infinity,
    );
    const visualEndMs = visibleHops.reduce(
      (end, hop) => Math.max(end, hop.startMs + hop.durationMs),
      0,
    );
    for (const hop of visibleHops) {
      const rendered = animateFlowHop({
        tl,
        hop,
        layer,
        edgesById: byId,
        bottleneck: hop.edgeId === stats.bottleneckEdgeId,
      });
      packetDotsRef.current.push(...rendered.dots);
      bottleneckWrapperRef.current.push(...rendered.wrappers);
    }
    tl.call(() => useSimulationStore.getState().setRoundTripPhase("request"), [], 0);
    if (Number.isFinite(firstResponseMs)) {
      tl.call(
        () => useSimulationStore.getState().setRoundTripPhase("response"),
        [],
        firstResponseMs / 1000,
      );
    }
    tl.set({}, {}, visualEndMs / 1000);
    tl.call(() => useSimulationStore.getState().setRoundTripPhase(null), [], visualEndMs / 1000);
    tl.timeScale(speed);
    const forwards = plan.hops.filter((hop) => !hop.reverse);
    useSimulationStore.getState().setStats({
      ...stats,
      totalLatencyMs: forwards.reduce((end, hop) => Math.max(end, hop.startMs + hop.durationMs), 0),
      roundTripLatencyMs: roundTripEnabled ? plan.responseMs : null,
    });
    return () => {
      tl.kill();
      flowTimelineRef.current = null;
      cleanupPacketDots();
      cleanupBottleneckGlow();
      animatedFlowNodeIdsRef.current = [];
      useSimulationStore.getState().setRoundTripPhase(null);
    };
  }, [
    mode,
    isRunning,
    flowPath,
    sourceNodeId,
    steppingMode,
    roundTripEnabled,
    speed,
    nodes,
    edges,
  ]);

  // ── Flow Simulation — Step-by-Step Debugger Mode ─────────────────────────
  // oxlint-disable-next-line max-lines-per-function -- debt: existing step renderer; extract branches and split into smaller units
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

    // Scope every step tween and style write to this effect. Reverting kills
    // in-flight highlights before restoring their original inline styles.
    // oxlint-disable-next-line complexity, max-lines-per-function -- debt: existing step renderer; extract branches and split into smaller units
    const stepContext = gsap.context(() => {
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
    });

    return () => {
      stepContext.revert();
      cleanupStepBadges();
      animatedFlowNodeIdsRef.current = [];
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
