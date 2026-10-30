import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createProjectRequestSchema,
  updateProjectRequestSchema,
  createDiagramRequestSchema,
} from "../../src/schemas/api";
import { boundedJsonBody } from "../http/body";
import { methodNotAllowed, rejectHead } from "../http/middleware";
import { rejectInvalidRequest, validateProjectParams } from "../http/validation";
import type { WorkspaceRepository } from "../repository";
import type { WorkspaceEnv } from "../types";

export function projectRoutes(repository: WorkspaceRepository) {
  return new Hono<WorkspaceEnv>()
    .get("/projects", rejectHead, async (c) => c.json(await repository.projects(c.get("owner"))))
    .post(
      "/projects",
      boundedJsonBody,
      zValidator("json", createProjectRequestSchema, rejectInvalidRequest),
      async (c) => c.json(await repository.createProject(c.get("owner"), c.req.valid("json")), 201),
    )
    .get("/projects/:projectId", rejectHead, validateProjectParams, async (c) =>
      c.json(await repository.project(c.get("owner"), c.req.valid("param").projectId)),
    )
    .patch(
      "/projects/:projectId",
      validateProjectParams,
      boundedJsonBody,
      zValidator("json", updateProjectRequestSchema, rejectInvalidRequest),
      async (c) =>
        c.json(
          await repository.updateProject(
            c.get("owner"),
            c.req.valid("param").projectId,
            c.req.valid("json"),
          ),
        ),
    )
    .delete("/projects/:projectId", validateProjectParams, async (c) => {
      await repository.deleteProject(c.get("owner"), c.req.valid("param").projectId);
      return c.body(null, 204);
    })
    .get("/projects/:projectId/diagrams", rejectHead, validateProjectParams, async (c) =>
      c.json(await repository.diagrams(c.get("owner"), c.req.valid("param").projectId)),
    )
    .post(
      "/projects/:projectId/diagrams",
      validateProjectParams,
      boundedJsonBody,
      zValidator("json", createDiagramRequestSchema, rejectInvalidRequest),
      async (c) =>
        c.json(
          await repository.createDiagram(
            c.get("owner"),
            c.req.valid("param").projectId,
            c.req.valid("json"),
          ),
          201,
        ),
    )
    .all("/projects", methodNotAllowed)
    .all("/projects/:projectId", methodNotAllowed)
    .all("/projects/:projectId/diagrams", methodNotAllowed);
}
