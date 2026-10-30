import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createDiagramVersionRequestSchema, revisionRequestSchema } from "../../src/schemas/api";
import { boundedJsonBody } from "../http/body";
import { methodNotAllowed, rejectHead } from "../http/middleware";
import {
  rejectInvalidRequest,
  validateDiagramParams,
  validateVersionParams,
} from "../http/validation";
import type { WorkspaceRepository } from "../repository";
import type { WorkspaceEnv } from "../types";

export function versionRoutes(repository: WorkspaceRepository) {
  return new Hono<WorkspaceEnv>()
    .get("/diagrams/:diagramId/versions", rejectHead, validateDiagramParams, async (c) =>
      c.json(await repository.versions(c.get("owner"), c.req.valid("param").diagramId)),
    )
    .post(
      "/diagrams/:diagramId/versions",
      validateDiagramParams,
      boundedJsonBody,
      zValidator("json", createDiagramVersionRequestSchema, rejectInvalidRequest),
      async (c) =>
        c.json(
          await repository.createVersion(
            c.get("owner"),
            c.req.valid("param").diagramId,
            c.req.valid("json"),
          ),
          201,
        ),
    )
    .get(
      "/diagrams/:diagramId/versions/:versionId",
      rejectHead,
      validateVersionParams,
      async (c) => {
        const { diagramId, versionId } = c.req.valid("param");
        return c.json(await repository.version(c.get("owner"), diagramId, versionId));
      },
    )
    .delete("/diagrams/:diagramId/versions/:versionId", validateVersionParams, async (c) => {
      const { diagramId, versionId } = c.req.valid("param");
      await repository.deleteVersion(c.get("owner"), diagramId, versionId);
      return c.body(null, 204);
    })
    .post(
      "/diagrams/:diagramId/versions/:versionId/restore",
      validateVersionParams,
      boundedJsonBody,
      zValidator("json", revisionRequestSchema, rejectInvalidRequest),
      async (c) => {
        const { diagramId, versionId } = c.req.valid("param");
        return c.json(
          await repository.restoreVersion(
            c.get("owner"),
            diagramId,
            versionId,
            c.req.valid("json").expectedRevision,
          ),
        );
      },
    )
    .all("/diagrams/:diagramId/versions", methodNotAllowed)
    .all("/diagrams/:diagramId/versions/:versionId", methodNotAllowed)
    .all("/diagrams/:diagramId/versions/:versionId/restore", methodNotAllowed);
}
