import { createStore, type StoreApi } from "zustand";

/**
 * Display-only facts each mounted edge reports about itself (where it runs, where its label
 * wants to sit), so geometry that depends on every edge at once is computed in one pass.
 * Ephemeral: never persisted, never in history.
 *
 * Edges report from layout effects. Reports are batched and applied together in a microtask,
 * before the browser paints, so mounting or dragging many edges triggers one update, not one
 * per edge.
 */
export interface CanvasRegistry<T> {
  store: StoreApi<{ entries: ReadonlyMap<string, T> }>;
  report: (id: string, value: T) => void;
  remove: (id: string) => void;
}

export function createCanvasRegistry<T>(): CanvasRegistry<T> {
  const store = createStore<{ entries: ReadonlyMap<string, T> }>(() => ({ entries: new Map() }));
  let pending: Map<string, T | undefined> | null = null;

  const flush = () => {
    const changes = pending;
    pending = null;
    if (!changes) {
      return;
    }
    const entries = new Map(store.getState().entries);
    for (const [id, value] of changes) {
      if (value === undefined) {
        entries.delete(id);
      } else {
        entries.set(id, value);
      }
    }
    store.setState({ entries });
  };

  const queue = (id: string, value: T | undefined) => {
    if (!pending) {
      pending = new Map();
      queueMicrotask(flush);
    }
    pending.set(id, value);
  };

  return {
    store,
    report: (id, value) => queue(id, value),
    remove: (id) => queue(id, undefined),
  };
}
