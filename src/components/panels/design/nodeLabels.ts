import type { Node } from "@xyflow/react";
import { nodeIdentity } from "@/utils/aiDesign/inputs";

/** Node id to its label, for turning the keys the AI returns into names. */
export function labelLookup(nodes: readonly Node[]): (key: string) => string {
  const labels = new Map<string, string>();
  for (const node of nodes) {
    // An empty label reads as none, so the key stays.
    const { label } = nodeIdentity(node);
    if (label !== "") {
      labels.set(node.id, label);
    }
  }
  // A key no component has stays readable as it is.
  return (key) => labels.get(key) ?? key;
}
