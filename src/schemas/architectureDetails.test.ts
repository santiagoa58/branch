import { describe, expect, it } from "vite-plus/test";
import {
  architectureAttributeInputSchema,
  architectureAttributeSchema,
  architectureNodeDataSchema,
  designDecisionSchema,
  diagramDataSchema,
} from "./diagram";

describe("architecture details compatibility", () => {
  it("round trips legacy fields without introducing attributes or changing freeform metadata", () => {
    const legacy = {
      label: "Orders",
      type: "service",
      technology: "Node.js",
      port: "3000",
      status: "warning",
      healthCheckUrl: "https://example.com/health",
      tags: ["critical"],
      iconColor: "#123456",
      accentColor: "var(--accent)",
      backgroundColor: "transparent",
      metadata: { TTL: "60s", replicas: "3", policy: "eventual" },
      decision: { reason: "Low latency", alternatives: "Polling", tradeoffs: "Memory" },
    };
    expect(architectureNodeDataSchema.parse(legacy)).toEqual(legacy);
  });

  it("persists typed attributes and a decision choice through the full diagram schema", () => {
    const diagram = {
      nodes: [
        {
          id: "orders",
          type: "architecture",
          position: { x: 0, y: 0 },
          data: {
            label: "Orders",
            type: "service",
            metadata: { legacyTTL: "60s" },
            attributes: [
              { name: "TTL", value: "60", unit: "s" },
              { name: "Policy", value: "eventual" },
            ],
            decision: { choice: "Cache reads", reason: "Reduce database load" },
          },
        },
      ],
      edges: [],
    };
    expect(diagramDataSchema.parse(diagram)).toEqual(diagram);
    expect(designDecisionSchema.parse({})).toEqual({});
    expect(designDecisionSchema.safeParse({ choice: 3 }).success).toBe(false);
  });

  it.each([
    { name: "", value: "60" },
    { name: "  ", value: "60" },
    { name: "TTL", value: "" },
    { name: "TTL", value: "  " },
    { name: "TTL", value: 60, unit: "s" },
    { name: "TTL", value: "60", unit: 3 },
    { name: "TTL", value: "60", unit: null },
    { name: "TTL", value: "60", unit: undefined },
    { name: "TTL", value: "60", unit: "" },
    { name: "TTL", value: "60", unit: " " },
    { name: "TTL", value: "60", unit: " s " },
    { name: "TTL", value: "60", unit: "s\n" },
    { name: "TTL", value: "60", unit: "s\u0000" },
    { name: "TTL", value: "60", unit: "s\u200b" },
    { name: "TTL", value: "60", unit: "a".repeat(65) },
    { name: "TTL", value: "60", unit: "s", extra: true },
  ])("rejects malformed attributes: %j", (attribute) => {
    expect(architectureAttributeSchema.safeParse(attribute).success).toBe(false);
    expect(
      architectureNodeDataSchema.safeParse({
        label: "Cache",
        type: "cache",
        attributes: [attribute],
      }).success,
    ).toBe(false);
  });

  it("accepts custom units, textual policies and legacy unitless numeric attributes", () => {
    for (const attribute of [
      { name: "Throughput", value: "120", unit: "requests/s" },
      { name: "Capacity", value: "3", unit: "shards" },
      { name: "Policy", value: "read your writes" },
      { name: "Legacy count", value: "3" },
    ]) {
      expect(architectureAttributeSchema.parse(attribute)).toEqual(attribute);
    }
  });

  it.each(["60", "0", "-1", "+2.5", ".5", "1e3", "-2.5e-3"])(
    "requires explicit units for numeric editor input %s",
    (value) => {
      expect(architectureAttributeInputSchema.safeParse({ name: "Capacity", value }).success).toBe(
        false,
      );
      expect(
        architectureAttributeInputSchema.safeParse({ name: "Capacity", value, unit: "count" })
          .success,
      ).toBe(true);
    },
  );

  it("does not reinterpret existing freeform values in editor input", () => {
    expect(architectureAttributeInputSchema.parse({ name: "TTL", value: "60s" })).toEqual({
      name: "TTL",
      value: "60s",
    });
  });
});
