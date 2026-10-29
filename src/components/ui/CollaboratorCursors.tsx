import { type RefObject, useEffect, useState } from "react";
import type { RemoteCursor } from "@/hooks/useCollaboration";

interface CollaboratorCursorsProps {
  cursors: RemoteCursor[];
  flowToScreenPosition: (position: { x: number; y: number }) => { x: number; y: number };
  containerRef: RefObject<HTMLDivElement | null>;
}

export function CollaboratorCursors({
  cursors,
  flowToScreenPosition,
  containerRef,
}: CollaboratorCursorsProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateOffset = () => {
      const rect = container.getBoundingClientRect();
      setOffset({ x: rect.left, y: rect.top });
    };
    const frame = requestAnimationFrame(updateOffset);
    const observer = new ResizeObserver(updateOffset);
    observer.observe(container);
    window.addEventListener("scroll", updateOffset, true);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", updateOffset, true);
    };
  }, [containerRef]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[50] overflow-hidden">
      {cursors.map((c) => {
        if (!c.cursor) {
          return null;
        }
        // Convert flow coords → viewport coords → container-relative coords
        const screenPos = flowToScreenPosition(c.cursor);
        return (
          <div
            key={c.socketId}
            className="absolute transition-all duration-100 ease-out"
            style={{
              left: screenPos.x - offset.x,
              top: screenPos.y - offset.y,
              transform: "translate(-2px, -2px)",
            }}
          >
            {/* Cursor arrow */}
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none" className="drop-shadow-md">
              <path
                d="M0.928711 0.5L15.0713 10.9091L7.38612 11.3636L3.6107 19L0.928711 0.5Z"
                fill={c.color}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            {/* Name label */}
            <div
              className="absolute left-3 top-4 px-1.5 py-0.5 rounded text-[10px] font-medium text-white whitespace-nowrap shadow-sm"
              style={{ backgroundColor: c.color }}
            >
              {c.userName}
            </div>
          </div>
        );
      })}
    </div>
  );
}
