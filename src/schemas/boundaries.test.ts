import { describe, expect, it } from "vite-plus/test";
import { architectureAnalysisResponseSchema, connectionSuggestionsResponseSchema } from "./ai";
import { apiDiagramSchema, updateDiagramRequestSchema } from "./api";
import { diagramDataSchema } from "./diagram";
import { iconifySearchResponseSchema } from "./iconify";
import { analysisCacheSchema } from "./persistence";

const node = {
  id: "service-1",
  type: "architecture",
  position: { x: 0, y: 0 },
  data: { label: "API", type: "service" },
};

const analysis = {
  summary: "A single service",
  score: 70,
  issues: [],
  recommendations: [],
};

describe("external response contracts", () => {
  it.each([
    {},
    { ...analysis, score: "70" },
    { ...analysis, score: null },
    { ...analysis, issues: [null] },
    { ...analysis, issues: [{ severity: "unknown" }] },
    { ...analysis, recommendations: "none" },
  ])("rejects malformed AI analysis instead of inventing defaults: %j", (input) => {
    expect(architectureAnalysisResponseSchema.safeParse(input).success).toBe(false);
  });

  it("accepts a valid analysis and adds its timestamp", () => {
    const parsed = architectureAnalysisResponseSchema.parse(analysis);
    expect(parsed.score).toBe(70);
    expect(parsed.analyzedAt).toBeInstanceOf(Date);
  });

  it.each([
    {},
    { suggestions: "none" },
    { suggestions: [{ sourceId: "a", targetId: "b", protocol: "invalid" }] },
    {
      suggestions: [
        {
          id: "s",
          sourceId: "a",
          targetId: "b",
          protocol: "http",
          reason: "Connect",
          confidence: null,
        },
      ],
    },
  ])("rejects malformed AI suggestions: %j", (input) => {
    expect(connectionSuggestionsResponseSchema.safeParse(input).success).toBe(false);
  });

  it.each([{}, { icons: "bad", total: 2 }, { icons: [], total: null }, { icons: [], total: "2" }])(
    "rejects malformed Iconify search responses: %j",
    (input) => {
      expect(iconifySearchResponseSchema.safeParse(input).success).toBe(false);
    },
  );

  it("validates nested diagram data in API requests and responses", () => {
    const invalid = { nodes: [node], edges: "invalid" };
    expect(updateDiagramRequestSchema.safeParse({ data: invalid }).success).toBe(false);
    expect(
      apiDiagramSchema.safeParse({
        id: "d",
        projectId: "p",
        name: "Diagram",
        description: null,
        data: invalid,
        thumbnail: null,
        version: 1,
        createdAt: "today",
        updatedAt: "today",
      }).success,
    ).toBe(false);
  });

  it("normalizes only the backend's exact empty diagram placeholder", () => {
    const base = {
      id: "d",
      projectId: "p",
      name: "Diagram",
      description: null,
      thumbnail: null,
      version: 1,
      createdAt: "today",
      updatedAt: "today",
    };
    expect(apiDiagramSchema.parse({ ...base, data: {} }).data).toEqual({ nodes: [], edges: [] });
    expect(apiDiagramSchema.safeParse({ ...base, data: { nodes: [] } }).success).toBe(false);
  });

  it.each([null, true, 123])("rejects invalid persisted analysis timestamps: %j", (analyzedAt) => {
    expect(
      analysisCacheSchema.safeParse({
        diagramHash: "hash",
        analysis: { ...analysis, analyzedAt },
        expiresAt: 123,
      }).success,
    ).toBe(false);
  });

  it("rejects dangling edges at every diagram boundary", () => {
    const invalid = { nodes: [node], edges: [{ id: "e", source: "service-1", target: "missing" }] };
    expect(diagramDataSchema.safeParse(invalid).success).toBe(false);
    expect(updateDiagramRequestSchema.safeParse({ data: invalid }).success).toBe(false);
  });

  it("rejects duplicate node and edge identifiers", () => {
    expect(diagramDataSchema.safeParse({ nodes: [node, node], edges: [] }).success).toBe(false);
    const edge = { id: "e", source: "service-1", target: "service-1" };
    expect(diagramDataSchema.safeParse({ nodes: [node], edges: [edge, edge] }).success).toBe(false);
  });
});

describe("persisted React Flow data", () => {
  it.each([
    { handles: [null] },
    { handles: [{ type: "invalid", position: "left", x: 0, y: 0 }] },
    { style: { width: {} } },
    { domAttributes: { dangerouslySetInnerHTML: { __html: "bad" } } },
  ])("rejects malformed node rendering properties: %j", (extra) => {
    expect(diagramDataSchema.safeParse({ nodes: [{ ...node, ...extra }], edges: [] }).success).toBe(
      false,
    );
  });

  it.each([
    { markerEnd: { type: "invalid" } },
    { label: { arbitrary: "object" } },
    { style: { strokeWidth: {} } },
    { selected: "yes" },
  ])("rejects malformed edge rendering properties: %j", (extra) => {
    expect(
      diagramDataSchema.safeParse({
        nodes: [node],
        edges: [{ id: "edge-1", source: "service-1", target: "service-1", ...extra }],
      }).success,
    ).toBe(false);
  });

  it("preserves supported group sizes, handles, positions and edge markers", () => {
    const parsed = diagramDataSchema.parse({
      nodes: [
        {
          ...node,
          sourcePosition: "right",
          style: { width: 300, height: 250, opacity: 0.8 },
          handles: [{ id: "out", type: "source", position: "right", x: 10, y: 20 }],
        },
      ],
      edges: [
        {
          id: "edge-1",
          source: "service-1",
          target: "service-1",
          markerEnd: { type: "arrowclosed" },
          label: "HTTP",
        },
      ],
    });
    expect(parsed.nodes[0]?.style?.width).toBe(300);
    expect(parsed.edges[0]?.markerEnd).toEqual({ type: "arrowclosed" });
  });
});
