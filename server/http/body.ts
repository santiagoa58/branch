import type { MiddlewareHandler } from "hono";
import { HttpError } from "../repository";
import type { WorkspaceEnv } from "../types";

export const MAX_BODY_BYTES = 4_000_000;
// Match Hono's JSON validator media types so unsupported bodies cannot become {}.
const jsonContentType =
  /^application\/([a-z0-9!#$&^_.+-]+\+)?json(;\s*[a-zA-Z0-9!#$&^_.+-]+=([^;]+))*$/i;

export const boundedJsonBody: MiddlewareHandler<WorkspaceEnv> = async (c, next) => {
  if (Number(c.req.header("content-length")) > MAX_BODY_BYTES) {
    throw new HttpError(413, "Document is too large (maximum 4 MB).");
  }
  if (!jsonContentType.test(c.req.header("content-type") ?? "")) {
    throw new HttpError(415, "Content-Type must be application/json or application/*+json.");
  }
  const reader = c.req.raw.body?.getReader();
  if (!reader) {
    throw new HttpError(400, "A JSON request body is required.");
  }
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new HttpError(413, "Document is too large (maximum 4 MB).");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  // Hono's JSON parser reads this cache, so it sees only the bounded bytes.
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, "Invalid JSON request.");
  }
  c.req.bodyCache.json = Promise.resolve(parsed);
  await next();
};
