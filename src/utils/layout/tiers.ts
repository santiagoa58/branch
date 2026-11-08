import type { Node } from "@xyflow/react";
import { NODE_TIERS, tierIndex, type LayoutTier } from "@/constants/layoutTiers";
import { architectureNodeTypeSchema } from "@/schemas/catalogEnums";
import type { Hierarchy } from "./hierarchy";

const DEFAULT_TIER: LayoutTier = "services";

/** The zone of an architecture node, from its catalog type; undefined for other nodes. */
export function architectureTier(node: Node): LayoutTier | undefined {
  if (node.type !== "architecture") {
    return undefined;
  }
  const type = architectureNodeTypeSchema.safeParse(node.data["type"]);
  return type.success ? NODE_TIERS[type.data] : DEFAULT_TIER;
}

/**
 * Zone index of every node that takes part in zoned layout. A container sits in the earliest
 * zone of the components inside it, so a group starts where requests enter it; an empty one is
 * a service. Comments have no zone.
 */
export function layoutTiers(hierarchy: Hierarchy): Map<string, number | undefined> {
  const tiers = new Map<string, number | undefined>();
  for (const node of [...hierarchy.preorder].reverse()) {
    if (node.type === "comment") {
      tiers.set(node.id, undefined);
      continue;
    }
    const own = architectureTier(node);
    if (own !== undefined && !hierarchy.children.has(node.id)) {
      tiers.set(node.id, tierIndex(own));
      continue;
    }
    const inner = (hierarchy.children.get(node.id) ?? [])
      .map((child) => tiers.get(child.id))
      .filter((tier) => tier !== undefined);
    const candidates = own === undefined ? inner : [tierIndex(own), ...inner];
    tiers.set(node.id, candidates.length > 0 ? Math.min(...candidates) : tierIndex(DEFAULT_TIER));
  }
  return tiers;
}
