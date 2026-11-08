import type { ArchitectureAttribute, ArchitectureNodeType, DesignDecision } from "@/types";

/**
 * Compact authoring helper for template decisions. Each entry is a short phrase so the
 * decision card stays scannable; considered options are [option, why not] pairs.
 */
// oxlint-disable-next-line max-params -- debt: 6 params; take an options object
export function decide(
  choice: string,
  reason: string,
  benefits: string[],
  drawbacks: string[],
  considered: [option: string, whyNot: string][],
  revisitWhen: string[],
): DesignDecision {
  return {
    choice,
    reason,
    benefits,
    drawbacks,
    considered: considered.map(([option, whyNot]) => ({ option, whyNot })),
    revisitWhen,
  };
}

// Numeric defaults are explicitly illustrative planning inputs, never observed production metrics.
const NODE_ATTRIBUTES: Partial<Record<ArchitectureNodeType, ArchitectureAttribute[]>> = {
  cache: [{ name: "Illustrative cache TTL", value: "60", unit: "s" }],
  queue: [{ name: "Illustrative retry limit", value: "5", unit: "attempts" }],
  database: [{ name: "Illustrative backup interval", value: "24", unit: "h" }],
  stream: [{ name: "Illustrative replay retention", value: "7", unit: "days" }],
  storage: [{ name: "Illustrative signed URL lifetime", value: "15", unit: "min" }],
  cdn: [{ name: "Illustrative public asset TTL", value: "3600", unit: "s" }],
  worker: [{ name: "Illustrative concurrency per worker", value: "4", unit: "jobs" }],
  lambda: [{ name: "Illustrative execution timeout", value: "30", unit: "s" }],
  llm: [{ name: "Illustrative output budget", value: "2048", unit: "tokens" }],
  retriever: [{ name: "Illustrative retrieval limit", value: "8", unit: "chunks" }],
  agent: [{ name: "Illustrative loop budget", value: "6", unit: "steps" }],
  dns: [{ name: "Illustrative record TTL", value: "300", unit: "s" }],
  timeseries: [{ name: "Illustrative raw retention", value: "30", unit: "days" }],
};

export function nodeAttributes(type: ArchitectureNodeType): ArchitectureAttribute[] {
  return (NODE_ATTRIBUTES[type] ?? []).map((attribute) => ({ ...attribute }));
}
