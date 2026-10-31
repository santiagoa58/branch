import { describe, expect, expectTypeOf, it } from "vite-plus/test";
import { NODE_TYPES_CONFIG, GROUP_TYPES_CONFIG } from "@/constants";
import { NODE_CATEGORIES } from "@/constants/nodeCategories";
import {
  architectureNodeTypeSchema,
  groupNodeTypeSchema,
  diagramDataSchema,
  RETIRED_NODE_TYPES,
} from "@/schemas/diagram";
import type { ArchitectureNodeType, DiagramData } from "@/types";
import type { z } from "zod";

const representativeTypes = [
  "user",
  "webapp",
  "mobileapp",
  "clientstorage",
  "sdk",
  "edgefunction",
  "bff",
  "worker",
  "coordinator",
  "server",
  "firewall",
  "graphdb",
  "etl",
  "tracing",
  "agent",
  "guardrail",
  "inference",
  "tool",
  "auth",
  "external",
  "iot",
] as const satisfies readonly ArchitectureNodeType[];

// Vendor names belong in a node's label or icon, never in the generic type's label.
const VENDOR_NAMES =
  /\b(postgres(ql)?|mysql|redis|rabbitmq|kafka|s3|dynamodb|mongodb|kubernetes|lambda)\b/i;

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
  });

  it("gives every type a distinct, role-based label and description", () => {
    const configs = Object.values(NODE_TYPES_CONFIG);
    const labels = configs.map((config) => config.label.toLowerCase());
    const descriptions = configs.map((config) => config.description.toLowerCase());
    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    for (const config of configs) {
      expect(config.label, `${config.label} names a vendor`).not.toMatch(VENDOR_NAMES);
    }
  });

  it.each(Object.entries(RETIRED_NODE_TYPES))(
    "no longer offers %s and maps it to %s",
    (retired, replacement) => {
      expect(architectureNodeTypeSchema.safeParse(retired).success).toBe(false);
      expect(NODE_TYPES_CONFIG[replacement]).toBeDefined();
    },
  );

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

  it.each(["boundary", "view"] as const)("round-trips %s architectural containers", (groupType) => {
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
  });

  it("round-trips reasoning on nodes, groups and API edges", () => {
    const decision = {
      reason: "Reduce latency",
      considered: [{ option: "Direct database reads", whyNot: "Slower" }],
      drawbacks: ["Staleness"],
      revisitWhen: ["Writes dominate"],
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

  it("rewrites retired node types when a saved diagram loads", () => {
    const saved = {
      nodes: [
        {
          id: "cluster",
          type: "architecture",
          position: { x: 0, y: 0 },
          data: { label: "Production cluster", type: "kubernetes" },
        },
        {
          id: "pay",
          type: "architecture",
          position: { x: 200, y: 0 },
          data: { label: "Stripe", type: "payment", description: "Card payments" },
        },
      ],
      edges: [{ id: "e", source: "cluster", target: "pay", data: { protocol: "http" } }],
    };
    const parsed = diagramDataSchema.parse(saved);
    expect(parsed.nodes.map((node) => ("type" in node.data ? node.data.type : null))).toEqual([
      "server",
      "external",
    ]);
    expect(parsed.nodes[1]?.data).toEqual({
      label: "Stripe",
      type: "external",
      description: "Card payments",
    });
  });

  it("turns a saved Microfrontend node into a Microfrontend group with its details", () => {
    const decision = { choice: "Module federation", benefits: ["Teams deploy alone"] };
    const parsed = diagramDataSchema.parse({
      nodes: [
        {
          id: "checkout",
          type: "architecture",
          position: { x: 40, y: 60 },
          data: { label: "Checkout", type: "microfrontend", description: "Cart and pay", decision },
        },
      ],
      edges: [],
    });
    expect(parsed.nodes[0]).toMatchObject({
      id: "checkout",
      type: "group",
      position: { x: 40, y: 60 },
      zIndex: -1,
      data: {
        label: "Checkout",
        groupType: "microfrontend",
        collapsed: false,
        description: "Cart and pay",
        decision,
      },
    });
  });
});

describe("left-to-right connection ports", () => {
  it("rewrites saved edges that named the old side handles onto the default ports", () => {
    const parsed = diagramDataSchema.parse({
      nodes: [
        {
          id: "a",
          type: "architecture",
          position: { x: 0, y: 0 },
          data: { label: "A", type: "service" },
        },
        {
          id: "b",
          type: "architecture",
          position: { x: 300, y: 0 },
          data: { label: "B", type: "service" },
        },
      ],
      edges: [
        { id: "side", source: "a", target: "b", sourceHandle: "right", targetHandle: "left" },
        { id: "stacked", source: "a", target: "b", sourceHandle: "bottom", targetHandle: "top" },
      ],
    });
    expect(parsed.edges[0]).toEqual({ id: "side", source: "a", target: "b" });
    expect(parsed.edges[1]).toMatchObject({ sourceHandle: "bottom", targetHandle: "top" });
  });
});
