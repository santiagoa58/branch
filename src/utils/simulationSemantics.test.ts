import { describe, expect, it } from "vite-plus/test";
import type { Edge, Node } from "@xyflow/react";
import type { ArchitectureNodeType } from "@/types";
import { simulationHopMs } from "./simulationSemantics";

const connection: Edge = { id: "read", source: "app", target: "destination" };
const destination = (type: ArchitectureNodeType): Node => ({
  id: "destination",
  type: "architecture",
  position: { x: 0, y: 0 },
  data: { type },
});

describe("simulationHopMs", () => {
  it.each([
    ["cache", 2],
    ["gateway", 5],
    ["queue", 5],
    ["stream", 5],
    ["database", 10],
    ["service", 20],
    ["worker", 40],
    ["storage", 50],
  ] as const)("times a %s interaction according to its role", (type, expected) => {
    expect(simulationHopMs(connection, [destination(type)])).toBe(expected);
  });

  it.each([0, 2, 350])("honors an explicit latency of %s ms over role defaults", (latencyMs) => {
    expect(simulationHopMs({ ...connection, data: { latencyMs } }, [destination("storage")])).toBe(
      latencyMs,
    );
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, "5"])(
    "uses role timing when an override is invalid (%s)",
    (latencyMs) => {
      expect(simulationHopMs({ ...connection, data: { latencyMs } }, [destination("cache")])).toBe(
        2,
      );
    },
  );

  it("does not interpret a container or an unknown role as an executable cache", () => {
    const cache = destination("cache");
    expect(simulationHopMs(connection, [{ ...cache, type: "group" }])).toBe(100);
    expect(simulationHopMs(connection, [{ ...cache, data: { type: "future-component" } }])).toBe(
      100,
    );
    expect(simulationHopMs(connection)).toBe(100);
  });
});
