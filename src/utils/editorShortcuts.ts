import { COMMENT_CONFIG, GROUP_TYPES_CONFIG, NODE_TYPES_CONFIG } from "@/constants";
import type { ArchitectureNodeType, GroupNodeType } from "@/types";

export type QuickAddNodeType = ArchitectureNodeType | "comment" | `group-${GroupNodeType}`;

export type EditorShortcut =
  | { type: "add-node"; nodeType: QuickAddNodeType }
  | {
      type:
        | "select-mode"
        | "pan-mode"
        | "toggle-laser"
        | "show-shortcuts"
        | "spotlight"
        | "toggle-simulation"
        | "toggle-left-panel"
        | "toggle-right-panel"
        | "delete-selection"
        | "duplicate-selection"
        | "copy-selection"
        | "paste"
        | "undo"
        | "redo"
        | "auto-format"
        | "select-all"
        | "escape";
    };

type QuickAddShortcut = Readonly<{
  key: string;
  nodeType: QuickAddNodeType;
  label: string;
  section: string;
}>;

function nodeShortcut(
  key: string,
  nodeType: ArchitectureNodeType,
  section: string,
): QuickAddShortcut {
  return { key, nodeType, label: NODE_TYPES_CONFIG[nodeType].label, section };
}

export const QUICK_ADD_SHORTCUTS: readonly QuickAddShortcut[] = [
  nodeShortcut("s", "service", "Quick Add Nodes"),
  nodeShortcut("d", "database", "Quick Add Nodes"),
  nodeShortcut("q", "queue", "Quick Add Nodes"),
  nodeShortcut("c", "cache", "Quick Add Nodes"),
  nodeShortcut("g", "gateway", "Quick Add Nodes"),
  nodeShortcut("e", "external", "Quick Add Nodes"),
  nodeShortcut("t", "storage", "Quick Add Nodes"),
  nodeShortcut("l", "client", "Quick Add Nodes"),
  { key: "n", nodeType: "comment", label: COMMENT_CONFIG.label, section: "Quick Add Nodes" },
  nodeShortcut("f", "lambda", "Cloud Infrastructure"),
  nodeShortcut("b", "loadbalancer", "Cloud Infrastructure"),
  nodeShortcut("y", "cdn", "Cloud Infrastructure"),
  nodeShortcut("a", "auth", "Cloud Infrastructure"),
  nodeShortcut("p", "container", "Cloud Infrastructure"),
  nodeShortcut("z", "dns", "Cloud Infrastructure"),
  nodeShortcut("m", "llm", "AI/ML"),
  nodeShortcut("x", "vectordb", "AI/ML"),
  nodeShortcut("w", "mlpipeline", "AI/ML"),
  nodeShortcut("i", "embedding", "AI/ML"),
  nodeShortcut("k", "secrets", "Cloud Services"),
  nodeShortcut("u", "eventbus", "Cloud Services"),
  nodeShortcut("j", "datalake", "Cloud Services"),
  nodeShortcut("r", "search", "Cloud Services"),
  nodeShortcut("o", "notification", "Cloud Services"),
];

export const GROUP_SHORTCUTS: readonly QuickAddShortcut[] = [
  {
    key: "Shift+V",
    nodeType: "group-vpc",
    label: GROUP_TYPES_CONFIG.vpc.label,
    section: "Quick Add Groups",
  },
  {
    key: "Shift+K",
    nodeType: "group-cluster",
    label: GROUP_TYPES_CONFIG.cluster.label,
    section: "Quick Add Groups",
  },
  {
    key: "Shift+R",
    nodeType: "group-region",
    label: GROUP_TYPES_CONFIG.region.label,
    section: "Quick Add Groups",
  },
  {
    key: "Shift+N",
    nodeType: "group-subnet",
    label: GROUP_TYPES_CONFIG.subnet.label,
    section: "Quick Add Groups",
  },
];

type CommandType = Exclude<EditorShortcut["type"], "add-node">;

const PRIMARY_SHORTCUTS = new Map<string, CommandType>([
  ["c", "copy-selection"],
  ["v", "paste"],
  ["d", "duplicate-selection"],
  ["l", "auto-format"],
  ["k", "spotlight"],
  ["a", "select-all"],
  ["z", "undo"],
  ["y", "redo"],
]);

const PLAIN_SHORTCUTS = new Map<string, CommandType>([
  ["v", "select-mode"],
  ["h", "pan-mode"],
  ["`", "toggle-laser"],
  ["[", "toggle-left-panel"],
  ["]", "toggle-right-panel"],
  ["delete", "delete-selection"],
  ["backspace", "delete-selection"],
  ["escape", "escape"],
]);

export function getEditorShortcut(event: KeyboardEvent): EditorShortcut | null {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.repeat ||
    event.altKey ||
    event.getModifierState("AltGraph")
  ) {
    return null;
  }

  const key = event.key.toLowerCase();
  if (key === "dead" || key === "process") {
    return null;
  }

  if (event.ctrlKey || event.metaKey) {
    if (event.ctrlKey && event.metaKey) {
      return null;
    }
    if (event.shiftKey) {
      return key === "z" ? { type: "redo" } : null;
    }
    const type = PRIMARY_SHORTCUTS.get(key);
    return type ? { type } : null;
  }

  // A real '?' normally carries Shift, while synthetic events may omit it.
  if (key === "?") {
    return { type: "show-shortcuts" };
  }

  if (event.shiftKey) {
    if (key === "s") {
      return { type: "toggle-simulation" };
    }
    const group = GROUP_SHORTCUTS.find((shortcut) => shortcut.key === `Shift+${key.toUpperCase()}`);
    return group ? { type: "add-node", nodeType: group.nodeType } : null;
  }

  const type = PLAIN_SHORTCUTS.get(key);
  if (type) {
    return { type };
  }
  const node = QUICK_ADD_SHORTCUTS.find((shortcut) => shortcut.key === key);
  return node ? { type: "add-node", nodeType: node.nodeType } : null;
}
