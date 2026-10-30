// Same-origin, authenticated cloud API.
import {
  apiDiagramSchema,
  apiDiagramSummaryListSchema,
  apiDiagramVersionFullSchema,
  apiDiagramVersionListSchema,
  apiDiagramVersionSchema,
  apiErrorBodySchema,
  apiProjectListSchema,
  apiProjectSchema,
  createDiagramRequestSchema,
  createDiagramVersionRequestSchema,
  createProjectRequestSchema,
  updateDiagramRequestSchema,
  updateProjectRequestSchema,
  updateThumbnailRequestSchema,
  voidResponseSchema,
  revisionRequestSchema,
  type CreateDiagramRequest,
  type CreateProjectRequest,
  type UpdateDiagramRequest,
  type UpdateProjectRequest,
} from "@/schemas/api";
import type { ZodType } from "zod";

export type {
  ApiDiagram,
  ApiDiagramSummary,
  ApiDiagramVersion,
  ApiDiagramVersionFull,
  ApiErrorBody,
  ApiProject,
  ApiProjectSummary,
  CreateDiagramRequest,
  CreateDiagramVersionRequest,
  CreateProjectRequest,
  UpdateDiagramRequest,
  UpdateProjectRequest,
  UpdateThumbnailRequest,
} from "@/schemas/api";

const API_BASE = "/api";
let getToken: (() => Promise<string | null>) | null = null;
export function setApiTokenProvider(provider: (() => Promise<string | null>) | null) {
  getToken = provider;
}

type RequestOptions<TRequest> = Omit<RequestInit, "body"> &
  (
    | {
        requestSchema: ZodType<TRequest>;
        data: TRequest;
      }
    | {
        requestSchema?: never;
        data?: never;
      }
  );

export class ApiError extends Error {
  readonly cause?: unknown;

  constructor(
    public status: number,
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.cause = cause;
  }
}

export class ApiRequestValidationError extends Error {
  readonly cause: unknown;

  constructor(method: string, path: string, cause: unknown) {
    super(`Cannot send ${method} ${path}: the request data does not match the API contract.`);
    this.name = "ApiRequestValidationError";
    this.cause = cause;
  }
}

export class ApiResponseValidationError extends Error {
  readonly cause: unknown;

  constructor(method: string, path: string, cause: unknown) {
    super(
      `Invalid response from ${method} ${path}: the backend response does not match the API contract.`,
    );
    this.name = "ApiResponseValidationError";
    this.cause = cause;
  }
}

function parseResponseText(text: string): unknown {
  return text.trim() === "" ? undefined : JSON.parse(text);
}

async function request<TResponse, TRequest = never>(
  path: string,
  responseSchema: ZodType<TResponse>,
  init?: RequestOptions<TRequest>,
): Promise<TResponse> {
  const { requestSchema, data, ...requestInit } = init ?? {};
  const method = requestInit.method ?? "GET";
  const headers = new Headers(requestInit.headers);
  const token = await getToken?.();
  if (!token) {
    throw new ApiError(401, "Sign in to access this workspace.");
  }
  headers.set("Authorization", `Bearer ${token}`);
  let body: string | undefined;

  if (requestSchema) {
    let validatedData: TRequest;
    try {
      validatedData = requestSchema.parse(data);
    } catch (cause) {
      throw new ApiRequestValidationError(method, path, cause);
    }
    body = JSON.stringify(validatedData);
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...requestInit,
    headers,
    ...(body === undefined ? {} : { body }),
  });
  const text = await res.text();

  if (!res.ok) {
    let errorData: unknown;
    try {
      errorData = parseResponseText(text);
    } catch (cause) {
      throw new ApiError(
        res.status,
        `${method} ${path} failed (${res.status} ${res.statusText}): the backend returned malformed JSON.`,
        cause,
      );
    }

    const errorBody = apiErrorBodySchema.safeParse(errorData);
    if (!errorBody.success) {
      throw new ApiError(
        res.status,
        `${method} ${path} failed (${res.status} ${res.statusText}): the backend returned an invalid error body.`,
        errorBody.error,
      );
    }

    throw new ApiError(
      res.status,
      `${method} ${path} failed (${res.status} ${res.statusText}): ${errorBody.data.message}`,
    );
  }

  let responseData: unknown;
  try {
    responseData = parseResponseText(text);
  } catch (cause) {
    throw new ApiResponseValidationError(method, path, cause);
  }

  const result = responseSchema.safeParse(responseData);
  if (!result.success) {
    throw new ApiResponseValidationError(method, path, result.error);
  }
  return result.data;
}

// --- Projects ---

export const projectsApi = {
  list: () => request("/projects", apiProjectListSchema),

  get: (id: string) => request(`/projects/${encodeURIComponent(id)}`, apiProjectSchema),

  create: (data: CreateProjectRequest) =>
    request("/projects", apiProjectSchema, {
      method: "POST",
      requestSchema: createProjectRequestSchema,
      data,
    }),

  update: (id: string, data: UpdateProjectRequest) =>
    request(`/projects/${encodeURIComponent(id)}`, apiProjectSchema, {
      method: "PATCH",
      requestSchema: updateProjectRequestSchema,
      data,
    }),

  delete: (id: string) =>
    request(`/projects/${encodeURIComponent(id)}`, voidResponseSchema, { method: "DELETE" }),

  diagrams: (projectId: string) =>
    request(`/projects/${encodeURIComponent(projectId)}/diagrams`, apiDiagramSummaryListSchema),
};

// --- Diagrams ---

export const diagramsApi = {
  get: (id: string) => request(`/diagrams/${encodeURIComponent(id)}`, apiDiagramSchema),

  create: (projectId: string, data: CreateDiagramRequest) =>
    request(`/projects/${encodeURIComponent(projectId)}/diagrams`, apiDiagramSchema, {
      method: "POST",
      requestSchema: createDiagramRequestSchema,
      data,
    }),

  update: (id: string, data: UpdateDiagramRequest) =>
    request(`/diagrams/${encodeURIComponent(id)}`, apiDiagramSchema, {
      method: "PATCH",
      requestSchema: updateDiagramRequestSchema,
      data,
    }),

  delete: (id: string) =>
    request(`/diagrams/${encodeURIComponent(id)}`, voidResponseSchema, { method: "DELETE" }),

  updateThumbnail: (id: string, thumbnail: string, expectedRevision: number) =>
    request(`/diagrams/${encodeURIComponent(id)}/thumbnail`, apiDiagramSchema, {
      method: "PUT",
      requestSchema: updateThumbnailRequestSchema,
      data: { thumbnail, expectedRevision },
    }),
};

// --- Diagram Versions ---

export const versionsApi = {
  list: (diagramId: string) =>
    request(`/diagrams/${encodeURIComponent(diagramId)}/versions`, apiDiagramVersionListSchema),

  get: (diagramId: string, versionId: string) =>
    request(
      `/diagrams/${encodeURIComponent(diagramId)}/versions/${encodeURIComponent(versionId)}`,
      apiDiagramVersionFullSchema,
    ),

  create: (diagramId: string, expectedRevision: number, label?: string) =>
    request(`/diagrams/${encodeURIComponent(diagramId)}/versions`, apiDiagramVersionSchema, {
      method: "POST",
      requestSchema: createDiagramVersionRequestSchema,
      data: { expectedRevision, ...(label === undefined ? {} : { label }) },
    }),

  restore: (diagramId: string, versionId: string, expectedRevision: number) =>
    request(
      `/diagrams/${encodeURIComponent(diagramId)}/versions/${encodeURIComponent(versionId)}/restore`,
      apiDiagramSchema,
      { method: "POST", requestSchema: revisionRequestSchema, data: { expectedRevision } },
    ),

  delete: (diagramId: string, versionId: string) =>
    request(
      `/diagrams/${encodeURIComponent(diagramId)}/versions/${encodeURIComponent(versionId)}`,
      voidResponseSchema,
      { method: "DELETE" },
    ),
};
