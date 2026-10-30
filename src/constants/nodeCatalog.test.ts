import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import { NODE_TYPES_CONFIG, GROUP_TYPES_CONFIG } from "@/constants";
import { NODE_CATEGORIES } from "@/constants/nodeCategories";
import { architectureNodeTypeSchema, groupNodeTypeSchema, diagramDataSchema } from "@/schemas/diagram";
import type { ArchitectureNodeType, DiagramData } from "@/types";
import type { z } from "zod";

const originalTypes = [
  "service",
  "database",
  "queue",
  "cache",
  "gateway",
  "external",
  "storage",
  "client",
  "lambda",
  "loadbalancer",
  "cdn",
  "auth",
  "container",
  "dns",
  "llm",
  "vectordb",
  "mlpipeline",
  "embedding",
  "secrets",
  "eventbus",
  "datalake",
  "search",
  "notification",
] as const satisfies readonly ArchitectureNodeType[];

const representativeTypes = [
  "webapp",
  "mobileapp",
  "bff",
  "worker",
  "kubernetes",
  "firewall",
  "graphdb",
  "etl",
  "tracing",
  "agent",
  "guardrail",
  "inference",
  "tool",
  "payment",
  "identity",
  "iot",
] as const satisfies readonly ArchitectureNodeType[];

describe("node catalog", () => {
  it("keeps the type union, schema, and category types aligned", () => {
    expectTypeOf<
      z.infer<typeof architectureNodeTypeSchema>
    >().toEqualTypeOf<ArchitectureNodeType>();
    expectTypeOf<
      (typeof NODE_CATEGORIES)[number]["types"][number]
    >().toEqualTypeOf<ArchitectureNodeType>();
  });

  it("has exactly one config and category entry for every schema type", () => {
    const types = Object.keys(NODE_TYPES_CONFIG);
    const categorized = NODE_CATEGORIES.flatMap((category) => [...category.types]);

    expect([...types].sort()).toEqual([...architectureNodeTypeSchema.options].sort());
    expect([...categorized].sort()).toEqual([...types].sort());
    expect(new Set(categorized).size).toBe(categorized.length);
    expect(new Set(NODE_CATEGORIES.map((category) => category.id)).size).toBe(
      NODE_CATEGORIES.length,
    );
    expect(types.length - originalTypes.length).toBeGreaterThanOrEqual(45);
    expect(types.length - originalTypes.length).toBeLessThanOrEqual(55);
  });

  it.each(originalTypes)("retains the original %s identifier", (type) => {
    expect(NODE_TYPES_CONFIG[type]).toBeDefined();
    expect(architectureNodeTypeSchema.parse(type)).toBe(type);
  });

  it.each(architectureNodeTypeSchema.options)("provides a complete config for %s", (type) => {
    const config = NODE_TYPES_CONFIG[type];
    for (const field of [
      "label",
      "description",
      "iconColor",
      "bgClass",
      "borderClass",
      "color",
      "bgLight",
      "bgDark",
      "borderLight",
      "borderDark",
    ] as const) {
      expect(config[field].trim().length).toBeGreaterThan(0);
    }
    expect(config.icon).toBeDefined();
    expect(config.keywords?.length).not.toBe(0);
    expect((config.keywords ?? []).every((keyword) => keyword.trim().length > 0)).toBe(true);
  });

  it.each(representativeTypes)("round-trips a serialized diagram containing %s", (type) => {
    const diagram: DiagramData = {
      nodes: [
        {
          id: "group",
          type: "group",
          position: { x: 0, y: 0 },
          data: { label: "Application", groupType: "cluster" },
        },
        {
          id: "node",
          type: "architecture",
          position: { x: 40, y: 60 },
          parentId: "group",
          extent: "parent",
          data: {
            type,
            label: NODE_TYPES_CONFIG[type].label,
            description: "Catalog round-trip test",
            technology: "Custom implementation",
            status: "active",
            tags: ["catalog"],
            metadata: { owner: "platform" },
          },
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const parsed = diagramDataSchema.parse(JSON.parse(JSON.stringify(diagram)));
    expect(parsed).toEqual(diagram);
    expect(diagramDataSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(diagram);
  });

  it.each(["boundary", "view"] as const)(
    "round-trips %s architectural containers",
    (groupType) => {
      expect(groupNodeTypeSchema.parse(groupType)).toBe(groupType);
      expect(GROUP_TYPES_CONFIG[groupType]).toBeDefined();
      const diagram = {
        nodes: [
          {
            id: "group",
            type: "group",
            position: { x: 0, y: 0 },
            data: { label: "Custom scope", groupType },
          },
        ],
        edges: [],
      };
      expect(diagramDataSchema.parse(diagram)).toEqual(diagram);
    },
  );

  it("round-trips reasoning on nodes, groups and API edges", () => {
    const decision = {
      reason: "Reduce latency",
      alternatives: "Direct database reads",
      tradeoffs: "Staleness",
      assumptions: "Read-heavy workload",
    };
    const diagram = {
      nodes: [
        {
          id: "service",
          type: "architecture",
          position: { x: 0, y: 0 },
          data: { type: "service", label: "API", decision },
        },
        {
          id: "boundary",
          type: "group",
          position: { x: 0, y: 0 },
          data: { groupType: "boundary", label: "Trust boundary", decision },
        },
      ],
      edges: [
        {
          id: "request",
          type: "architecture",
          source: "service",
          target: "boundary",
          data: { protocol: "http", decision },
        },
      ],
    };
    expect(diagramDataSchema.parse(diagram)).toEqual(diagram);
  });

  it("rejects unknown node types instead of silently coercing them", () => {
    expect(architectureNodeTypeSchema.safeParse("unknown-node").success).toBe(false);
  });
});
