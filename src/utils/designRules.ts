import type { Edge, Node } from "@xyflow/react";
import type { ArchitectureNodeType, EdgeProtocol } from "@/types";

/** Things outside the system: people, their devices, and third parties calling in. */
const OUTSIDE_ACTORS: ReadonlySet<ArchitectureNodeType> = new Set([
  "user",
  "webapp",
  "mobileapp",
  "client",
  "iot",
  "external",
]);

/** Public entry points that are designed to receive traffic from outside. */
const ENTRY_POINTS: ReadonlySet<ArchitectureNodeType> = new Set([
  "dns",
  "cdn",
  "edgefunction",
  "loadbalancer",
  "gateway",
  "firewall",
  "ratelimiter",
  "proxy",
  // Sign-in redirects go to the identity provider, uploads use presigned object URLs, and
  // apps call third-party APIs directly; each is a public endpoint by design.
  "auth",
  "storage",
  "external",
  // People and apps talk to each other, such as a user opening an app.
  "user",
  "webapp",
  "mobileapp",
  "client",
]);

/** Real-time media and game traffic connects to an assigned server by design. */
const DIRECT_PROTOCOLS: ReadonlySet<EdgeProtocol> = new Set(["webrtc", "udp"]);

export interface IngressBypass {
  edgeId: string;
  source: string;
  target: string;
}

function architectureType(node: Node | undefined): ArchitectureNodeType | undefined {
  if (node?.type !== "architecture") {
    return undefined;
  }
  return (node.data as { type: ArchitectureNodeType }).type;
}

/**
 * Connections where something outside the system reaches an internal component without an
 * entry point in between, such as a browser POSTing straight to a backend service.
 */
export function findIngressBypasses(nodes: Node[], edges: Edge[]): IngressBypass[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return edges.flatMap((edge) => {
    const sourceType = architectureType(byId.get(edge.source));
    const targetType = architectureType(byId.get(edge.target));
    const protocol = (edge.data as { protocol?: EdgeProtocol } | undefined)?.protocol;
    if (
      !sourceType ||
      !targetType ||
      !OUTSIDE_ACTORS.has(sourceType) ||
      ENTRY_POINTS.has(targetType) ||
      (protocol !== undefined && DIRECT_PROTOCOLS.has(protocol))
    ) {
      return [];
    }
    return [{ edgeId: edge.id, source: edge.source, target: edge.target }];
  });
}
