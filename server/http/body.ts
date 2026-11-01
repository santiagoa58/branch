import type { MiddlewareHandler } from "hono";
import { HttpError } from "../repository";
import type { WorkspaceEnv } from "../types";

export const MAX_BODY_BYTES = 4_000_000;
// Match Hono's JSON validator media types so unsupported bodies cannot become {}.
const jsonContentType =
  /^application\/([a-z0-9!#$&^_.+-]+\+)?json(;\s*[a-zA-Z0-9!#$&^_.+-]+=([^;]+))*$/i;

export function jsonBody(
  maxBytes: number,
  tooLargeMessage = "Request is too large.",
): MiddlewareHandler<WorkspaceEnv> {
  const tooLarge = () => new HttpError(413, tooLargeMessage);
  return async (c, next) => {
    if (Number(c.req.header("content-length")) > maxBytes) {
      throw tooLarge();
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
        // oxlint-disable-next-line no-await-in-loop -- stream chunks can only be read in order
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        size += value.byteLength;
        if (size > maxBytes) {
          // oxlint-disable-next-line no-await-in-loop -- cancels the stream once, then throws out of the loop
          await reader.cancel();
          throw tooLarge();
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
}

export const boundedJsonBody = jsonBody(MAX_BODY_BYTES, "Document is too large (maximum 4 MB).");
