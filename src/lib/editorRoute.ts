export function loadEditor() {
  return import("../App");
}

/** Warm the editor bundle on link intent without loading or switching documents. */
export function preloadEditor() {
  void loadEditor().catch(() => {
    // Navigation will surface a module load failure through the route's error boundary.
  });
}
