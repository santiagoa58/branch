import {
  apiDiagramSummaryListSchema,
  apiProjectListSchema,
  apiProjectSchema,
  apiWorkspaceSchema,
  createProjectRequestSchema,
  updateProjectRequestSchema,
  type CreateProjectRequest,
  type UpdateProjectRequest,
} from "@/schemas/api";
import { readEmptyResponse } from "./emptyResponse";
import { serializeJsonRequest } from "./jsonRequest";
import { readJsonResponse } from "./jsonResponse";
import { sendApiRequest } from "./transport";
import type { ApiReadOptions } from "./types";

export const projectsApi = {
  workspace: async (options?: ApiReadOptions) => {
    const path = "/workspace";
    const response = await sendApiRequest("GET", path, options);
    return readJsonResponse("GET", path, response, apiWorkspaceSchema);
  },

  list: async (options?: ApiReadOptions) => {
    const path = "/projects";
    const response = await sendApiRequest("GET", path, options);
    return readJsonResponse("GET", path, response, apiProjectListSchema);
  },

  get: async (id: string, options?: ApiReadOptions) => {
    const path = `/projects/${encodeURIComponent(id)}`;
    const response = await sendApiRequest("GET", path, options);
    return readJsonResponse("GET", path, response, apiProjectSchema);
  },

  create: async (data: CreateProjectRequest) => {
    const path = "/projects";
    const body = serializeJsonRequest("POST", path, createProjectRequestSchema, data);
    const response = await sendApiRequest("POST", path, body);
    return readJsonResponse("POST", path, response, apiProjectSchema);
  },

  update: async (id: string, data: UpdateProjectRequest) => {
    const path = `/projects/${encodeURIComponent(id)}`;
    const body = serializeJsonRequest("PATCH", path, updateProjectRequestSchema, data);
    const response = await sendApiRequest("PATCH", path, body);
    return readJsonResponse("PATCH", path, response, apiProjectSchema);
  },

  delete: async (id: string) => {
    const path = `/projects/${encodeURIComponent(id)}`;
    const response = await sendApiRequest("DELETE", path);
    return readEmptyResponse("DELETE", path, response);
  },

  diagrams: async (projectId: string, options?: ApiReadOptions) => {
    const path = `/projects/${encodeURIComponent(projectId)}/diagrams`;
    const response = await sendApiRequest("GET", path, options);
    return readJsonResponse("GET", path, response, apiDiagramSummaryListSchema);
  },
};
