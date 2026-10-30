import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { updateDiagramRequestSchema, updateThumbnailRequestSchema } from "../../src/schemas/api";
import { boundedJsonBody } from "../http/body";
import { methodNotAllowed, rejectHead } from "../http/middleware";
import { rejectInvalidRequest, validateDiagramParams } from "../http/validation";
import type { WorkspaceRepository } from "../repository";
import type { WorkspaceEnv } from "../types";

export function diagramRoutes(repository: WorkspaceRepository) {
  return new Hono<WorkspaceEnv>()
    .get("/diagrams/:diagramId", rejectHead, validateDiagramParams, async (c) =>
      c.json(await repository.diagram(c.get("owner"), c.req.valid("param").diagramId)),
    )
    .patch(
      "/diagrams/:diagramId",
      validateDiagramParams,
      boundedJsonBody,
      zValidator("json", updateDiagramRequestSchema, rejectInvalidRequest),
      async (c) =>
        c.json(
          await repository.updateDiagram(
            c.get("owner"),
            c.req.valid("param").diagramId,
            c.req.valid("json"),
          ),
        ),
    )
    .delete("/diagrams/:diagramId", validateDiagramParams, async (c) => {
      await repository.deleteDiagram(c.get("owner"), c.req.valid("param").diagramId);
      return c.body(null, 204);
    })
    .put(
      "/diagrams/:diagramId/thumbnail",
      validateDiagramParams,
      boundedJsonBody,
      zValidator("json", updateThumbnailRequestSchema, rejectInvalidRequest),
      async (c) =>
        c.json(
          await repository.thumbnail(
            c.get("owner"),
            c.req.valid("param").diagramId,
            c.req.valid("json"),
          ),
        ),
    )
    .all("/diagrams/:diagramId", methodNotAllowed)
    .all("/diagrams/:diagramId/thumbnail", methodNotAllowed);
}
