import {
  apiDiagramSchema,
  apiDiagramVersionFullSchema,
  apiDiagramVersionListSchema,
  apiDiagramVersionSchema,
  createDiagramVersionRequestSchema,
  revisionRequestSchema,
} from "@/schemas/api";
import { readEmptyResponse } from "./emptyResponse";
import { serializeJsonRequest } from "./jsonRequest";
import { readJsonResponse } from "./jsonResponse";
import { sendApiRequest } from "./transport";
import type { ApiReadOptions } from "./types";

export const versionsApi = {
  list: async (diagramId: string, options?: ApiReadOptions) => {
    const path = `/diagrams/${encodeURIComponent(diagramId)}/versions`;
    const response = await sendApiRequest("GET", path, options);
    return readJsonResponse("GET", path, response, apiDiagramVersionListSchema);
  },

  get: async (diagramId: string, versionId: string, options?: ApiReadOptions) => {
    const path = `/diagrams/${encodeURIComponent(diagramId)}/versions/${encodeURIComponent(versionId)}`;
    const response = await sendApiRequest("GET", path, options);
    return readJsonResponse("GET", path, response, apiDiagramVersionFullSchema);
  },

  create: async (diagramId: string, expectedRevision: number, label?: string) => {
    const path = `/diagrams/${encodeURIComponent(diagramId)}/versions`;
    const body = serializeJsonRequest("POST", path, createDiagramVersionRequestSchema, {
      expectedRevision,
      ...(label === undefined ? {} : { label }),
    });
    const response = await sendApiRequest("POST", path, body);
    return readJsonResponse("POST", path, response, apiDiagramVersionSchema);
  },

  restore: async (diagramId: string, versionId: string, expectedRevision: number) => {
    const path = `/diagrams/${encodeURIComponent(diagramId)}/versions/${encodeURIComponent(versionId)}/restore`;
    const body = serializeJsonRequest("POST", path, revisionRequestSchema, { expectedRevision });
    const response = await sendApiRequest("POST", path, body);
    return readJsonResponse("POST", path, response, apiDiagramSchema);
  },

  delete: async (diagramId: string, versionId: string) => {
    const path = `/diagrams/${encodeURIComponent(diagramId)}/versions/${encodeURIComponent(versionId)}`;
    const response = await sendApiRequest("DELETE", path);
    return readEmptyResponse("DELETE", path, response);
  },
};
