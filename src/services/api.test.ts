import { afterEach, describe, expect, it, vi } from "vite-plus/test";
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
