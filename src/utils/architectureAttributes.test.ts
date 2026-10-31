import { describe, expect, it } from "vite-plus/test";
import type { ArchitectureNodeData } from "@/types";
import { formatArchitectureAttribute, getNodeAttributes } from "./architectureAttributes";

describe("getNodeAttributes", () => {
  it("returns no attributes for an old node without metadata", () => {
    expect(getNodeAttributes({})).toEqual([]);
  });

  it("merges explicit attributes first and ignores legacy duplicate names", () => {
    const data: Pick<ArchitectureNodeData, "attributes" | "metadata"> = {
      attributes: [{ name: "TTL", value: "60", unit: "s" }],
      metadata: { " ttl ": "30s", Policy: "eventual", POLICY: "strong", Replicas: "3" },
    };
    expect(getNodeAttributes(data)).toEqual([
      { name: "TTL", value: "60", unit: "s" },
      { name: "Policy", value: "eventual" },
      { name: "Replicas", value: "3" },
    ]);
  });

  it("preserves freeform legacy values without guessing units or mutating the source", () => {
    const attributes = [{ name: "Memory", value: "512", unit: "MiB" }];
    const metadata = { TTL: "60s", Policy: "read your writes", Count: "3" };
    const result = getNodeAttributes({ attributes, metadata });
    expect(result.slice(1)).toEqual([
      { name: "TTL", value: "60s" },
      { name: "Policy", value: "read your writes" },
      { name: "Count", value: "3" },
    ]);
    expect(result).not.toBe(attributes);
    expect(result[0]).not.toBe(attributes[0]);
    expect(attributes).toEqual([{ name: "Memory", value: "512", unit: "MiB" }]);
    expect(metadata).toEqual({ TTL: "60s", Policy: "read your writes", Count: "3" });
  });
});

describe("formatArchitectureAttribute", () => {
  it.each([
    [{ name: "TTL", value: "60", unit: "s" }, "60 s"],
    [{ name: "Replicas", value: "3", unit: "replicas" }, "3 replicas"],
    [{ name: "Policy", value: "eventual" }, "eventual"],
    [{ name: "TTL", value: "60s" }, "60s"],
  ])("formats %j as %s", (attribute, formatted) => {
    expect(formatArchitectureAttribute(attribute)).toBe(formatted);
  });
});
