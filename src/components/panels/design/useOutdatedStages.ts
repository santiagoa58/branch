import { useMemo } from "react";
import type { DesignBrief } from "@/schemas/aiDesign";
import { useDiagramStore } from "@/store/diagramStore";
import {
  graphFingerprint,
  outdatedAgainst,
  stagesToRun,
  type OutdatedStages,
  type PipelineStage,
} from "@/utils/aiDesign/fingerprint";

interface OutdatedStagesState {
  /** The diagram brief's outdated stages; null while the diagram has no brief. */
  outdated: OutdatedStages | null;
  /** The stages an update would run for the diagram brief; empty without a brief. */
  next: PipelineStage[];
  /** The stages an update would run for another brief (a preview) against the same graph. */
  nextFor: (brief: DesignBrief) => PipelineStage[];
}

/**
 * Freshness of the diagram's design brief. Fingerprinting hashes the graph, so the graph hash is
 * redone only when the nodes or edges change and the stages only when the brief or that hash does.
 */
export function useOutdatedStages(): OutdatedStagesState {
  const brief = useDiagramStore((state) => state.brief);
  const nodes = useDiagramStore((state) => state.nodes);
  const edges = useDiagramStore((state) => state.edges);
  const graph = useMemo(() => graphFingerprint(nodes, edges), [nodes, edges]);

  return useMemo(() => {
    const outdated = brief ? outdatedAgainst(brief, graph) : null;
    return {
      outdated,
      next: brief && outdated ? stagesToRun(brief, outdated.stages) : [],
      nextFor: (candidate) => stagesToRun(candidate, outdatedAgainst(candidate, graph).stages),
    };
  }, [brief, graph]);
}
