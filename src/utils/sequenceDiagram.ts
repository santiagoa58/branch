/**
 * Sequence-diagram generation from a traced flow path.
 *
 * Pure functions — no side effects, no store dependencies. Given a `FlowPath`
 * (produced by `traceFlowPath`) plus the diagram's nodes/edges, emit a Mermaid
 * `sequenceDiagram` source string that reads as an ordered request trace.
 *
 * This reuses the same BFS-ordered steps the flow simulation animates, so the
 * sequence diagram and the on-canvas packet animation always describe the same
 * path.
 */
import { deflate } from "pako";
import type { Node, Edge } from "@xyflow/react";
import type { ArchitectureEdgeData } from "@/types";
import type { FlowPath } from "@/types/simulation";
import { PROTOCOL_CONFIG } from "@/constants";

export interface SequenceDiagramOptions {
  /** Emit Mermaid `autonumber` so each message is numbered. Default true. */
  autonumber?: boolean;
  /** Append per-edge latency as `(123ms)` when present. Default true. */
  includeLatency?: boolean;
  /** Append the edge's data-contract schema name as `• Name`. Default true. */
  includeSchema?: boolean;
  /** Title comment emitted at the top of the diagram. */
  title?: string;
}

/** Turn an arbitrary node id into a Mermaid-safe participant identifier. */
function toSafeId(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_]/g, "_");
  return /^[0-9]/.test(safe) ? `n_${safe}` : safe || "n";
}

/**
 * Sanitize text destined for a Mermaid label or message. Newlines and
 * semicolons terminate statements, so collapse them; trim the result.
 */
function sanitizeText(text: string): string {
  return text
    .replace(/[\r\n]+/g, " ")
    .replace(/;/g, ",")
    .trim();
}

const nodeLabel = (node: Node | undefined, fallback: string): string => {
  const label = node?.data?.["label"];
  return typeof label === "string" && label.trim() ? label : fallback;
};

/**
 * Build the message text shown on a sequence arrow, e.g.
 * `HTTP/REST GET • CreateUser (12ms)`.
 */
function buildMessage(
  data: ArchitectureEdgeData | undefined,
  opts: Required<Omit<SequenceDiagramOptions, "title">>,
): string {
  const protocol = data?.protocol;
  const parts: string[] = [];

  const protoLabel = protocol
    ? (PROTOCOL_CONFIG[protocol]?.label ?? protocol.toUpperCase())
    : (data?.label ?? "call");
  parts.push(protoLabel);

  if (data?.method) {
    parts.push(data.method);
  }

  let message = parts.join(" ");

  if (opts.includeSchema && data?.dataContract?.schemaName) {
    message += ` • ${data.dataContract.schemaName}`;
  }
  if (opts.includeLatency && typeof data?.latencyMs === "number") {
    message += ` (${data.latencyMs}ms)`;
  }

  return sanitizeText(message);
}

/**
 * Decide which Mermaid arrow to use. Fire-and-forget protocols (those whose
 * `PROTOCOL_CONFIG.requestResponse` is false) and edges explicitly marked
 * `async` render as the async open arrow `-)`; everything else is the solid
 * sync arrow `->>`.
 */
function arrowFor(data: ArchitectureEdgeData | undefined): "->>" | "-)" {
  const protocol = data?.protocol;
  const protocolIsAsync = protocol ? !PROTOCOL_CONFIG[protocol]?.requestResponse : false;
  return data?.async === true || protocolIsAsync ? "-)" : "->>";
}

/**
 * Convert a traced `FlowPath` into a Mermaid `sequenceDiagram` source string.
 *
 * Participants are declared in path order (left-to-right = traversal order).
 * Each `FlowPath.step` becomes one message arrow; bidirectional edges already
 * appear as a forward and a return step in the trace, so they render as two
 * arrows without special handling here.
 */
export function flowPathToMermaidSequence(
  nodes: Node[],
  edges: Edge[],
  flowPath: FlowPath,
  options: SequenceDiagramOptions = {},
): string {
  const opts = {
    autonumber: options.autonumber ?? true,
    includeLatency: options.includeLatency ?? true,
    includeSchema: options.includeSchema ?? true,
  };

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const edgeById = new Map(edges.map((e) => [e.id, e]));

  // Assign a unique, Mermaid-safe participant id to every node in the path.
  const usedIds = new Set<string>();
  const participantId = new Map<string, string>();
  const ensureParticipant = (nodeId: string): string => {
    const existing = participantId.get(nodeId);
    if (existing) {
      return existing;
    }
    let safe = toSafeId(nodeId);
    let suffix = 1;
    while (usedIds.has(safe)) {
      safe = `${toSafeId(nodeId)}_${suffix++}`;
    }
    usedIds.add(safe);
    participantId.set(nodeId, safe);
    return safe;
  };

  const lines: string[] = [];
  if (options.title) {
    lines.push(`%% ${sanitizeText(options.title)}`);
  }
  lines.push("sequenceDiagram");
  if (opts.autonumber) {
    lines.push("    autonumber");
  }

  // Declare participants in path order so lifelines read in traversal order.
  for (const nodeId of flowPath.nodeIds) {
    const id = ensureParticipant(nodeId);
    const label = sanitizeText(nodeLabel(nodeById.get(nodeId), nodeId));
    lines.push(`    participant ${id} as ${label}`);
  }

  if (flowPath.steps.length === 0) {
    const sourceId = flowPath.nodeIds[0];
    if (sourceId) {
      lines.push(`    Note over ${ensureParticipant(sourceId)}: No outgoing connections`);
    }
    return lines.join("\n");
  }

  for (const step of flowPath.steps) {
    const from = ensureParticipant(step.fromNodeId);
    const to = ensureParticipant(step.toNodeId);
    const data = edgeById.get(step.edgeId)?.data;
    const arrow = arrowFor(data);
    const message = buildMessage(data, opts);
    lines.push(`    ${from}${arrow}${to}: ${message}`);
  }

  return lines.join("\n");
}

/** URL-safe base64 of raw bytes (mermaid.live's `pako:` payload encoding). */
function base64UrlFromBytes(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode.apply(null, Array.from(bytes)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Build a mermaid.live edit URL that renders the given source. Note: opening
 * this link sends the diagram source to the external mermaid.live service.
 */
export function toMermaidLiveUrl(code: string): string {
  const state = {
    code,
    mermaid: JSON.stringify({ theme: "default" }),
    autoSync: true,
    updateDiagram: true,
  };
  const compressed = deflate(JSON.stringify(state), { level: 9 });
  return `https://mermaid.live/edit#pako:${base64UrlFromBytes(compressed)}`;
}

/** Wrap a Mermaid source in a fenced ```mermaid block for Markdown export. */
export function wrapMermaidMarkdown(code: string, title = "Sequence Diagram"): string {
  return `# ${title}\n\n\`\`\`mermaid\n${code}\n\`\`\`\n`;
}
