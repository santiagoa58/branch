import { useCallback, useEffect, useRef } from "react";
import { useReactFlow } from "@xyflow/react";
import { cloudWorkspace, useCloudWorkspace } from "@/services/cloudWorkspace";
import { notify } from "@/services/notify";
import { useAnimationStore } from "@/store/animationStore";
import { useDiagramStore } from "@/store/diagramStore";

/** Shared command for the toolbar and keyboard; layout itself stays pure and DOM-free. */
export function useAutoFormat() {
  const { fitView } = useReactFlow();
  const nodeCount = useDiagramStore((state) => state.nodes.length);
  const pendingDeletes = useAnimationStore((state) => state.pendingDeletions.size);
  const cloud = useCloudWorkspace();
  const frame = useRef<number | null>(null);

  const cancelFrame = useCallback(() => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
  }, []);
  useEffect(() => cancelFrame, [cancelFrame]);

  const autoFormat = useCallback(() => {
    const current = cloudWorkspace.getState();
    if (
      current.locked ||
      current.status === "loading" ||
      useDiagramStore.getState().nodes.length === 0 ||
      useAnimationStore.getState().pendingDeletions.size > 0
    ) {
      return;
    }
    cancelFrame();
    try {
      useDiagramStore.getState().applyAutoLayout();
    } catch {
      notify.error({
        title: "Could not format the diagram",
        message: "Your previous layout is unchanged.",
      });
      return;
    }

    const diagramId = current.diagram?.id;
    // Let React commit the new positions and React Flow measure resized containers
    // before fitting. Do not move the viewport after navigation or a cloud lock.
    frame.current = requestAnimationFrame(() => {
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const latest = cloudWorkspace.getState();
        if (latest.diagram?.id !== diagramId || latest.locked || latest.status === "loading") {
          return;
        }
        void fitView({
          padding: 0.2,
          maxZoom: 1,
          duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 300,
        }).catch(() => {
          notify.error({
            title: "Could not fit the diagram in view",
            message: "The layout is formatted. Use Fit view to center it.",
          });
        });
      });
    });
  }, [cancelFrame, fitView]);

  return {
    autoFormat,
    disabled: nodeCount === 0 || cloud.locked || cloud.status === "loading" || pendingDeletes > 0,
  };
}
