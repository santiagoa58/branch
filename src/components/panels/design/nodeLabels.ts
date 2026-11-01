import type { Node } from "@xyflow/react";

/** Node id to its label, for turning the keys the AI returns into names. */
export function labelLookup(nodes: readonly Node[]): (key: string) => string {
  const labels = new Map<string, string>();
  for (const node of nodes) {
    const label = node.data["label"];
    if (typeof label === "string" && label !== "") {
      labels.set(node.id, label);
    }
  }
  // A key no component has stays readable as it is.
  return (key) => labels.get(key) ?? key;
}
