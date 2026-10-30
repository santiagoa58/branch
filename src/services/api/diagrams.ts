import {
  apiDiagramSchema,
  createDiagramRequestSchema,
  updateDiagramRequestSchema,
  updateThumbnailRequestSchema,
  type CreateDiagramRequest,
  type UpdateDiagramRequest,
} from "@/schemas/api";
import { readEmptyResponse } from "./emptyResponse";
import { serializeJsonRequest } from "./jsonRequest";
import { readJsonResponse } from "./jsonResponse";
import { sendApiRequest } from "./transport";
import type { ApiReadOptions } from "./types";

export const diagramsApi = {
  get: async (id: string, options?: ApiReadOptions) => {
    const path = `/diagrams/${encodeURIComponent(id)}`;
    const response = await sendApiRequest("GET", path, options);
    return readJsonResponse("GET", path, response, apiDiagramSchema);
  },

  create: async (projectId: string, data: CreateDiagramRequest) => {
    const path = `/projects/${encodeURIComponent(projectId)}/diagrams`;
    const body = serializeJsonRequest("POST", path, createDiagramRequestSchema, data);
    const response = await sendApiRequest("POST", path, body);
    return readJsonResponse("POST", path, response, apiDiagramSchema);
  },

  update: async (id: string, data: UpdateDiagramRequest) => {
    const path = `/diagrams/${encodeURIComponent(id)}`;
    const body = serializeJsonRequest("PATCH", path, updateDiagramRequestSchema, data);
    const response = await sendApiRequest("PATCH", path, body);
    return readJsonResponse("PATCH", path, response, apiDiagramSchema);
  },

  delete: async (id: string) => {
    const path = `/diagrams/${encodeURIComponent(id)}`;
    const response = await sendApiRequest("DELETE", path);
    return readEmptyResponse("DELETE", path, response);
  },

  updateThumbnail: async (id: string, thumbnail: string, expectedRevision: number) => {
    const path = `/diagrams/${encodeURIComponent(id)}/thumbnail`;
    const body = serializeJsonRequest("PUT", path, updateThumbnailRequestSchema, {
      thumbnail,
      expectedRevision,
    });
    const response = await sendApiRequest("PUT", path, body);
    return readJsonResponse("PUT", path, response, apiDiagramSchema);
  },
};
