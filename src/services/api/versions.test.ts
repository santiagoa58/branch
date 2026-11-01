import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ZodError } from "zod";
import type { ApiDiagram, ApiDiagramVersion, ApiDiagramVersionFull } from "@/schemas/api";
import { setApiTokenProvider } from "./auth";
import { ApiError, ApiRequestValidationError, ApiResponseValidationError } from "./errors";
import { versionsApi } from "./versions";

const version: ApiDiagramVersion = {
  id: "version-1",
  diagramId: "diagram-a",
  versionNumber: 1,
  label: "Before refactor",
  thumbnail: null,
  createdAt: "2026-10-03T00:00:00Z",
};

const fullVersion: ApiDiagramVersionFull = { ...version, data: { nodes: [], edges: [] } };

const restoredDiagram: ApiDiagram = {
  id: "diagram-a",
  projectId: "project-a",
  name: "Services",
  description: null,
  data: { nodes: [], edges: [] },
  thumbnail: null,
  version: 1,
  revision: 5,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-04T00:00:00Z",
};

function stubFetch(createResponse: () => Response) {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => createResponse());
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), init);
}

function sentRequest(fetcher: ReturnType<typeof stubFetch>) {
  expect(fetcher).toHaveBeenCalledOnce();
  const [url, init] = fetcher.mock.calls[0] ?? [];
  const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : init?.body;
  return { url, method: init?.method, headers: new Headers(init?.headers), body, init };
}

beforeEach(() => {
  setApiTokenProvider(async () => "token");
});

afterEach(() => {
  setApiTokenProvider(null);
  vi.unstubAllGlobals();
});

describe("versionsApi.list", () => {
  it("gets the encoded versions path and returns the validated summaries", async () => {
    const fetcher = stubFetch(() => jsonResponse([version, { ...version, id: "version-2" }]));
    const controller = new AbortController();

    await expect(versionsApi.list("a/b", { signal: controller.signal })).resolves.toEqual([
      version,
      { ...version, id: "version-2" },
    ]);

    const sent = sentRequest(fetcher);
    expect(sent.url).toBe("/api/diagrams/a%2Fb/versions");
    expect(sent.method).toBe("GET");
    expect(sent.body).toBeUndefined();
    expect(sent.init?.signal).toBe(controller.signal);
    expect(sent.headers.get("authorization")).toBe("Bearer token");
  });

  it("does not fetch when the read is already cancelled", async () => {
    const fetcher = stubFetch(() => jsonResponse([]));
    const controller = new AbortController();
    controller.abort();

    await expect(
      versionsApi.list("diagram-a", { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    { label: "an object instead of a list", body: JSON.stringify({ versions: [] }) },
    { label: "a full version with data", body: JSON.stringify([fullVersion]) },
    {
      label: "a string version number",
      body: JSON.stringify([{ ...version, versionNumber: "1" }]),
    },
  ])("rejects $label as ApiResponseValidationError", async ({ body }) => {
    stubFetch(() => new Response(body));

    const error = await versionsApi.list("diagram-a").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiResponseValidationError);
    expect(error).toMatchObject({
      message:
        "Invalid response from GET /diagrams/diagram-a/versions: the backend response does not match the API contract.",
    });
    expect(error).toHaveProperty("cause", expect.any(ZodError));
  });

  it("surfaces a 404 for a missing diagram as ApiError", async () => {
    stubFetch(() =>
      jsonResponse({ message: "Diagram not found" }, { status: 404, statusText: "Not Found" }),
    );

    await expect(versionsApi.list("missing")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "GET /diagrams/missing/versions failed (404 Not Found): Diagram not found",
    });
  });
});

describe("versionsApi.get", () => {
  it("gets the encoded version path and returns the version with its data", async () => {
    const fetcher = stubFetch(() => jsonResponse(fullVersion));
    const controller = new AbortController();

    await expect(
      versionsApi.get("diagram-a", "v 1", { signal: controller.signal }),
    ).resolves.toEqual(fullVersion);

    const sent = sentRequest(fetcher);
    expect(sent.url).toBe("/api/diagrams/diagram-a/versions/v%201");
    expect(sent.method).toBe("GET");
    expect(sent.init?.signal).toBe(controller.signal);
    expect(sent.headers.get("authorization")).toBe("Bearer token");
  });

  it("rejects a version summary without data as ApiResponseValidationError", async () => {
    stubFetch(() => jsonResponse(version));

    await expect(versionsApi.get("diagram-a", "version-1")).rejects.toThrow(
      "Invalid response from GET /diagrams/diagram-a/versions/version-1: the backend response does not match the API contract.",
    );
  });

  it("rejects malformed JSON as ApiResponseValidationError with the parse failure as cause", async () => {
    stubFetch(() => new Response("{"));

    const error = await versionsApi
      .get("diagram-a", "version-1")
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiResponseValidationError);
    expect(error).toHaveProperty("cause", expect.any(SyntaxError));
  });

  it("surfaces a 404 for a missing version as ApiError", async () => {
    stubFetch(() =>
      jsonResponse({ message: "Version not found" }, { status: 404, statusText: "Not Found" }),
    );

    const error = await versionsApi.get("diagram-a", "missing").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 404,
      message: "GET /diagrams/diagram-a/versions/missing failed (404 Not Found): Version not found",
    });
  });
});

describe("versionsApi.create", () => {
  it("posts the expected revision and label as JSON", async () => {
    const fetcher = stubFetch(() => jsonResponse(version, { status: 201 }));

    await expect(versionsApi.create("diagram-a", 4, "Before refactor")).resolves.toEqual(version);

    const sent = sentRequest(fetcher);
    expect(sent.url).toBe("/api/diagrams/diagram-a/versions");
    expect(sent.method).toBe("POST");
    expect(sent.body).toEqual({ expectedRevision: 4, label: "Before refactor" });
    expect(sent.headers.get("content-type")).toBe("application/json");
    expect(sent.headers.get("authorization")).toBe("Bearer token");
  });

  it("omits the label when none is given", async () => {
    const fetcher = stubFetch(() => jsonResponse({ ...version, label: null }, { status: 201 }));

    await expect(versionsApi.create("diagram-a", 4)).resolves.toEqual({ ...version, label: null });

    expect(sentRequest(fetcher).init?.body).toBe(JSON.stringify({ expectedRevision: 4 }));
  });

  it("rejects an invalid revision or oversized label before fetching", async () => {
    const fetcher = stubFetch(() => jsonResponse(version, { status: 201 }));

    const error = await versionsApi.create("diagram-a", 0).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiRequestValidationError);
    expect(error).toMatchObject({
      message:
        "Cannot send POST /diagrams/diagram-a/versions: the request data does not match the API contract.",
    });
    expect(error).toHaveProperty("cause", expect.any(ZodError));
    await expect(versionsApi.create("diagram-a", 4, "x".repeat(201))).rejects.toBeInstanceOf(
      ApiRequestValidationError,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("surfaces a stale revision 409 as ApiError with status 409", async () => {
    stubFetch(() =>
      jsonResponse(
        { message: "Diagram changed elsewhere" },
        { status: 409, statusText: "Conflict" },
      ),
    );

    const error = await versionsApi.create("diagram-a", 3).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      message: "POST /diagrams/diagram-a/versions failed (409 Conflict): Diagram changed elsewhere",
    });
  });

  it("rejects a malformed success body as ApiResponseValidationError", async () => {
    stubFetch(() => jsonResponse({ ...version, id: undefined }, { status: 201 }));

    await expect(versionsApi.create("diagram-a", 4)).rejects.toBeInstanceOf(
      ApiResponseValidationError,
    );
  });
});

describe("versionsApi.restore", () => {
  it("posts the expected revision to the encoded restore path and returns the diagram", async () => {
    const fetcher = stubFetch(() => jsonResponse(restoredDiagram));

    await expect(versionsApi.restore("diagram-a", "v/1", 4)).resolves.toEqual(restoredDiagram);

    const sent = sentRequest(fetcher);
    expect(sent.url).toBe("/api/diagrams/diagram-a/versions/v%2F1/restore");
    expect(sent.method).toBe("POST");
    expect(sent.body).toEqual({ expectedRevision: 4 });
    expect(sent.headers.get("content-type")).toBe("application/json");
    expect(sent.headers.get("authorization")).toBe("Bearer token");
  });

  it("rejects an invalid revision before fetching", async () => {
    const fetcher = stubFetch(() => jsonResponse(restoredDiagram));

    await expect(versionsApi.restore("diagram-a", "version-1", 2.5)).rejects.toThrow(
      "Cannot send POST /diagrams/diagram-a/versions/version-1/restore: the request data does not match the API contract.",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("surfaces a stale revision 409 as ApiError with status 409", async () => {
    stubFetch(() =>
      jsonResponse({ message: "Stale revision" }, { status: 409, statusText: "Conflict" }),
    );

    await expect(versionsApi.restore("diagram-a", "version-1", 3)).rejects.toMatchObject({
      name: "ApiError",
      status: 409,
      message:
        "POST /diagrams/diagram-a/versions/version-1/restore failed (409 Conflict): Stale revision",
    });
  });

  it("rejects a version body in place of the restored diagram as ApiResponseValidationError", async () => {
    stubFetch(() => jsonResponse(fullVersion));

    await expect(versionsApi.restore("diagram-a", "version-1", 4)).rejects.toBeInstanceOf(
      ApiResponseValidationError,
    );
  });
});

describe("versionsApi.delete", () => {
  it("deletes the encoded version path and resolves on 204 No Content", async () => {
    const fetcher = stubFetch(() => new Response(null, { status: 204 }));

    await expect(versionsApi.delete("diagram-a", "v/1")).resolves.toBeUndefined();

    const sent = sentRequest(fetcher);
    expect(sent.url).toBe("/api/diagrams/diagram-a/versions/v%2F1");
    expect(sent.method).toBe("DELETE");
    expect(sent.body).toBeUndefined();
    expect(sent.headers.get("authorization")).toBe("Bearer token");
  });

  it("rejects a 200 response as ApiResponseValidationError", async () => {
    stubFetch(() => new Response(null, { status: 200 }));

    await expect(versionsApi.delete("diagram-a", "version-1")).rejects.toThrow(
      "Invalid response from DELETE /diagrams/diagram-a/versions/version-1: the backend response does not match the API contract.",
    );
  });

  it("surfaces a 404 for a missing version as ApiError", async () => {
    stubFetch(() => new Response("", { status: 404, statusText: "Not Found" }));

    await expect(versionsApi.delete("diagram-a", "missing")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message:
        "DELETE /diagrams/diagram-a/versions/missing failed (404 Not Found): the backend returned an invalid error body.",
    });
  });
});
