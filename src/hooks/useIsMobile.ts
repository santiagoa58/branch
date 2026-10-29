import { useState, useEffect } from "react";

/**
 * Returns true when the viewport width is below `breakpoint` (default 768px).
 * Responds to window resize / orientation changes.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    const frame = requestAnimationFrame(() => setIsMobile(mq.matches));
    mq.addEventListener("change", handler);
    return () => {
      cancelAnimationFrame(frame);
      mq.removeEventListener("change", handler);
    };
  }, [breakpoint]);

  return isMobile;
}
