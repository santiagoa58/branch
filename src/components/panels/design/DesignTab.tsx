import type { Node } from "@xyflow/react";
import { useMemo } from "react";
import { TradeoffList } from "@/components/ui/TradeoffList";
import { GROUP_TYPES_CONFIG, NODE_TYPES_CONFIG } from "@/constants";
import { cn } from "@/lib/utils";
import { designDecisionSchema } from "@/schemas/diagram";
import { useDiagramStore } from "@/store/diagramStore";
import type { DesignDecision } from "@/types";
import { nodeIdentity, type NodeIdentity } from "@/utils/aiDesign/inputs";
import { getDocumentedDecision, hasDesignDecision } from "@/utils/designDecision";
import { Button } from "@/components/ui/button";
import { sectionLabelClass } from "./briefEdits";

const textClassName = "whitespace-pre-wrap wrap-anywhere text-pretty";

interface Component {
  id: string;
  label: string;
  kind: string;
  decision: DesignDecision | undefined;
}

function kindLabel(identity: NodeIdentity): string {
  if (identity.kind === "group") {
    return identity.type ? GROUP_TYPES_CONFIG[identity.type].label : "Group";
  }
  return identity.type ? NODE_TYPES_CONFIG[identity.type].label : "Component";
}

function componentsOf(nodes: readonly Node[]): Component[] {
  return nodes.flatMap((node) => {
    const identity = nodeIdentity(node);
    if (identity.kind === "other") {
      return [];
    }
    return [
      {
        id: node.id,
        // Unlike the AI stage inputs, which send it as it is, an empty label shows the id.
        label: identity.label === "" ? node.id : identity.label,
        kind: kindLabel(identity),
        decision: designDecisionSchema.safeParse(node.data["decision"]).data,
      },
    ];
  });
}

function ComponentCard({ component }: { component: Component }) {
  const setSelectedNode = useDiagramStore((state) => state.setSelectedNode);
  const { id, label, kind, decision } = component;
  const documented = hasDesignDecision(decision) ? getDocumentedDecision(decision) : undefined;
  return (
    // The container lets the gains and costs sit side by side when the panel is wide enough.
    <article
      aria-label={label}
      className="@container flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-3 text-card-foreground"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {label} · {kind}
        </span>
        <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setSelectedNode(id)}>
          Show on canvas<span className="sr-only">: {label}</span>
        </Button>
      </div>
      {documented ? (
        <>
          {documented.choice && (
            <p className={cn(textClassName, "text-sm font-semibold")}>
              <span className="sr-only">Chose </span>
              {documented.choice}
            </p>
          )}
          {documented.reason && (
            <p className={cn(textClassName, "text-xs leading-relaxed text-muted-foreground")}>
              {documented.reason}
            </p>
          )}
          <TradeoffList gains={documented.benefits} costs={documented.drawbacks} />
        </>
      ) : (
        <p className="text-xs text-muted-foreground">No decision documented yet.</p>
      )}
    </article>
  );
}

/** The Design tab: the summary, then every component and group with its choice and tradeoffs. */
export function DesignTab() {
  const summary = useDiagramStore((state) => state.brief?.summary);
  const nodes = useDiagramStore((state) => state.nodes);
  const components = useMemo(() => componentsOf(nodes), [nodes]);

  if (!summary && components.length === 0) {
    return (
      <p className="mt-8 text-center text-xs leading-relaxed text-muted-foreground">
        Components, their choices and tradeoffs appear here after an update.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {summary && (
        <section aria-label="Summary" className="rounded-lg border border-border bg-muted/50 p-3">
          <h3 className={sectionLabelClass}>Summary</h3>
          <p className={cn(textClassName, "mt-1.5 text-sm leading-relaxed")}>{summary}</p>
        </section>
      )}
      {components.map((component) => (
        <ComponentCard key={component.id} component={component} />
      ))}
    </div>
  );
}
