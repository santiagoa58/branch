import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { ApiWorkspaceProject } from "./api";
import {
  projectsApi,
  diagramsApi,
  versionsApi,
  setApiTokenProvider,
  ApiError,
  ApiResponseValidationError,
} from "./api";
afterEach(() => {
  setApiTokenProvider(null);
  vi.unstubAllGlobals();
});
const workspaceProject: ApiWorkspaceProject = {
  id: "project-a",
  name: "Architecture",
  description: null,
  color: null,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-02T00:00:00Z",
  diagrams: [
    {
      id: "diagram-a",
      projectId: "project-a",
      name: "Services",
      description: "Service architecture",
      thumbnail: null,
      version: 0,
      revision: 1,
      createdAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-02T00:00:00Z",
    },
  ],
};
describe("cloud API client", () => {
  it("requires authentication before issuing a request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    await expect(projectsApi.list()).rejects.toThrow("Sign in");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("uses same-origin routes and a freshly requested session token", async () => {
    setApiTokenProvider(async () => "token");
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("[]"));
    vi.stubGlobal("fetch", fetcher);
    await projectsApi.list();
    const [path, options] = fetcher.mock.calls[0] ?? [];
    expect(path).toBe("/api/projects");
    expect(new Headers(options?.headers).get("authorization")).toBe("Bearer token");
  });
  it("gets projects and nested diagram summaries in one authenticated same-origin request", async () => {
    const tokenProvider = vi.fn<() => Promise<string | null>>(async () => "workspace-token");
    setApiTokenProvider(tokenProvider);
    const workspace = [workspaceProject, { ...workspaceProject, id: "empty", diagrams: [] }];
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(workspace)));
    vi.stubGlobal("fetch", fetcher);

    await expect(projectsApi.workspace()).resolves.toEqual(workspace);
    expect(tokenProvider).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledOnce();
    const [path, options] = fetcher.mock.calls[0] ?? [];
    expect(path).toBe("/api/workspace");
    expect(options?.method ?? "GET").toBe("GET");
    expect(options?.body).toBeUndefined();
    expect(new Headers(options?.headers).get("authorization")).toBe("Bearer workspace-token");
  });
  it("accepts an empty workspace", async () => {
    setApiTokenProvider(async () => "token");
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response("[]")));
    await expect(projectsApi.workspace()).resolves.toEqual([]);
  });
  it.each([
    { ...workspaceProject, diagrams: undefined },
    { ...workspaceProject, diagrams: {} },
    { ...workspaceProject, diagrams: [{ ...workspaceProject.diagrams[0], revision: "1" }] },
    { ...workspaceProject, diagrams: [{ ...workspaceProject.diagrams[0], revision: 0 }] },
    { ...workspaceProject, diagrams: [{ ...workspaceProject.diagrams[0], thumbnail: 123 }] },
    {
      ...workspaceProject,
      diagrams: [{ ...workspaceProject.diagrams[0], data: { nodes: [], edges: [] } }],
    },
  ])("rejects malformed nested workspace responses: %j", async (project) => {
    setApiTokenProvider(async () => "token");
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify([project])));
    vi.stubGlobal("fetch", fetcher);
    await expect(projectsApi.workspace()).rejects.toBeInstanceOf(ApiResponseValidationError);
  });
  it("requires authentication for workspace reads", async () => {
    const fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetcher);
    await expect(projectsApi.workspace()).rejects.toBeInstanceOf(ApiError);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("surfaces conflicts and rejects malformed API responses", async () => {
    setApiTokenProvider(async () => "token");
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{"message":"Changed elsewhere"}', { status: 409 }))
      .mockResolvedValueOnce(new Response("{}"));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      diagramsApi.update("a", { expectedRevision: 1, data: { nodes: [], edges: [] } }),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(projectsApi.list()).rejects.toBeInstanceOf(ApiResponseValidationError);
  });
  it("sends expected revisions for snapshot and restore requests", async () => {
    setApiTokenProvider(async () => "token");
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response('{"message":"Conflict"}', { status: 409 }));
    vi.stubGlobal("fetch", fetcher);
    await expect(versionsApi.create("d", 4, "v1")).rejects.toThrow("Conflict");
    await expect(versionsApi.restore("d", "v", 4)).rejects.toThrow("Conflict");
    expect(fetcher.mock.calls.map(([, options]) => options?.body)).toEqual([
      JSON.stringify({ expectedRevision: 4, label: "v1" }),
      JSON.stringify({ expectedRevision: 4 }),
    ]);
  });
});
