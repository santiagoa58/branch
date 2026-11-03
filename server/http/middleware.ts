import type { MiddlewareHandler } from "hono";
import { HttpError } from "./errors";
import type { HandlerDependencies, WorkspaceEnv } from "../types";

export const privateHeaders: MiddlewareHandler<WorkspaceEnv> = async (c, next) => {
  c.header("Content-Type", "application/json");
  c.header("Cache-Control", "private, no-store");
  c.header("X-Content-Type-Options", "nosniff");
  await next();
};

export function requireOwner(
  authenticate: HandlerDependencies["authenticate"],
): MiddlewareHandler<WorkspaceEnv> {
  return async (c, next) => {
    const owner = await authenticate(c.req.raw);
    if (!owner) {
      throw new HttpError(401, "Sign in to access this workspace.");
    }
    c.set("owner", owner);
    await next();
  };
}

export function methodNotAllowed(): never {
  throw new HttpError(405, "Method not allowed.");
}

// Hono dispatches HEAD as GET, but the original method remains on the request.
export const rejectHead: MiddlewareHandler<WorkspaceEnv> = async (c, next) => {
  if (c.req.raw.method === "HEAD") {
    methodNotAllowed();
  }
  await next();
};
