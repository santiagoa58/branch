import { describe, expect, it, vi } from "vite-plus/test";
import { COMMENT_CONFIG, GROUP_TYPES_CONFIG, NODE_TYPES_CONFIG } from "@/constants";
import {
  getEditorShortcut,
  GROUP_SHORTCUTS,
  QUICK_ADD_SHORTCUTS,
  type EditorShortcut,
  type QuickAddNodeType,
} from "./editorShortcuts";

const NODE_CASES: readonly (readonly [string, QuickAddNodeType])[] = [
  ["s", "service"],
  ["d", "database"],
  ["q", "queue"],
  ["c", "cache"],
  ["g", "gateway"],
  ["e", "external"],
  ["t", "storage"],
  ["l", "client"],
  ["n", "comment"],
  ["f", "lambda"],
  ["b", "loadbalancer"],
  ["y", "cdn"],
  ["a", "auth"],
  ["p", "container"],
  ["z", "dns"],
  ["m", "llm"],
  ["x", "vectordb"],
  ["w", "mlpipeline"],
  ["i", "embedding"],
  ["k", "secrets"],
  ["u", "eventbus"],
  ["j", "datalake"],
  ["r", "search"],
  ["o", "notification"],
];

const GROUP_CASES: readonly (readonly [string, QuickAddNodeType])[] = [
  ["v", "group-vpc"],
  ["k", "group-cluster"],
  ["r", "group-region"],
  ["n", "group-subnet"],
];

const PRIMARY_CASES: readonly (readonly [string, EditorShortcut["type"]])[] = [
  ["c", "copy-selection"],
  ["v", "paste"],
  ["d", "duplicate-selection"],
  ["l", "auto-format"],
  ["k", "spotlight"],
  ["a", "select-all"],
  ["z", "undo"],
  ["y", "redo"],
];

const PLAIN_CASES: readonly (readonly [string, EditorShortcut["type"]])[] = [
  ["v", "select-mode"],
  ["h", "pan-mode"],
  ["`", "toggle-laser"],
  ["[", "toggle-left-panel"],
  ["]", "toggle-right-panel"],
  ["?", "show-shortcuts"],
  ["Delete", "delete-selection"],
  ["Backspace", "delete-selection"],
  ["Escape", "escape"],
];

function keyEvent(key: string, modifiers: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key, cancelable: true, ...modifiers });
}

const ALL_BINDINGS: KeyboardEventInit[] = [
  ...NODE_CASES.map(([key]) => ({ key })),
  ...PLAIN_CASES.map(([key]) => ({ key })),
  ...GROUP_CASES.map(([key]) => ({ key: key.toUpperCase(), shiftKey: true })),
  { key: "S", shiftKey: true },
  { key: "?", shiftKey: true },
  ...PRIMARY_CASES.flatMap(([key]) => [
    { key, ctrlKey: true },
    { key, metaKey: true },
  ]),
  { key: "Z", ctrlKey: true, shiftKey: true },
  { key: "Z", metaKey: true, shiftKey: true },
];

const ALPHABET = "abcdefghijklmnopqrstuvwxyz".split("");

describe("shortcut definitions", () => {
  it("exports every quick-add mapping exactly once", () => {
    expect(QUICK_ADD_SHORTCUTS.map(({ key, nodeType }) => [key, nodeType])).toEqual(NODE_CASES);
    expect(new Set(QUICK_ADD_SHORTCUTS.map(({ key }) => key)).size).toBe(NODE_CASES.length);
  });

  it("exports every shifted group mapping exactly once", () => {
    expect(GROUP_SHORTCUTS.map(({ key, nodeType }) => [key, nodeType])).toEqual(
      GROUP_CASES.map(([key, nodeType]) => [`Shift+${key.toUpperCase()}`, nodeType]),
    );
    expect(new Set(GROUP_SHORTCUTS.map(({ key }) => key)).size).toBe(GROUP_CASES.length);
  });

  it("uses catalog labels and provides help sections", () => {
    for (const shortcut of QUICK_ADD_SHORTCUTS) {
      const label =
        shortcut.nodeType === "comment"
          ? COMMENT_CONFIG.label
          : Object.entries(NODE_TYPES_CONFIG).find(([type]) => type === shortcut.nodeType)?.[1]
              .label;
      expect(shortcut.label).toBe(label);
      expect(shortcut.section.length).toBeGreaterThan(0);
    }
    for (const shortcut of GROUP_SHORTCUTS) {
      const label = Object.entries(GROUP_TYPES_CONFIG).find(
        ([type]) => `group-${type}` === shortcut.nodeType,
      )?.[1].label;
      expect(shortcut.label).toBe(label);
      expect(shortcut.section).toBe("Quick Add Groups");
    }
  });
});

describe("getEditorShortcut", () => {
  it.each(NODE_CASES)("matches %s quick-add with and without CapsLock casing", (key, nodeType) => {
    for (const value of [key, key.toUpperCase()]) {
      expect(getEditorShortcut(keyEvent(value))).toEqual({ type: "add-node", nodeType });
    }
  });

  it.each(GROUP_CASES)("matches Shift+%s as a group regardless of key casing", (key, nodeType) => {
    for (const value of [key, key.toUpperCase()]) {
      expect(getEditorShortcut(keyEvent(value, { shiftKey: true }))).toEqual({
        type: "add-node",
        nodeType,
      });
    }
  });

  it.each(PLAIN_CASES)("matches the plain %s command", (key, type) => {
    expect(getEditorShortcut(keyEvent(key))).toEqual({ type });
    expect(getEditorShortcut(keyEvent(key.toUpperCase()))).toEqual({ type });
  });

  it.each(["s", "S"])("matches Shift+%s as simulation rather than a service", (key) => {
    expect(getEditorShortcut(keyEvent(key, { shiftKey: true }))).toEqual({
      type: "toggle-simulation",
    });
  });

  it.each([false, true])("accepts '?' with shiftKey=%s", (shiftKey) => {
    expect(getEditorShortcut(keyEvent("?", { shiftKey }))).toEqual({ type: "show-shortcuts" });
  });

  it.each(ALPHABET.filter((key) => !["v", "k", "r", "n", "s"].includes(key)))(
    "does not treat Shift+%s as a plain quick-add or mode command",
    (key) => {
      for (const value of [key, key.toUpperCase()]) {
        expect(getEditorShortcut(keyEvent(value, { shiftKey: true }))).toBeNull();
      }
    },
  );

  it.each(["h", "`", "[", "]", "Delete", "Backspace", "Escape", "/", "~", "{", "}"])(
    "rejects shifted plain-only or unsupported punctuation key %s",
    (key) => {
      expect(getEditorShortcut(keyEvent(key, { shiftKey: true }))).toBeNull();
    },
  );

  describe.each(["ctrlKey", "metaKey"] as const)("%s shortcuts", (modifier) => {
    it.each(PRIMARY_CASES)("matches %s without falling through to quick-add/mode", (key, type) => {
      for (const value of [key, key.toUpperCase()]) {
        expect(getEditorShortcut(keyEvent(value, { [modifier]: true }))).toEqual({ type });
      }
    });

    it.each(["z", "Z"])("matches shifted %s as redo", (key) => {
      expect(getEditorShortcut(keyEvent(key, { [modifier]: true, shiftKey: true }))).toEqual({
        type: "redo",
      });
    });

    it.each(ALPHABET.filter((key) => key !== "z"))(
      "rejects extra Shift on primary+%s without any fallback",
      (key) => {
        expect(
          getEditorShortcut(keyEvent(key.toUpperCase(), { [modifier]: true, shiftKey: true })),
        ).toBeNull();
      },
    );

    it.each([
      ...ALPHABET.filter((key) => !PRIMARY_CASES.some(([primaryKey]) => primaryKey === key)),
      "`",
      "[",
      "]",
      "?",
      "Escape",
      "Delete",
      "Backspace",
    ])("rejects unsupported primary+%s rather than dispatching a plain command", (key) => {
      expect(getEditorShortcut(keyEvent(key, { [modifier]: true }))).toBeNull();
    });
  });

  it.each(ALL_BINDINGS)("ignores Alt on binding %j", (binding) => {
    expect(
      getEditorShortcut(new KeyboardEvent("keydown", { ...binding, altKey: true })),
    ).toBeNull();
  });

  it.each(ALL_BINDINGS)("ignores AltGraph on binding %j even without altKey", (binding) => {
    const event = new KeyboardEvent("keydown", binding);
    vi.spyOn(event, "getModifierState").mockImplementation((modifier) => modifier === "AltGraph");
    expect(getEditorShortcut(event)).toBeNull();
  });

  it.each(ALL_BINDINGS)("rejects simultaneous Ctrl+Meta on binding %j", (binding) => {
    expect(
      getEditorShortcut(new KeyboardEvent("keydown", { ...binding, ctrlKey: true, metaKey: true })),
    ).toBeNull();
  });

  describe.each(["defaultPrevented", "isComposing", "repeat"] as const)("%s events", (flag) => {
    it.each(ALL_BINDINGS)("ignores binding %j", (binding) => {
      const event = new KeyboardEvent("keydown", {
        ...binding,
        cancelable: true,
        isComposing: flag === "isComposing",
        repeat: flag === "repeat",
      });
      if (flag === "defaultPrevented") {
        event.preventDefault();
      }
      expect(getEditorShortcut(event)).toBeNull();
    });
  });

  it.each([
    "Dead",
    "Process",
    "Unidentified",
    "",
    "Enter",
    "Tab",
    " ",
    "/",
    "constructor",
    "toString",
  ])("ignores non-shortcut key %j regardless of modifiers", (key) => {
    for (const modifiers of [{}, { shiftKey: true }, { ctrlKey: true }, { metaKey: true }]) {
      expect(getEditorShortcut(keyEvent(key, modifiers))).toBeNull();
    }
  });

  it.each(ALL_BINDINGS)(
    "does not prevent defaults or stop propagation for binding %j",
    (binding) => {
      const event = new KeyboardEvent("keydown", { ...binding, cancelable: true });
      const preventDefault = vi.spyOn(event, "preventDefault");
      const stopPropagation = vi.spyOn(event, "stopPropagation");
      const stopImmediatePropagation = vi.spyOn(event, "stopImmediatePropagation");

      expect(getEditorShortcut(event)).not.toBeNull();
      expect(preventDefault).not.toHaveBeenCalled();
      expect(stopPropagation).not.toHaveBeenCalled();
      expect(stopImmediatePropagation).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    },
  );
});
