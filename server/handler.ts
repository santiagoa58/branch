import { Hono } from "hono";
import { handleError, notFound } from "./http/errors";
import { privateHeaders, requireOwner } from "./http/middleware";
import { workspaceRoutes } from "./routes/workspace";
import { projectRoutes } from "./routes/projects";
import { diagramRoutes } from "./routes/diagrams";
import { versionRoutes } from "./routes/versions";
import { aiRoutes } from "./routes/ai";
import type { HandlerDependencies, WorkspaceEnv } from "./types";

export function createHandler(deps: HandlerDependencies) {
  const app = new Hono<WorkspaceEnv>();
  app.use(
    "*",
    privateHeaders,
    requireOwner((request) => deps.authenticate(request)),
  );
  app.onError(handleError);
  app.notFound(notFound);
  app.route("/api", workspaceRoutes(deps.repository));
  app.route("/api", projectRoutes(deps.repository));
  app.route("/api", diagramRoutes(deps.repository));
  app.route("/api", versionRoutes(deps.repository));
  app.route("/api", aiRoutes(deps.ai));
  return async (request: Request): Promise<Response> => app.fetch(request);
}
