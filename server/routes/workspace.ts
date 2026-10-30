import { Hono } from "hono";
import { methodNotAllowed, rejectHead } from "../http/middleware";
import type { WorkspaceRepository } from "../repository";
import type { WorkspaceEnv } from "../types";

export function workspaceRoutes(repository: WorkspaceRepository) {
  return new Hono<WorkspaceEnv>()
    .get("/workspace", rejectHead, async (c) => c.json(await repository.workspace(c.get("owner"))))
    .all("/workspace", methodNotAllowed);
}
