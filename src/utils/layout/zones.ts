import type { Node } from "@xyflow/react";
import {
  CLIENT_TIER,
  LAYOUT_TIERS,
  LAYOUT_TIER_LABELS,
  tierIndex,
  type LayoutTier,
} from "@/constants/layoutTiers";
import { absoluteRects, type Rect } from "./geometry";
import { architectureTier } from "./tiers";

interface ZoneBand {
  /** A layout tier, or "server" for everything server-side when the tiers interleave. */
  zone: LayoutTier | "server";
  label: string;
  x: number;
  width: number;
}

export interface ZoneBands {
  bands: ZoneBand[];
  top: number;
  height: number;
  /** Where the client side ends and the server side begins, when both are present. */
  divider?: number;
}

const PADDING = 40;
/** Room above the topmost node for the zone labels. */
const HEADER = 44;

interface Extent {
  left: number;
  right: number;
}

/** Visible components with their zone; a collapsed group stands for its hidden components. */
function zonedRects(nodes: Node[]): { tier: LayoutTier; rect: Rect }[] {
  const rects = absoluteRects(nodes);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const collapsedAncestor = (node: Node): Node | undefined => {
    let found: Node | undefined;
    const seen = new Set<string>();
    for (
      let parent = byId.get(node.parentId ?? "");
      parent && !seen.has(parent.id);
      parent = byId.get(parent.parentId ?? "")
    ) {
      seen.add(parent.id);
      if (parent.type === "group" && parent.data["collapsed"] === true) {
        found = parent;
      }
    }
    return found;
  };
  const zoned: { tier: LayoutTier; rect: Rect }[] = [];
  for (const node of nodes) {
    const tier = architectureTier(node);
    if (tier === undefined) {
      continue;
    }
    const stand = collapsedAncestor(node) ?? node;
    if (stand === node && node.hidden === true) {
      continue;
    }
    zoned.push({ tier, rect: rects.get(stand.id)! });
  }
  return zoned;
}

function ordered(extents: Extent[]): boolean {
  return extents.every((extent, index) => index === 0 || extents[index - 1]!.right < extent.left);
}

function bandsFrom(zones: { zone: ZoneBand["zone"]; label: string; extent: Extent }[]): ZoneBand[] {
  return zones.map(({ zone, label, extent }, index) => {
    const previous = zones[index - 1]?.extent;
    const next = zones[index + 1]?.extent;
    // Neighboring bands meet halfway across the gap between their components.
    const left = previous ? (previous.right + extent.left) / 2 : extent.left - PADDING;
    const right = next ? (extent.right + next.left) / 2 : extent.right + PADDING;
    return { zone, label, x: left, width: right - left };
  });
}

/**
 * Background bands for the canvas, from the current positions: one per zone that has
 * components, left to right. When the zones interleave (a hand-arranged diagram), only the
 * client/server split is shown, and nothing when even that is mixed. Display-only and pure.
 */
export function zoneBands(nodes: Node[]): ZoneBands | null {
  const zoned = zonedRects(nodes);
  const extents = new Map<LayoutTier, Extent>();
  for (const { tier, rect } of zoned) {
    const extent = extents.get(tier);
    extents.set(tier, {
      left: Math.min(extent?.left ?? Infinity, rect.x),
      right: Math.max(extent?.right ?? -Infinity, rect.x + rect.width),
    });
  }
  const present = LAYOUT_TIERS.filter((tier) => extents.has(tier));
  if (present.length < 2) {
    return null;
  }
  const top = Math.min(...zoned.map(({ rect }) => rect.y)) - PADDING - HEADER;
  const bottom = Math.max(...zoned.map(({ rect }) => rect.y + rect.height)) + PADDING;

  let bands: ZoneBand[];
  if (ordered(present.map((tier) => extents.get(tier)!))) {
    bands = bandsFrom(
      present.map((tier) => ({
        zone: tier,
        label: LAYOUT_TIER_LABELS[tier],
        extent: extents.get(tier)!,
      })),
    );
  } else {
    const clients = extents.get(CLIENT_TIER);
    const servers = present.filter((tier) => tierIndex(tier) > tierIndex(CLIENT_TIER));
    const server = {
      left: Math.min(...servers.map((tier) => extents.get(tier)!.left)),
      right: Math.max(...servers.map((tier) => extents.get(tier)!.right)),
    };
    if (!clients || !ordered([clients, server])) {
      return null;
    }
    bands = bandsFrom([
      { zone: CLIENT_TIER, label: LAYOUT_TIER_LABELS[CLIENT_TIER], extent: clients },
      { zone: "server", label: "Server", extent: server },
    ]);
  }
  const clientBand = bands[0]!.zone === CLIENT_TIER ? bands[0] : undefined;
  return {
    bands,
    top,
    height: bottom - top,
    ...(clientBand ? { divider: clientBand.x + clientBand.width } : {}),
  };
}
