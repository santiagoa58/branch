import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { diagramsApi, projectsApi, type ApiDiagramSummary, type ApiWorkspaceProject } from "./api";
import { workspaceQuery } from "./workspaceQuery";
import { deleteDiagramFromWorkspace, deleteProjectFromWorkspace } from "./workspaceDeletion";

const item: ApiDiagramSummary = {
  id: "d1",
  projectId: "p1",
  name: "Deleted diagram",
  description: null,
  version: 0,
  revision: 1,
  thumbnail: null,
  createdAt: "today",
  updatedAt: "today",
};
const other = { ...item, id: "d2", name: "Remaining diagram" };
const project: ApiWorkspaceProject = {
  id: "p1",
  name: "Current project",
  description: null,
  color: null,
  createdAt: "today",
  updatedAt: "today",
  diagrams: [item, other],
};

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(workspaceQuery.root().queryKey, [project]);
  client.setQueryData(workspaceQuery.diagrams(project.id).queryKey, project.diagrams);
  client.setQueryData(["diagrams", item.id], { id: item.id });
  return client;
}
function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("confirmed workspace deletions", () => {
  it("keeps the diagram visible during the request and removes it from every cached view on success", async () => {
    const client = setup();
    const request = deferred();
    const api = vi.spyOn(diagramsApi, "delete").mockReturnValue(request.promise);
    const deleting = deleteDiagramFromWorkspace(client, "p1", "d1");

    expect(client.getQueryData<ApiWorkspaceProject[]>(workspaceQuery.root().queryKey)?.[0]?.diagrams).toHaveLength(2);
    expect(client.getQueryData<ApiDiagramSummary[]>(workspaceQuery.diagrams("p1").queryKey)).toHaveLength(2);

    request.resolve();
    await deleting;
    expect(api).toHaveBeenCalledExactlyOnceWith("d1");
    expect(client.getQueryData<ApiWorkspaceProject[]>(workspaceQuery.root().queryKey)?.[0]?.diagrams).toEqual([other]);
    expect(client.getQueryData(workspaceQuery.diagrams("p1").queryKey)).toEqual([other]);
    expect(client.getQueryData(["diagrams", "d1"])).toBeUndefined();
    client.clear();
  });

  it("retains cached items on API failure so the user can retry", async () => {
    const client = setup();
    vi.spyOn(diagramsApi, "delete").mockRejectedValue(new Error("Offline"));
    await expect(deleteDiagramFromWorkspace(client, "p1", "d1")).rejects.toThrow("Offline");
    expect(client.getQueryData<ApiWorkspaceProject[]>(workspaceQuery.root().queryKey)?.[0]?.diagrams).toEqual([item, other]);
    expect(client.getQueryData(workspaceQuery.diagrams("p1").queryKey)).toEqual([item, other]);
    client.clear();
  });

  it("removes a confirmed deleted project and its list cache without refetching", async () => {
    const client = setup();
    vi.spyOn(projectsApi, "delete").mockResolvedValue(undefined);
    await deleteProjectFromWorkspace(client, "p1");
    expect(client.getQueryData(workspaceQuery.root().queryKey)).toEqual([]);
    expect(client.getQueryData(workspaceQuery.diagrams("p1").queryKey)).toBeUndefined();
    client.clear();
  });
});
