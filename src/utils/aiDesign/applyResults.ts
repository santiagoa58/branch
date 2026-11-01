import type { Node } from "@xyflow/react";
import type { ApiOutput, DataModelOutput, DecisionsOutput, DesignBrief } from "@/schemas/aiDesign";
import type { DesignDecision } from "@/types";

/** Stage 3: write one decision to its node. An unknown key leaves the nodes unchanged. */
export function applyDecision(nodes: Node[], key: string, output: DecisionsOutput): Node[] {
  if (!nodes.some((node) => node.id === key)) {
    return nodes;
  }
  const decision: DesignDecision = {
    choice: output.choice,
    reason: output.reason,
    benefits: output.gains,
    drawbacks: output.costs,
    considered: output.considered,
    revisitWhen: output.revisitWhen,
  };
  return nodes.map((node) =>
    node.id === key ? { ...node, data: { ...node.data, decision } } : node,
  );
}

/** Stage 4: endpoints and events live in the brief. */
export function applyApi(brief: DesignBrief, output: ApiOutput, ranFrom: string): DesignBrief {
  return {
    ...brief,
    api: { endpoints: output.endpoints, events: output.events },
    ranFrom: { ...brief.ranFrom, api: ranFrom },
  };
}

/** Stage 5: entities live in the brief. */
export function applyDataModel(
  brief: DesignBrief,
  output: DataModelOutput,
  ranFrom: string,
): DesignBrief {
  return {
    ...brief,
    dataModel: { entities: output.entities },
    ranFrom: { ...brief.ranFrom, dataModel: ranFrom },
  };
}

/** Keys of endpoints whose service or any caller is not an architecture node. */
export function unknownEndpointRefs(brief: DesignBrief, nodes: Node[]): Set<string> {
  const known = new Set(nodes.filter((node) => node.type === "architecture").map((n) => n.id));
  const unknown = new Set<string>();
  for (const endpoint of brief.api?.endpoints ?? []) {
    if (!known.has(endpoint.service) || endpoint.calledBy.some((key) => !known.has(key))) {
      unknown.add(endpoint.key);
    }
  }
  return unknown;
}
