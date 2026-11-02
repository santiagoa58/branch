import { useCallback, useEffect, useRef } from "react";
import { useReactFlow, type FitView } from "@xyflow/react";
import { cloudWorkspace } from "@/services/cloudWorkspace";
import { notify } from "@/services/notify";
import { useDiagramStore } from "@/store/diagramStore";
import { editBlockReason, useEditBlocked } from "@/store/editLock";

/** Fit the formatted diagram, unless the user navigated away or the cloud locked it meanwhile. */
function fitIfStillOpen(fitView: FitView, diagramId: string | undefined) {
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
}

/** Shared command for the toolbar and keyboard; layout itself stays pure and DOM-free. */
export function useAutoFormat() {
  const { fitView } = useReactFlow();
  const nodeCount = useDiagramStore((state) => state.nodes.length);
  const editBlocked = useEditBlocked();
  const frame = useRef<number | null>(null);
  // The latest request; an older one, or one from an unmounted editor, must not fit the view.
  const request = useRef(0);

  const cancelFrame = useCallback(() => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
  }, []);
  useEffect(
    () => () => {
      request.current += 1;
      cancelFrame();
    },
    [cancelFrame],
  );

  const fitAfterLayout = useCallback(
    (diagramId: string | undefined) => {
      // Let React commit the new positions and React Flow measure resized containers
      // before fitting. Do not move the viewport after navigation or a cloud lock.
      frame.current = requestAnimationFrame(() => {
        frame.current = requestAnimationFrame(() => {
          frame.current = null;
          fitIfStillOpen(fitView, diagramId);
        });
      });
    },
    [fitView],
  );

  const run = useCallback(async () => {
    if (editBlockReason() !== null || useDiagramStore.getState().nodes.length === 0) {
      return;
    }
    cancelFrame();
    const current = ++request.current;
    const diagramId = cloudWorkspace.getState().diagram?.id;
    try {
      // The store drops a layout that would land on another diagram or during an edit block.
      await useDiagramStore.getState().applyAutoLayout();
    } catch {
      if (current === request.current) {
        notify.error({
          title: "Could not format the diagram",
          message: "Your previous layout is unchanged.",
        });
      }
      return;
    }
    if (current === request.current) {
      fitAfterLayout(diagramId);
    }
  }, [cancelFrame, fitAfterLayout]);

  const autoFormat = useCallback(() => {
    void run();
  }, [run]);

  return {
    autoFormat,
    disabled: nodeCount === 0 || editBlocked,
  };
}
