import { afterEach, describe, expect, it } from "vite-plus/test";
import { hasBlockingEditorOverlay, isTextEditingEvent } from "./keyboardContext";

afterEach(() => {
  document.body.replaceChildren();
});

function fixture(markup: string): HTMLElement {
  document.body.innerHTML = markup;
  const target = document.querySelector<HTMLElement>("[data-target]");
  if (!target) {
    throw new Error("Expected a keyboard target in the fixture");
  }
  return target;
}

// composedPath() is available during dispatch, not after dispatch has finished.
function editingAt(target: EventTarget): boolean | undefined {
  let result: boolean | undefined;
  window.addEventListener(
    "keydown",
    (event) => {
      result = isTextEditingEvent(event);
    },
    { once: true },
  );
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "s", bubbles: true, composed: true }));
  return result;
}

describe("isTextEditingEvent", () => {
  it.each([
    ["input", "<input data-target />"],
    ["textarea", "<textarea data-target></textarea>"],
    ["select", "<select data-target><option>Service</option></select>"],
    ["option inside select", "<select><option data-target>Service</option></select>"],
    ["textbox descendant", '<div role="textbox"><span data-target>Text</span></div>'],
    ["combobox descendant", '<div role="combobox"><span data-target>Choice</span></div>'],
    [
      "CodeMirror descendant",
      '<div class="cm-editor"><div><span data-target>Code</span></div></div>',
    ],
    [
      "editable ancestor",
      '<div contenteditable="true"><div><span data-target>Text</span></div></div>',
    ],
    ["empty editable attribute", "<div contenteditable><span data-target>Text</span></div>"],
    [
      "plaintext-only ancestor",
      '<div contenteditable="plaintext-only"><span data-target>Text</span></div>',
    ],
  ])("keeps %s keyboard events native", (_name, markup) => {
    expect(editingAt(fixture(markup))).toBe(true);
  });

  it.each([
    ["canvas", '<div tabindex="0" data-target></div>'],
    ["button", '<button type="button" data-target>Action</button>'],
    ["noneditable content", '<div contenteditable="false"><span data-target>Text</span></div>'],
    [
      "false island within editable content",
      '<div contenteditable="true"><div contenteditable="false"><span data-target>Text</span></div></div>',
    ],
    ["unrelated CodeMirror-like class", '<div class="cm-editor-preview" data-target></div>'],
  ])("does not classify %s as text editing", (_name, markup) => {
    expect(editingAt(fixture(markup))).toBe(false);
  });

  it("uses the nearest editable ancestor when editing is reenabled inside a false island", () => {
    const target = fixture(
      '<div contenteditable="true"><div contenteditable="false"><div contenteditable="true"><span data-target>Text</span></div></div></div>',
    );
    expect(editingAt(target)).toBe(true);
  });

  it("still recognizes a native control within a contenteditable=false island", () => {
    expect(editingAt(fixture('<div contenteditable="false"><input data-target /></div>'))).toBe(
      true,
    );
  });

  it("inspects ancestors when a text node dispatches the event", () => {
    const target = fixture(
      '<div contenteditable="true"><span data-target>Editable text</span></div>',
    );
    const text = target.firstChild;
    if (!text) {
      throw new Error("Expected a text node");
    }
    expect(editingAt(text)).toBe(true);
  });

  it("sees the original editable target through a shadow DOM composed path", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const shadow = host.attachShadow({ mode: "open" });
    const input = document.createElement("input");
    shadow.append(input);
    let retargeted: EventTarget | null = null;
    window.addEventListener(
      "keydown",
      (event) => {
        retargeted = event.target;
      },
      { once: true },
    );

    expect(editingAt(input)).toBe(true);
    expect(retargeted).toBe(host);
  });

  it.each([
    ["input", "<input data-target />", true],
    ["combobox", '<div role="combobox" tabindex="0" data-target></div>', true],
    [
      "editable ancestor",
      '<div contenteditable="true"><span tabindex="0" data-target>Text</span></div>',
      true,
    ],
    ["canvas", '<div tabindex="0" data-target></div>', false],
  ] as const)(
    "falls back to the focused %s when the event has no element path",
    (_name, markup, expected) => {
      const target = fixture(markup);
      target.focus();
      expect(document.activeElement).toBe(target);
      expect(isTextEditingEvent(new KeyboardEvent("keydown", { key: "s" }))).toBe(expected);
      expect(editingAt(window)).toBe(expected);
    },
  );

  it("returns false with neither an element path nor an active element", () => {
    document.body.remove();
    try {
      expect(document.activeElement).toBeNull();
      expect(isTextEditingEvent(new KeyboardEvent("keydown"))).toBe(false);
    } finally {
      document.documentElement.append(document.createElement("body"));
    }
  });
});

describe("hasBlockingEditorOverlay", () => {
  it.each([
    ["open native dialog", "<dialog open></dialog>"],
    ["ARIA dialog", '<div role="dialog"></div>'],
    ["ARIA modal", '<section aria-modal="true"></section>'],
    ["explicit shortcut blocker", '<div data-editor-shortcuts="blocked"></div>'],
    [
      "nested blocker",
      '<main><section><div data-editor-shortcuts="blocked"></div></section></main>',
    ],
  ])("blocks behind an %s even while the canvas retains focus", (_name, markup) => {
    const canvas = fixture('<div tabindex="0" data-target></div>');
    canvas.focus();
    document.body.insertAdjacentHTML("beforeend", markup);

    expect(document.activeElement).toBe(canvas);
    expect(hasBlockingEditorOverlay()).toBe(true);
  });

  it.each([
    ["empty document", ""],
    ["closed native dialog", "<dialog></dialog>"],
    ["nonmodal ARIA marker", '<div aria-modal="false"></div>'],
    ["unblocked shortcut marker", '<div data-editor-shortcuts="allowed"></div>'],
    ["ordinary panel", '<aside role="region"></aside>'],
  ])("does not block for %s", (_name, markup) => {
    document.body.innerHTML = markup;
    expect(hasBlockingEditorOverlay()).toBe(false);
  });

  it("reads current overlay state rather than caching a previous result", () => {
    const dialog = document.createElement("dialog");
    document.body.append(dialog);
    expect(hasBlockingEditorOverlay()).toBe(false);
    dialog.setAttribute("open", "");
    expect(hasBlockingEditorOverlay()).toBe(true);
    dialog.removeAttribute("open");
    expect(hasBlockingEditorOverlay()).toBe(false);
    dialog.setAttribute("role", "dialog");
    expect(hasBlockingEditorOverlay()).toBe(true);
    dialog.remove();
    expect(hasBlockingEditorOverlay()).toBe(false);
  });
});
