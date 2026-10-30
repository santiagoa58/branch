import { zValidator } from "@hono/zod-validator";
import {
  projectRouteParamsSchema,
  diagramRouteParamsSchema,
  versionRouteParamsSchema,
} from "../../src/schemas/server";
import { HttpError } from "../repository";

export function rejectInvalidRequest(result: { success: boolean }): void {
  if (!result.success) {
    throw new HttpError(400, "The request does not match the data contract.");
  }
}

export const validateProjectParams = zValidator(
  "param",
  projectRouteParamsSchema,
  rejectInvalidRequest,
);
export const validateDiagramParams = zValidator(
  "param",
  diagramRouteParamsSchema,
  rejectInvalidRequest,
);
export const validateVersionParams = zValidator(
  "param",
  versionRouteParamsSchema,
  rejectInvalidRequest,
);
