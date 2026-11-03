import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ZodError } from "zod";
import type { ApiDiagram } from "@/schemas/api";
import { setApiTokenProvider } from "./auth";
import { diagramsApi } from "./diagrams";
import { ApiError, ApiRequestValidationError, ApiResponseValidationError } from "./errors";

const diagram: ApiDiagram = {
  id: "diagram-a",
  projectId: "project-a",
  name: "Services",
  description: null,
  data: { nodes: [], edges: [] },
  thumbnail: null,
  version: 0,
  revision: 3,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-02T00:00:00Z",
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

describe("diagramsApi.get", () => {
  it("gets the encoded diagram path with the bearer token and returns the validated diagram", async () => {
    const fetcher = stubFetch(() => jsonResponse(diagram));
    const controller = new AbortController();

    await expect(diagramsApi.get("a/b", { signal: controller.signal })).resolves.toEqual(diagram);

    const request = sentRequest(fetcher);
    expect(request.url).toBe("/api/diagrams/a%2Fb");
    expect(request.method).toBe("GET");
    expect(request.body).toBeUndefined();
    expect(request.init?.signal).toBe(controller.signal);
    expect(request.headers.get("authorization")).toBe("Bearer token");
    expect(request.headers.get("content-type")).toBeNull();
  });

  it("does not fetch when the read is already cancelled", async () => {
    const fetcher = stubFetch(() => jsonResponse(diagram));
    const controller = new AbortController();
    controller.abort();

    await expect(diagramsApi.get("diagram-a", { signal: controller.signal })).rejects.toMatchObject(
      { name: "AbortError" },
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not fetch without a session token", async () => {
    setApiTokenProvider(async () => null);
    const fetcher = stubFetch(() => jsonResponse(diagram));

    await expect(diagramsApi.get("diagram-a")).rejects.toMatchObject({
      name: "ApiError",
      status: 401,
      message: "Sign in to access this workspace.",
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("turns a 404 error body into an ApiError carrying the server message", async () => {
    stubFetch(() =>
      jsonResponse({ message: "Diagram not found" }, { status: 404, statusText: "Not Found" }),
    );

    const error = await diagramsApi.get("missing").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 404,
      message: "GET /diagrams/missing failed (404 Not Found): Diagram not found",
      cause: undefined,
    });
  });

  it("reports a malformed JSON error body as an ApiError with the parse failure as cause", async () => {
    stubFetch(() => new Response("<html>oops</html>", { status: 404, statusText: "Not Found" }));

    const error = await diagramsApi.get("missing").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 404,
      message: "GET /diagrams/missing failed (404 Not Found): the backend returned malformed JSON.",
    });
    expect(error).toHaveProperty("cause", expect.any(SyntaxError));
  });

  it("reports an error body that misses the message field as an ApiError with the schema failure as cause", async () => {
    stubFetch(() => jsonResponse({ error: "nope" }, { status: 404, statusText: "Not Found" }));

    const error = await diagramsApi.get("missing").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 404,
      message:
        "GET /diagrams/missing failed (404 Not Found): the backend returned an invalid error body.",
    });
    expect(error).toHaveProperty("cause", expect.any(ZodError));
  });

  it.each([
    { label: "invalid JSON", body: "{not json", cause: SyntaxError },
    { label: "an empty body", body: "", cause: ZodError },
    {
      label: "a non-positive revision",
      body: JSON.stringify({ ...diagram, revision: 0 }),
      cause: ZodError,
    },
    {
      label: "missing diagram data",
      body: JSON.stringify({ ...diagram, data: undefined }),
      cause: ZodError,
    },
    {
      label: "an unknown field",
      body: JSON.stringify({ ...diagram, extra: true }),
      cause: ZodError,
    },
  ])(
    "rejects a 200 response with $label as ApiResponseValidationError",
    async ({ body, cause }) => {
      stubFetch(() => new Response(body));

      const error = await diagramsApi.get("diagram-a").catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ApiResponseValidationError);
      expect(error).toMatchObject({
        name: "ApiResponseValidationError",
        message:
          "Invalid response from GET /diagrams/diagram-a: the backend response does not match the API contract.",
      });
      expect(error).toHaveProperty("cause", expect.any(cause));
    },
  );
});

describe("diagramsApi.create", () => {
  it("posts the validated JSON body to the encoded project path", async () => {
    const fetcher = stubFetch(() => jsonResponse(diagram, { status: 201 }));
    const request = { name: "Services", description: "Service map", data: diagram.data };

    await expect(diagramsApi.create("project a", request)).resolves.toEqual(diagram);

    const sent = sentRequest(fetcher);
    expect(sent.url).toBe("/api/projects/project%20a/diagrams");
    expect(sent.method).toBe("POST");
    expect(sent.body).toEqual(request);
    expect(sent.headers.get("content-type")).toBe("application/json");
    expect(sent.headers.get("authorization")).toBe("Bearer token");
  });

  it("rejects invalid request data before fetching", async () => {
    const fetcher = stubFetch(() => jsonResponse(diagram, { status: 201 }));

    const error = await diagramsApi
      .create("project-a", { name: "   " })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiRequestValidationError);
    expect(error).toMatchObject({
      message:
        "Cannot send POST /projects/project-a/diagrams: the request data does not match the API contract.",
    });
    expect(error).toHaveProperty("cause", expect.any(ZodError));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("surfaces a 404 for a missing project as ApiError", async () => {
    stubFetch(() =>
      jsonResponse({ message: "Project not found" }, { status: 404, statusText: "Not Found" }),
    );

    await expect(diagramsApi.create("missing", { name: "Services" })).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "POST /projects/missing/diagrams failed (404 Not Found): Project not found",
    });
  });
});

describe("diagramsApi.update", () => {
  it("patches the diagram with the expected revision in the JSON body", async () => {
    const updated = { ...diagram, name: "Renamed", revision: 4 };
    const fetcher = stubFetch(() => jsonResponse(updated));

    await expect(
      diagramsApi.update("diagram-a", { expectedRevision: 3, name: "Renamed" }),
    ).resolves.toEqual(updated);

    const sent = sentRequest(fetcher);
    expect(sent.url).toBe("/api/diagrams/diagram-a");
    expect(sent.method).toBe("PATCH");
    expect(sent.body).toEqual({ expectedRevision: 3, name: "Renamed" });
    expect(sent.headers.get("content-type")).toBe("application/json");
    expect(sent.headers.get("authorization")).toBe("Bearer token");
  });

  it.each([0, 1.5, -1])("rejects expectedRevision %s before fetching", async (expectedRevision) => {
    const fetcher = stubFetch(() => jsonResponse(diagram));

    await expect(
      diagramsApi.update("diagram-a", { expectedRevision, name: "Renamed" }),
    ).rejects.toBeInstanceOf(ApiRequestValidationError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("surfaces a stale revision 409 as ApiError with status 409", async () => {
    stubFetch(() =>
      jsonResponse(
        { message: "Diagram changed elsewhere" },
        { status: 409, statusText: "Conflict" },
      ),
    );

    const error = await diagramsApi
      .update("diagram-a", { expectedRevision: 2, name: "Renamed" })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      message: "PATCH /diagrams/diagram-a failed (409 Conflict): Diagram changed elsewhere",
    });
  });

  it("rejects a malformed success body as ApiResponseValidationError", async () => {
    stubFetch(() => jsonResponse({ ...diagram, revision: "4" }));

    await expect(
      diagramsApi.update("diagram-a", { expectedRevision: 3, name: "Renamed" }),
    ).rejects.toThrow(
      "Invalid response from PATCH /diagrams/diagram-a: the backend response does not match the API contract.",
    );
  });
});

describe("diagramsApi.delete", () => {
  it("deletes the encoded diagram path and resolves on 204 No Content", async () => {
    const fetcher = stubFetch(() => new Response(null, { status: 204 }));

    await expect(diagramsApi.delete("a/b")).resolves.toBeUndefined();

    const sent = sentRequest(fetcher);
    expect(sent.url).toBe("/api/diagrams/a%2Fb");
    expect(sent.method).toBe("DELETE");
    expect(sent.body).toBeUndefined();
    expect(sent.headers.get("authorization")).toBe("Bearer token");
  });

  it("rejects a success status other than 204 as ApiResponseValidationError", async () => {
    stubFetch(() => jsonResponse(diagram));

    await expect(diagramsApi.delete("diagram-a")).rejects.toThrow(
      "Invalid response from DELETE /diagrams/diagram-a: the backend response does not match the API contract.",
    );
  });

  it("surfaces a 404 for a missing diagram as ApiError", async () => {
    stubFetch(() =>
      jsonResponse({ message: "Diagram not found" }, { status: 404, statusText: "Not Found" }),
    );

    await expect(diagramsApi.delete("missing")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "DELETE /diagrams/missing failed (404 Not Found): Diagram not found",
    });
  });
});

describe("diagramsApi.updateThumbnail", () => {
  it("puts the thumbnail with the expected revision in the JSON body", async () => {
    const updated = { ...diagram, thumbnail: "data:image/png;base64,AAAA", revision: 4 };
    const fetcher = stubFetch(() => jsonResponse(updated));

    await expect(
      diagramsApi.updateThumbnail("diagram-a", "data:image/png;base64,AAAA", 3),
    ).resolves.toEqual(updated);

    const sent = sentRequest(fetcher);
    expect(sent.url).toBe("/api/diagrams/diagram-a/thumbnail");
    expect(sent.method).toBe("PUT");
    expect(sent.body).toEqual({ thumbnail: "data:image/png;base64,AAAA", expectedRevision: 3 });
    expect(sent.headers.get("content-type")).toBe("application/json");
    expect(sent.headers.get("authorization")).toBe("Bearer token");
  });

  it("rejects an oversized thumbnail or invalid revision before fetching", async () => {
    const fetcher = stubFetch(() => jsonResponse(diagram));

    await expect(
      diagramsApi.updateThumbnail("diagram-a", "x".repeat(500_001), 3),
    ).rejects.toBeInstanceOf(ApiRequestValidationError);
    await expect(diagramsApi.updateThumbnail("diagram-a", "thumb", 0)).rejects.toThrow(
      "Cannot send PUT /diagrams/diagram-a/thumbnail: the request data does not match the API contract.",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("surfaces a stale revision 409 as ApiError with status 409", async () => {
    stubFetch(() =>
      jsonResponse({ message: "Stale revision" }, { status: 409, statusText: "Conflict" }),
    );

    await expect(diagramsApi.updateThumbnail("diagram-a", "thumb", 2)).rejects.toMatchObject({
      name: "ApiError",
      status: 409,
      message: "PUT /diagrams/diagram-a/thumbnail failed (409 Conflict): Stale revision",
    });
  });

  it("rejects a malformed success body as ApiResponseValidationError", async () => {
    stubFetch(() => jsonResponse({ ...diagram, thumbnail: 42 }));

    await expect(diagramsApi.updateThumbnail("diagram-a", "thumb", 3)).rejects.toBeInstanceOf(
      ApiResponseValidationError,
    );
  });
});
