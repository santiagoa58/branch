import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import * as Y from "yjs";
import { useCollaboration } from "./useCollaboration";

const transport = vi.hoisted(() => ({
  listeners: new Map<string, (payload: unknown) => void>(),
  emit: vi.fn<(event: string, payload: unknown) => void>(),
  disconnect: vi.fn<() => void>(),
}));

vi.mock("@/config/runtime", () => ({ ENABLE_COLLAB: true, WS_BASE_URL: "http://localhost:3000" }));
vi.mock("socket.io-client", () => ({
  io: () => ({
    on: (event: string, listener: (payload: unknown) => void) =>
      transport.listeners.set(event, listener),
    emit: transport.emit,
    disconnect: transport.disconnect,
  }),
}));

function receive(event: string, payload: unknown) {
  act(() => {
    transport.listeners.get(event)?.(payload);
  });
}

describe("collaboration boundaries", () => {
  beforeEach(() => {
    transport.listeners.clear();
    transport.emit.mockClear();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps valid users and cursors when malformed updates arrive", () => {
    const { result } = renderHook(() => useCollaboration({ diagramId: "d", userName: "Ada" }));
    receive("users-changed", { users: [{ name: "Ada", color: "blue" }] });
    receive("cursor-update", {
      socketId: "s",
      userName: "Ada",
      color: "blue",
      cursor: { x: 1, y: 2 },
    });
    receive("users-changed", { users: [{ name: 3, color: "red" }] });
    receive("cursor-update", {
      socketId: "s",
      userName: "Ada",
      color: "blue",
      cursor: { x: "bad", y: 2 },
    });
    expect(result.current.users).toEqual([{ name: "Ada", color: "blue" }]);
    expect(result.current.remoteCursors[0]?.cursor).toEqual({ x: 1, y: 2 });
    expect(result.current.myColor).toBe("blue");
  });

  it("rejects malformed diagram state before calling its consumer", () => {
    const received: unknown[] = [];
    renderHook(() =>
      useCollaboration({
        diagramId: "d",
        userName: "Ada",
        onRemoteDiagramState: (nodes, edges) => received.push({ nodes, edges }),
      }),
    );
    receive("diagram-state", { nodes: [], edges: [] });
    receive("diagram-state", { nodes: [{ id: "bad" }], edges: [] });
    expect(received).toEqual([{ nodes: [], edges: [] }]);
  });

  it.each([
    ["users-changed", null],
    ["cursor-update", null],
    ["diagram-state", null],
    ["yjs-sync", { type: "sync-step-1", data: [256, 1.5] }],
    ["yjs-sync", { type: "unexpected", data: [0, 0] }],
    ["yjs-update", { update: [255] }],
    ["yjs-update", { update: "bad" }],
  ])("ignores invalid %s payloads without throwing", (event, payload) => {
    renderHook(() => useCollaboration({ diagramId: "d", userName: "Ada" }));
    expect(() => receive(event, payload)).not.toThrow();
    expect(console.warn).toHaveBeenCalled();
  });

  it("accepts valid Yjs updates and cursor removal", () => {
    const { result } = renderHook(() => useCollaboration({ diagramId: "d", userName: "Ada" }));
    const doc = new Y.Doc();
    doc.getMap("diagram").set("name", "Shared");
    const update = Array.from(Y.encodeStateAsUpdate(doc));
    receive("yjs-sync", { type: "sync-step-1", data: update });
    receive("yjs-update", { update });
    receive("cursor-update", {
      socketId: "s",
      userName: "Ada",
      color: "blue",
      cursor: { x: 1, y: 2 },
    });
    receive("cursor-update", { socketId: "s", userName: "Ada", color: "blue", cursor: null });
    expect(result.current.remoteCursors).toEqual([]);
    expect(console.warn).not.toHaveBeenCalled();
    doc.destroy();
  });

  it("does not broadcast invalid local cursor coordinates", () => {
    const { result } = renderHook(() => useCollaboration({ diagramId: "d", userName: "Ada" }));
    act(() => result.current.sendCursorUpdate({ x: Number.NaN, y: 0 }));
    expect(transport.emit).not.toHaveBeenCalledWith("cursor-update", expect.anything());
    act(() => result.current.sendCursorUpdate({ x: 1, y: 2 }));
    expect(transport.emit).toHaveBeenCalledWith("cursor-update", {
      diagramId: "d",
      userName: "Ada",
      color: "#3b82f6",
      cursor: { x: 1, y: 2 },
    });
  });
});
