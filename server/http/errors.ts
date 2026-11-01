import type { ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { apiErrorBodySchema } from "../../src/schemas/api";
import { HttpError } from "../repository";
import type { WorkspaceEnv } from "../types";

function errorResponse(
  status: number,
  message: string,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(apiErrorBodySchema.parse({ message })), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export const notFound: NotFoundHandler<WorkspaceEnv> = () =>
  errorResponse(404, "API endpoint not found.");

export const handleError: ErrorHandler<WorkspaceEnv> = (error) => {
  if (error instanceof HttpError) {
    return errorResponse(error.status, error.message, error.headers);
  }
  if (error instanceof HTTPException && (error.status === 400 || error.status === 405)) {
    return errorResponse(400, "Invalid JSON request.");
  }
  console.error("Workspace API request failed", error);
  // Stored data that no longer matches the schema is not an outage; retrying will not help.
  if (error instanceof z.ZodError) {
    return errorResponse(422, "This document was saved in a format this version can't read.");
  }
  return errorResponse(500, "The workspace service is unavailable. Please retry.");
};
