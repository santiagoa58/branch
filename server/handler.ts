import { z, type ZodType } from "zod";
import {
  createProjectRequestSchema,
  updateProjectRequestSchema,
  createDiagramRequestSchema,
  updateDiagramRequestSchema,
  updateThumbnailRequestSchema,
  createDiagramVersionRequestSchema,
  revisionRequestSchema,
  apiErrorBodySchema,
} from "../src/schemas/api";
import { routeIdSchema } from "../src/schemas/server";
import { HttpError, type WorkspaceRepository } from "./repository";

async function body<T>(request: Request, schema: ZodType<T>) {
  // Leave room below Vercel's 4.5 MB payload limit and bound streamed requests too.
  if (Number(request.headers.get("content-length")) > 4_000_000) {
    throw new HttpError(413, "Document is too large (maximum 4 MB).");
  }
  const reader = request.body?.getReader();
  if (!reader) {
    throw new HttpError(400, "A JSON request body is required.");
  }
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    size += value.byteLength;
    if (size > 4_000_000) {
      await reader.cancel();
      throw new HttpError(413, "Document is too large (maximum 4 MB).");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return schema.parse(parsed);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new HttpError(400, "Invalid JSON request.");
    }
    throw error;
  }
}
function response(data: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
function methodNotAllowed(): never {
  throw new HttpError(405, "Method not allowed.");
}

export function createHandler(deps: {
  authenticate(request: Request): Promise<string | null>;
  repository: WorkspaceRepository;
}) {
  return async (request: Request): Promise<Response> => {
    try {
      const owner = await deps.authenticate(request);
      if (!owner) {
        throw new HttpError(401, "Sign in to access this workspace.");
      }
      const segments = new URL(request.url).pathname
        .replace(/^\/api\/?/, "")
        .split("/")
        .filter(Boolean);
      const [resource, rawId, child, rawChildId, action] = segments;
      const method = request.method;
      const repo = deps.repository;
      if (resource === "projects" && segments.length === 1) {
        if (method === "GET") {
          return response(await repo.projects(owner));
        }
        if (method === "POST") {
          return response(
            await repo.createProject(owner, await body(request, createProjectRequestSchema)),
            201,
          );
        }
        methodNotAllowed();
      }
      if ((resource !== "projects" && resource !== "diagrams") || !rawId) {
        throw new HttpError(404, "API endpoint not found.");
      }
      const id = routeIdSchema.parse(rawId);
      if (resource === "projects") {
        if (segments.length === 2) {
          if (method === "GET") {
            return response(await repo.project(owner, id));
          }
          if (method === "PATCH") {
            return response(
              await repo.updateProject(owner, id, await body(request, updateProjectRequestSchema)),
            );
          }
          if (method === "DELETE") {
            await repo.deleteProject(owner, id);
            return response(undefined, 204);
          }
          methodNotAllowed();
        }
        if (segments.length === 3 && child === "diagrams") {
          if (method === "GET") {
            return response(await repo.diagrams(owner, id));
          }
          if (method === "POST") {
            return response(
              await repo.createDiagram(owner, id, await body(request, createDiagramRequestSchema)),
              201,
            );
          }
          methodNotAllowed();
        }
      } else {
        if (segments.length === 2) {
          if (method === "GET") {
            return response(await repo.diagram(owner, id));
          }
          if (method === "PATCH") {
            return response(
              await repo.updateDiagram(owner, id, await body(request, updateDiagramRequestSchema)),
            );
          }
          if (method === "DELETE") {
            await repo.deleteDiagram(owner, id);
            return response(undefined, 204);
          }
          methodNotAllowed();
        }
        if (segments.length === 3 && child === "thumbnail") {
          if (method === "PUT") {
            return response(
              await repo.thumbnail(owner, id, await body(request, updateThumbnailRequestSchema)),
            );
          }
          methodNotAllowed();
        }
        if (child === "versions") {
          if (segments.length === 3) {
            if (method === "GET") {
              return response(await repo.versions(owner, id));
            }
            if (method === "POST") {
              return response(
                await repo.createVersion(
                  owner,
                  id,
                  await body(request, createDiagramVersionRequestSchema),
                ),
                201,
              );
            }
            methodNotAllowed();
          }
          const versionId = routeIdSchema.parse(rawChildId);
          if (segments.length === 4) {
            if (method === "GET") {
              return response(await repo.version(owner, id, versionId));
            }
            if (method === "DELETE") {
              await repo.deleteVersion(owner, id, versionId);
              return response(undefined, 204);
            }
            methodNotAllowed();
          }
          if (segments.length === 5 && action === "restore") {
            if (method === "POST") {
              const input = await body(request, revisionRequestSchema);
              return response(
                await repo.restoreVersion(owner, id, versionId, input.expectedRevision),
              );
            }
            methodNotAllowed();
          }
        }
      }
      throw new HttpError(404, "API endpoint not found.");
    } catch (error) {
      if (error instanceof HttpError) {
        return response(apiErrorBodySchema.parse({ message: error.message }), error.status);
      }
      if (error instanceof z.ZodError) {
        return response(
          { message: "The request or stored document does not match the data contract." },
          400,
        );
      }
      console.error("Workspace API request failed", error);
      return response({ message: "The workspace service is unavailable. Please retry." }, 500);
    }
  };
}
