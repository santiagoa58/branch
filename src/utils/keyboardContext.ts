const EDITING_TARGET = 'input, textarea, select, [role="textbox"], [role="combobox"], .cm-editor';
const BLOCKING_OVERLAY =
  'dialog[open], [role="dialog"], [aria-modal="true"], [data-editor-shortcuts="blocked"]';

/** Inspect ancestors and composed paths so nested editable content and shadow DOM stay native. */
export function isTextEditingEvent(event: KeyboardEvent): boolean {
  const target =
    event.composedPath().find((entry) => entry instanceof Element) ?? document.activeElement;
  if (!(target instanceof Element)) {
    return false;
  }
  if (target.closest(EDITING_TARGET)) {
    return true;
  }
  const editable = target.closest("[contenteditable]");
  return editable !== null && editable.getAttribute("contenteditable") !== "false";
}

/** A modal may be open before it moves focus away from the canvas. */
export function hasBlockingEditorOverlay(): boolean {
  return document.querySelector(BLOCKING_OVERLAY) !== null;
}
