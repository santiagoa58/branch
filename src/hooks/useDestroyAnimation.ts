/**
 * useDestroyAnimation — GSAP shatter/explode effect for deleted nodes.
 *
 * Uses the "clone and animate" approach:
 * 1. Captures node position/dimensions
 * 2. Creates a temporary overlay clone
 * 3. Removes the node from React Flow state
 * 4. Shatters the clone into fragments that fly outward
 * 5. Removes the overlay when animation completes
 */
import { useEffect, useCallback, useRef } from "react";
import { gsap } from "@/lib/gsap";
import { useAnimationStore } from "@/store/animationStore";
import { useDiagramStore } from "@/store/diagramStore";

/** Number of fragment columns/rows for the shatter grid */
const GRID_SIZE = 4;
/** Duration of the shatter animation in seconds */
const SHATTER_DURATION = 0.6;

/**
 * Creates a grid of fragment elements from a source element's visual appearance.
 * Each fragment shows a clipped portion of the original via clip-path.
 */
function createFragments(sourceRect: DOMRect, overlayContainer: HTMLElement): HTMLElement[] {
  const fragments: HTMLElement[] = [];
  const fragWidth = sourceRect.width / GRID_SIZE;
  const fragHeight = sourceRect.height / GRID_SIZE;

  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const frag = document.createElement("div");
      frag.style.position = "absolute";
      frag.style.left = `${sourceRect.left + col * fragWidth}px`;
      frag.style.top = `${sourceRect.top + row * fragHeight}px`;
      frag.style.width = `${fragWidth}px`;
      frag.style.height = `${fragHeight}px`;
      frag.style.overflow = "hidden";
      frag.style.pointerEvents = "none";
      frag.style.borderRadius = "4px";

      // Semi-transparent fragment with color based on position
      const hue = (row * GRID_SIZE + col) * (360 / (GRID_SIZE * GRID_SIZE));
      frag.style.background = `linear-gradient(135deg, 
        hsla(${hue}, 30%, 40%, 0.8), 
        hsla(${hue + 30}, 20%, 30%, 0.6))`;
      frag.style.border = "1px solid rgba(255,255,255,0.1)";
      frag.style.backdropFilter = "blur(1px)";

      overlayContainer.appendChild(frag);
      fragments.push(frag);
    }
  }

  return fragments;
}

/**
 * Runs the shatter animation on fragments and fades connected edges.
 */
function animateShatter(fragments: HTMLElement[], _nodeId: string, onComplete: () => void) {
  const tl = gsap.timeline({
    onComplete: () => {
      // Clean up fragment elements
      fragments.forEach((f) => f.remove());
      onComplete();
    },
  });

  // Animate each fragment outward with stagger
  tl.to(
    fragments,
    {
      x: () => gsap.utils.random(-180, 180),
      y: () => gsap.utils.random(-250, 80),
      rotation: () => gsap.utils.random(-200, 200),
      scale: 0,
      opacity: 0,
      duration: SHATTER_DURATION,
      ease: "power2.out",
      stagger: {
        amount: 0.15,
        from: "center",
      },
    },
    0,
  );

  // Fade connected edges simultaneously
  // (the actual edge removal happens via store when deleteNode is called)
}

export function useDestroyAnimation() {
  const pendingDeletions = useAnimationStore((s) => s.pendingDeletions);
  const confirmDelete = useAnimationStore((s) => s.confirmDelete);
  const deleteNode = useDiagramStore((s) => s.deleteNode);

  const processedRef = useRef(new Set<string>());

  const performShatter = useCallback(
    (nodeId: string) => {
      const overlayContainer = document.getElementById("animation-overlay");
      if (!overlayContainer) {
        // No overlay container — fall back to immediate deletion
        deleteNode(nodeId);
        confirmDelete(nodeId);
        return;
      }

      const nodeEl = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement | null;
      if (!nodeEl) {
        deleteNode(nodeId);
        confirmDelete(nodeId);
        return;
      }

      const rect = nodeEl.getBoundingClientRect();

      // Create fragments
      const fragments = createFragments(rect, overlayContainer);

      // Immediately remove node from React Flow state
      deleteNode(nodeId);

      // Run shatter animation on the cloned fragments
      animateShatter(fragments, nodeId, () => {
        confirmDelete(nodeId);
      });
    },
    [deleteNode, confirmDelete],
  );

  // Watch for new pending deletions and process them
  useEffect(() => {
    const newDeletions = Array.from(pendingDeletions).filter((id) => !processedRef.current.has(id));

    if (newDeletions.length === 0) {
      return;
    }

    // Process each deletion with a slight stagger
    newDeletions.forEach((nodeId, index) => {
      processedRef.current.add(nodeId);
      setTimeout(() => {
        performShatter(nodeId);
      }, index * 80); // 80ms stagger between nodes
    });

    // Cleanup processed set when pendingDeletions empties
    if (pendingDeletions.size === 0) {
      processedRef.current.clear();
    }
  }, [pendingDeletions, performShatter]);

  // Clear processed ref when all deletions complete
  useEffect(() => {
    if (pendingDeletions.size === 0) {
      processedRef.current.clear();
    }
  }, [pendingDeletions]);
}
