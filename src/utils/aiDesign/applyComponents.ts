import type { Edge, Node } from "@xyflow/react";
import { archEdge, archNode, groupNode } from "@/templates/builders";
import type { ComponentsOutput, DesignBrief } from "@/schemas/aiDesign";
import type { NamedFlow } from "@/types/simulation";
import { autoLayoutDiagram } from "@/utils/layout";
import { inputsFingerprint } from "./fingerprint";

export const AI_FLOW_ID = "flow-ai-main";
const AI_FLOW_COLOR = "#3b82f6";

type Group = ComponentsOutput["groups"][number];
type Component = ComponentsOutput["components"][number];

export type ApplyComponentsResult =
  | {
      ok: true;
      nodes: Node[];
      edges: Edge[];
      flows: NamedFlow[];
      brief: DesignBrief;
      warnings: string[];
    }
  | { ok: false; warnings: string[] };

/** Keeps the first use of each key; drops repeats and keys that collide with comment ids. */
function uniqueKeyed<T extends { key: string }>(
  items: T[],
  taken: Set<string>,
  commentIds: Set<string>,
  kind: string,
  warnings: string[],
): T[] {
  return items.filter((item) => {
    if (commentIds.has(item.key)) {
      warnings.push(`Dropped ${kind} "${item.key}": a comment on the canvas already uses that id.`);
      return false;
    }
    if (taken.has(item.key)) {
      warnings.push(`Dropped ${kind} "${item.key}": the key is used more than once.`);
      return false;
    }
    taken.add(item.key);
    return true;
  });
}

/** Resolves group parents, detaching unknown parents and breaking cycles. */
function resolveGroupParents(groups: Group[], warnings: string[]): Map<string, string | undefined> {
  const keys = new Set(groups.map((group) => group.key));
  const parents = new Map<string, string | undefined>();
  for (const group of groups) {
    if (group.parent !== undefined && !keys.has(group.parent)) {
      warnings.push(
        `Detached group "${group.key}" from parent "${group.parent}": "${group.parent}" is not a group.`,
      );
      parents.set(group.key, undefined);
    } else {
      parents.set(group.key, group.parent);
    }
  }
  for (const group of groups) {
    const seen = new Set<string>();
    for (let up = parents.get(group.key); up !== undefined && !seen.has(up); up = parents.get(up)) {
      if (up === group.key) {
        warnings.push(
          `Detached group "${group.key}" from parent "${parents.get(group.key)}": the groups form a cycle.`,
        );
        parents.set(group.key, undefined);
        break;
      }
      seen.add(up);
    }
  }
  return parents;
}

/** Parents come before children, as React Flow requires. */
function parentsFirst(groups: Group[], parents: Map<string, string | undefined>): Group[] {
  const byKey = new Map(groups.map((group) => [group.key, group]));
  const ordered: Group[] = [];
  const emitted = new Set<string>();
  const emit = (group: Group) => {
    if (emitted.has(group.key)) {
      return;
    }
    emitted.add(group.key);
    const parent = parents.get(group.key);
    if (parent !== undefined) {
      emit(byKey.get(parent)!);
    }
    ordered.push(group);
  };
  groups.forEach(emit);
  return ordered;
}

/**
 * Stage 2: replace the generated graph. Cleans the model output into something valid (each
 * repair is reported as a warning), keeps comment nodes and still-valid saved flows, and lays
 * the result out. Returns `ok: false` when no component survives.
 */
export function applyComponents(
  current: { nodes: Node[]; edges: Edge[]; flows: NamedFlow[]; brief: DesignBrief },
  output: ComponentsOutput,
  now: string,
): ApplyComponentsResult {
  const warnings: string[] = [];
  const comments = current.nodes.filter((node) => node.type === "comment");
  const commentIds = new Set(comments.map((node) => node.id));
  const taken = new Set<string>();

  const groups = uniqueKeyed(output.groups, taken, commentIds, "group", warnings);
  const components = uniqueKeyed(output.components, taken, commentIds, "component", warnings);
  if (components.length === 0) {
    return { ok: false, warnings: [...warnings, "The design has no components."] };
  }

  const parents = resolveGroupParents(groups, warnings);
  const groupKeys = new Set(groups.map((group) => group.key));
  const componentKeys = new Set(components.map((component) => component.key));

  const groupNodes = parentsFirst(groups, parents).map((group) => {
    const parent = parents.get(group.key);
    return groupNode(
      group.key,
      group.type,
      group.label,
      0,
      0,
      400,
      300,
      parent ? { parentId: parent } : {},
    );
  });

  const componentNodes = components.map((component: Component) => {
    let group = component.group;
    if (group !== undefined && !groupKeys.has(group)) {
      warnings.push(
        `Moved component "${component.key}" to the top level: "${group}" is not a group.`,
      );
      group = undefined;
    }
    return archNode(component.key, component.type, component.label, 0, 0, {
      attributes: [],
      description: component.responsibility,
      ...(group ? { parentId: group } : {}),
    });
  });

  const edges: Edge[] = [];
  output.connections.forEach((connection, index) => {
    const { from, to } = connection;
    const missing = [from, to].find((key) => !componentKeys.has(key));
    if (missing !== undefined) {
      warnings.push(`Dropped connection "${from}" → "${to}": "${missing}" is not a component.`);
    } else if (from === to) {
      warnings.push(
        `Dropped connection "${from}" → "${to}": a component cannot connect to itself.`,
      );
    } else {
      edges.push(
        archEdge(`ai-${from}-${to}-${index}`, from, to, {
          protocol: connection.protocol,
          label: connection.purpose,
          async: connection.async,
        }),
      );
    }
  });

  const nodes = [...autoLayoutDiagram([...groupNodes, ...componentNodes], edges), ...comments];

  const entry = output.mainFlow.entry;
  const aiFlow: NamedFlow | undefined = componentKeys.has(entry)
    ? {
        id: AI_FLOW_ID,
        name: output.mainFlow.name,
        description: output.mainFlow.description,
        sourceNodeId: entry,
        color: AI_FLOW_COLOR,
        speed: 1,
        createdAt: now,
      }
    : undefined;
  if (!aiFlow) {
    warnings.push(`Dropped main flow "${output.mainFlow.name}": "${entry}" is not a component.`);
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edgeIds = new Set(edges.map((edge) => edge.id));
  const flows: NamedFlow[] = [];
  for (const flow of current.flows) {
    if (flow.id === AI_FLOW_ID) {
      if (aiFlow) {
        flows.push(aiFlow);
      }
    } else if (
      nodeIds.has(flow.sourceNodeId) &&
      (flow.edgeIds ?? []).every((id) => edgeIds.has(id))
    ) {
      flows.push(flow);
    }
  }
  if (aiFlow && !flows.includes(aiFlow)) {
    flows.push(aiFlow);
  }

  return {
    ok: true,
    nodes,
    edges,
    flows,
    brief: {
      ...current.brief,
      summary: output.summary,
      ranFrom: { ...current.brief.ranFrom, components: inputsFingerprint(current.brief.inputs) },
    },
    warnings,
  };
}
