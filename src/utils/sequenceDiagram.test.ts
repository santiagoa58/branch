import { describe, it, expect } from "vite-plus/test";
import {
  flowPathToMermaidSequence,
  toMermaidLiveUrl,
  wrapMermaidMarkdown,
} from "@/utils/sequenceDiagram";
import type { ArchitectureNode, ArchitectureEdge } from "@/types";
import type { FlowPath } from "@/types/simulation";

const node = (id: string, label: string): ArchitectureNode => ({
  id,
  position: { x: 0, y: 0 },
  data: { label, type: "service" },
});

const edge = (
  id: string,
  source: string,
  target: string,
  data: Record<string, unknown> = {},
): ArchitectureEdge => ({ id, source, target, data });

describe("flowPathToMermaidSequence", () => {
  it("emits a sequenceDiagram header with autonumber and ordered participants", () => {
    const nodes = [node("a", "Web Client"), node("b", "API Gateway")];
    const edges = [edge("e1", "a", "b", { protocol: "http", method: "GET", latencyMs: 12 })];
    const path: FlowPath = {
      nodeIds: ["a", "b"],
      edgeIds: ["e1"],
      steps: [{ edgeId: "e1", fromNodeId: "a", toNodeId: "b", protocol: "http", latencyMs: 12 }],
    };

    const out = flowPathToMermaidSequence(nodes, edges, path);

    expect(out).toContain("sequenceDiagram");
    expect(out).toContain("autonumber");
    // Participants declared in path order
    const aIdx = out.indexOf("participant a as Web Client");
    const bIdx = out.indexOf("participant b as API Gateway");
    expect(aIdx).toBeGreaterThan(-1);
    expect(bIdx).toBeGreaterThan(aIdx);
    // Sync message with protocol label, method and latency
    expect(out).toContain("a->>b: HTTP/REST GET (12ms)");
  });

  it("uses the async arrow for fire-and-forget protocols", () => {
    const nodes = [node("svc", "Service"), node("q", "Kafka")];
    const edges = [edge("e1", "svc", "q", { protocol: "kafka" })];
    const path: FlowPath = {
      nodeIds: ["svc", "q"],
      edgeIds: ["e1"],
      steps: [{ edgeId: "e1", fromNodeId: "svc", toNodeId: "q", protocol: "kafka" }],
    };

    const out = flowPathToMermaidSequence(nodes, edges, path);
    expect(out).toContain("svc-)q: Kafka");
    expect(out).not.toContain("svc->>q");
  });

  it("appends the data-contract schema name", () => {
    const nodes = [node("a", "A"), node("b", "B")];
    const edges = [
      edge("e1", "a", "b", {
        protocol: "amqp",
        dataContract: { format: "json", schemaName: "TaskCreatedEvent" },
      }),
    ];
    const path: FlowPath = {
      nodeIds: ["a", "b"],
      edgeIds: ["e1"],
      steps: [{ edgeId: "e1", fromNodeId: "a", toNodeId: "b", protocol: "amqp" }],
    };

    const out = flowPathToMermaidSequence(nodes, edges, path);
    expect(out).toContain("• TaskCreatedEvent");
  });

  it("respects includeLatency / includeSchema / autonumber options", () => {
    const nodes = [node("a", "A"), node("b", "B")];
    const edges = [
      edge("e1", "a", "b", {
        protocol: "http",
        latencyMs: 50,
        dataContract: { format: "json", schemaName: "X" },
      }),
    ];
    const path: FlowPath = {
      nodeIds: ["a", "b"],
      edgeIds: ["e1"],
      steps: [{ edgeId: "e1", fromNodeId: "a", toNodeId: "b", protocol: "http", latencyMs: 50 }],
    };

    const out = flowPathToMermaidSequence(nodes, edges, path, {
      includeLatency: false,
      includeSchema: false,
      autonumber: false,
    });
    expect(out).not.toContain("autonumber");
    expect(out).not.toContain("(50ms)");
    expect(out).not.toContain("• X");
    expect(out).toContain("a->>b: HTTP/REST");
  });

  it("sanitizes labels with newlines and semicolons, and makes safe participant ids", () => {
    const nodes = [node("node-1", "Front;\nEnd"), node("node 2", "Back End")];
    const edges = [edge("e1", "node-1", "node 2", { protocol: "grpc" })];
    const path: FlowPath = {
      nodeIds: ["node-1", "node 2"],
      edgeIds: ["e1"],
      steps: [{ edgeId: "e1", fromNodeId: "node-1", toNodeId: "node 2", protocol: "grpc" }],
    };

    const out = flowPathToMermaidSequence(nodes, edges, path);
    expect(out).toContain("participant node_1 as Front, End");
    expect(out).toContain("participant node_2 as Back End");
    expect(out).toContain("node_1->>node_2: gRPC");
    expect(out).not.toContain("\n End");
  });

  it("emits a Note when the source has no outgoing connections", () => {
    const nodes = [node("lonely", "Lonely Service")];
    const path: FlowPath = { nodeIds: ["lonely"], edgeIds: [], steps: [] };

    const out = flowPathToMermaidSequence(nodes, [], path);
    expect(out).toContain("Note over lonely: No outgoing connections");
  });

  it('falls back to the node id when a node has no label, and "call" when no protocol', () => {
    const edges = [edge("e1", "a", "b", {})];
    const path: FlowPath = {
      nodeIds: ["a", "b"],
      edgeIds: ["e1"],
      steps: [{ edgeId: "e1", fromNodeId: "a", toNodeId: "b" }],
    };

    const out = flowPathToMermaidSequence([], edges, path);
    expect(out).toContain("participant a as a");
    expect(out).toContain("a->>b: call");
  });
});

describe("toMermaidLiveUrl", () => {
  it("produces a mermaid.live pako edit URL", () => {
    const url = toMermaidLiveUrl("sequenceDiagram\n    autonumber");
    expect(url.startsWith("https://mermaid.live/edit#pako:")).toBe(true);
    const payload = url.split("#pako:")[1];
    if (!payload) {
      throw new Error("Expected a non-empty mermaid.live payload");
    }
    expect(payload.length).toBeGreaterThan(0);
    // URL-safe base64 — no +, /, or = padding
    expect(payload).not.toMatch(/[+/=]/);
  });
});

describe("wrapMermaidMarkdown", () => {
  it("wraps source in a fenced mermaid block with a title", () => {
    const md = wrapMermaidMarkdown("sequenceDiagram", "My Flow");
    expect(md).toContain("# My Flow");
    expect(md).toContain("```mermaid\nsequenceDiagram\n```");
  });
});
