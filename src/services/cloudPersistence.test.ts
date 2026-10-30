import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { CloudPersistence } from "./cloudPersistence";
import { ApiError, type ApiDiagram, type ApiDiagramVersion } from "./api";
import { diagramDataSchema } from "@/schemas/diagram";
import type { DiagramData } from "@/types";

const empty: DiagramData = { nodes: [], edges: [], flows: [] };
const edited: DiagramData = {
  nodes: [
    {
      id: "s",
      type: "architecture",
      position: { x: 0, y: 0 },
      data: { label: "API", type: "service" },
    },
  ],
  edges: [],
  flows: [],
};
function diagram(id: string, revision = 1, data = empty): ApiDiagram {
  return {
    id,
    projectId: "p",
    name: id,
    description: null,
    thumbnail: null,
    version: 0,
    revision,
    data: diagramDataSchema.parse(data),
    createdAt: "today",
    updatedAt: "today",
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const api = {
  get: vi.fn<(id: string) => Promise<ApiDiagram>>(),
  update:
    vi.fn<
      (id: string, input: { data: DiagramData; expectedRevision: number }) => Promise<ApiDiagram>
    >(),
  createVersion:
    vi.fn<(id: string, expectedRevision: number, label?: string) => Promise<ApiDiagramVersion>>(),
  restoreVersion:
    vi.fn<(id: string, versionId: string, expectedRevision: number) => Promise<ApiDiagram>>(),
};
let cloud: CloudPersistence;
let hydrate = vi.fn<(data: DiagramData) => void>();
beforeEach(() => {
  vi.resetAllMocks();
  hydrate = vi.fn<(data: DiagramData) => void>();
  api.createVersion.mockResolvedValue({
    id: "v",
    diagramId: "a",
    versionNumber: 1,
    label: null,
    thumbnail: null,
    createdAt: "today",
  });
  cloud = new CloudPersistence(api, hydrate, 10000);
  api.get.mockImplementation(async (id: string) => diagram(id));
  api.update.mockImplementation(
    async (id: string, input: { data: DiagramData; expectedRevision: number }) =>
      diagram(id, input.expectedRevision + 1, input.data),
  );
});

describe("cloud document lifecycle", () => {
  it("ignores stale loads and hydrates without saving", async () => {
    const old = deferred<ApiDiagram>();
    api.get.mockReturnValueOnce(old.promise);
    const pending = cloud.load("a");
    await cloud.load("b");
    old.resolve(diagram("a"));
    await pending;
    expect(hydrate).toHaveBeenCalledTimes(1);
    expect(cloud.getState().diagram?.id).toBe("b");
    expect(api.update).not.toHaveBeenCalled();
  });
  it("never falls back to browser documents when loading fails", async () => {
    api.get.mockRejectedValueOnce(new Error("Network failed"));
    await cloud.load("a");
    expect(cloud.getState().status).toBe("load-error");
    expect(hydrate).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });
  it("captures the right document and serializes edits made during a save", async () => {
    await cloud.load("a");
    const save = deferred<ApiDiagram>();
    api.update.mockReturnValueOnce(save.promise);
    cloud.schedule(edited);
    const flushing = cloud.flush();
    cloud.schedule(empty);
    expect(api.update).toHaveBeenCalledTimes(1);
    save.resolve(diagram("a", 2, edited));
    await flushing;
    expect(api.update).toHaveBeenLastCalledWith("a", { data: empty, expectedRevision: 2 });
    expect(cloud.getState().status).toBe("saved");
    expect(cloud.getState().dirty).toBe(false);
  });
  it("flushes pending edits before loading another document", async () => {
    await cloud.load("a");
    cloud.schedule(edited);
    await cloud.load("b");
    expect(api.update).toHaveBeenCalledWith("a", { data: edited, expectedRevision: 1 });
    expect(cloud.getState().diagram?.id).toBe("b");
  });
  it("cancels a load during an existing save without canceling that save", async () => {
    await cloud.load("a");
    const save = deferred<ApiDiagram>();
    api.update.mockReturnValueOnce(save.promise);
    cloud.schedule(edited);
    const flushing = cloud.flush();
    const loading = cloud.load("b");
    cloud.cancelLoad();

    save.resolve(diagram("a", 2, edited));
    await Promise.all([flushing, loading]);

    expect(api.get.mock.calls).toEqual([["a"]]);
    expect(cloud.getState()).toMatchObject({
      diagram: { id: "a", revision: 2, data: edited },
      status: "saved",
      dirty: false,
    });
    expect(hydrate).toHaveBeenCalledTimes(1);
  });
  it("preserves C's edits and autosave when a canceled B preflight finishes after reset", async () => {
    vi.useFakeTimers();
    try {
      await cloud.load("a");
      const save = deferred<ApiDiagram>();
      api.update.mockReturnValueOnce(save.promise);
      cloud.schedule(edited);
      const loading = cloud.load("b");
      cloud.cancelLoad();
      cloud.reset();
      await cloud.load("c");
      cloud.schedule(edited);
      const newerState = cloud.getState();

      save.resolve(diagram("a", 2, edited));
      await loading;

      expect(api.get.mock.calls).toEqual([["a"], ["c"]]);
      expect(cloud.getState()).toBe(newerState);
      expect(cloud.getState()).toMatchObject({ diagram: { id: "c" }, dirty: true });
      expect(hydrate).toHaveBeenCalledTimes(2);
      expect(hydrate).toHaveBeenLastCalledWith(empty);

      await vi.advanceTimersByTimeAsync(10000);
      expect(api.update).toHaveBeenCalledTimes(2);
      expect(api.update).toHaveBeenLastCalledWith("c", { data: edited, expectedRevision: 1 });
      expect(cloud.getState()).toMatchObject({
        diagram: { id: "c", revision: 2, data: edited },
        status: "saved",
        dirty: false,
      });
    } finally {
      cloud.reset();
      vi.useRealTimers();
    }
  });
  it("ignores a canceled preflight failure after a newer document is edited", async () => {
    await cloud.load("a");
    const save = deferred<ApiDiagram>();
    api.update.mockReturnValueOnce(save.promise);
    cloud.schedule(edited);
    const loading = cloud.load("b");
    cloud.cancelLoad();
    cloud.reset();
    await cloud.load("c");
    cloud.schedule(edited);
    const newerState = cloud.getState();

    save.reject(new Error("Old save failed"));
    await expect(loading).resolves.toBeUndefined();

    expect(api.get.mock.calls).toEqual([["a"], ["c"]]);
    expect(cloud.getState()).toBe(newerState);
    await cloud.flush();
    expect(api.update).toHaveBeenLastCalledWith("c", { data: edited, expectedRevision: 1 });
    expect(cloud.getState().dirty).toBe(false);
  });
  it("only loads the newest destination when loads share a save preflight", async () => {
    await cloud.load("a");
    const save = deferred<ApiDiagram>();
    api.update.mockReturnValueOnce(save.promise);
    cloud.schedule(edited);
    const olderLoad = cloud.load("b");
    const newerLoad = cloud.load("c");

    save.resolve(diagram("a", 2, edited));
    await Promise.all([olderLoad, newerLoad]);

    expect(api.update).toHaveBeenCalledTimes(1);
    expect(api.get.mock.calls).toEqual([["a"], ["c"]]);
    expect(cloud.getState().diagram?.id).toBe("c");
    expect(hydrate).toHaveBeenCalledTimes(2);
  });
  it("preserves edits on failed save, blocks navigation and allows retry", async () => {
    await cloud.load("a");
    cloud.schedule(edited);
    api.update.mockRejectedValueOnce(new Error("Offline"));
    await expect(cloud.load("b")).rejects.toThrow("Offline");
    expect(cloud.getState().diagram?.id).toBe("a");
    expect(cloud.getState().dirty).toBe(true);
    expect(cloud.getState().status).toBe("error");
    await cloud.flush();
    expect(api.update).toHaveBeenLastCalledWith("a", { data: edited, expectedRevision: 1 });
    expect(cloud.getState().dirty).toBe(false);
  });
  it("does not automatically overwrite a conflict even after further edits", async () => {
    await cloud.load("a");
    cloud.schedule(edited);
    api.update.mockRejectedValueOnce(new ApiError(409, "Changed elsewhere"));
    await expect(cloud.flush()).rejects.toThrow("Changed elsewhere");
    cloud.schedule(empty);
    await expect(cloud.flush()).rejects.toThrow("Changed elsewhere");
    expect(api.update).toHaveBeenCalledTimes(1);
    expect(cloud.getState().dirty).toBe(true);
    expect(cloud.getState().status).toBe("conflict");
  });
  it("holds a transition lock through flush and the asynchronous action, even across reset", async () => {
    await cloud.load("a");
    cloud.schedule(edited);
    const save = deferred<ApiDiagram>();
    const action = deferred<void>();
    api.update.mockReturnValueOnce(save.promise);
    const run = vi.fn<() => Promise<void>>(() => action.promise);
    const transition = cloud.runTransition(run);
    expect(cloud.getState().locked).toBe(true);
    expect(cloud.isBusy()).toBe(true);
    cloud.schedule(empty);
    await expect(cloud.load("b")).rejects.toThrow("cloud operation");
    await expect(cloud.createVersion()).rejects.toThrow("cloud operation");
    save.resolve(diagram("a", 2, edited));
    await Promise.resolve();
    await Promise.resolve();
    expect(run).toHaveBeenCalledOnce();
    expect(cloud.getState()).toMatchObject({ locked: true, dirty: false });
    cloud.reset();
    expect(cloud.getState().locked).toBe(true);
    action.resolve();
    await transition;
    expect(cloud.getState().locked).toBe(false);
    expect(api.update).toHaveBeenCalledTimes(1);
  });
  it("preserves an existing load when a transition fails", async () => {
    const loading = deferred<ApiDiagram>();
    const action = deferred<void>();
    api.get.mockReturnValueOnce(loading.promise);
    const load = cloud.load("a");
    const transition = cloud.runTransition(() => action.promise);

    loading.resolve(diagram("a"));
    await load;
    expect(cloud.getState()).toMatchObject({ diagram: { id: "a" }, locked: true });
    action.reject(new Error("Sign-out failed"));
    await expect(transition).rejects.toThrow("Sign-out failed");
    expect(cloud.getState()).toMatchObject({
      diagram: { id: "a" },
      status: "saved",
      locked: false,
    });
    expect(hydrate).toHaveBeenCalledTimes(1);
  });
  it("suspends autosave without losing edits until the original session resumes", async () => {
    vi.useFakeTimers();
    try {
      await cloud.load("a");
      cloud.schedule(edited);
      cloud.suspend();
      cloud.schedule(empty);
      await vi.advanceTimersByTimeAsync(10000);
      expect(api.update).not.toHaveBeenCalled();
      await expect(cloud.flush()).rejects.toThrow("original account");
      expect(cloud.getState()).toMatchObject({ dirty: true, locked: true });
      cloud.resume();
      await cloud.flush();
      expect(api.update).toHaveBeenCalledWith("a", { data: edited, expectedRevision: 1 });
      expect(cloud.getState()).toMatchObject({ dirty: false, locked: false });
    } finally {
      cloud.reset();
      vi.useRealTimers();
    }
  });
  it("does not send queued snapshots after suspension during an in-flight save", async () => {
    await cloud.load("a");
    const save = deferred<ApiDiagram>();
    api.update.mockReturnValueOnce(save.promise);
    cloud.schedule(empty);
    const saving = cloud.flush();
    cloud.schedule(edited);
    cloud.suspend();
    save.resolve(diagram("a", 2));
    await saving;
    expect(api.update).toHaveBeenCalledTimes(1);
    expect(cloud.getState()).toMatchObject({ dirty: true, locked: true });
    cloud.resume();
    await cloud.flush();
    expect(api.update).toHaveBeenLastCalledWith("a", { data: edited, expectedRevision: 2 });
  });
  it("creates snapshots only after saving the intended edits", async () => {
    await cloud.load("a");
    cloud.schedule(edited);
    await cloud.createVersion("initial");
    expect(api.createVersion).toHaveBeenCalledWith("a", 2, "initial");
  });
  it("locks editing during restore and hydrates without resaving", async () => {
    await cloud.load("a");
    const restore = deferred<ApiDiagram>();
    api.restoreVersion.mockReturnValue(restore.promise);
    const restoring = cloud.restoreVersion("v1");
    await Promise.resolve();
    expect(cloud.getState().status).toBe("restoring");
    restore.resolve(diagram("a", 2, edited));
    await restoring;
    expect(hydrate).toHaveBeenLastCalledWith(edited);
    expect(api.update).not.toHaveBeenCalled();
    expect(cloud.getState().diagram?.revision).toBe(2);
  });
  it("invalidates a restore response after the workspace resets", async () => {
    await cloud.load("a");
    const restore = deferred<ApiDiagram>();
    api.restoreVersion.mockReturnValue(restore.promise);
    const pending = cloud.restoreVersion("v1");
    await Promise.resolve();
    cloud.reset();
    restore.resolve(diagram("a", 2, edited));
    await pending;
    expect(cloud.getState().diagram).toBeNull();
    expect(hydrate).toHaveBeenCalledTimes(1);
  });
  it("locks the editor before flushing edits for a version operation", async () => {
    await cloud.load("a");
    cloud.schedule(edited);
    const save = deferred<ApiDiagram>();
    api.update.mockReturnValueOnce(save.promise);
    const pending = cloud.createVersion("v1");
    expect(cloud.getState().locked).toBe(true);
    save.resolve(diagram("a", 2, edited));
    await pending;
    expect(cloud.getState().locked).toBe(false);
  });
  it("does not apply a project-mismatched cloud document", async () => {
    await cloud.load("a", "different-project");
    expect(cloud.getState().status).toBe("load-error");
    expect(hydrate).not.toHaveBeenCalled();
  });
  it("validates edits before queuing cloud writes", async () => {
    await cloud.load("a");
    expect(() => cloud.schedule({ nodes: [{ id: "bad" }], edges: [] })).toThrow(/nodes/);
    expect(cloud.getState().dirty).toBe(false);
    expect(api.update).not.toHaveBeenCalled();
  });
  it("reset invalidates a pending load and cancels pending document saves", async () => {
    const load = deferred<ApiDiagram>();
    api.get.mockReturnValueOnce(load.promise);
    const pending = cloud.load("a");
    cloud.reset();
    load.resolve(diagram("a"));
    await pending;
    expect(hydrate).not.toHaveBeenCalled();
    expect(cloud.getState().diagram).toBeNull();
  });
});
