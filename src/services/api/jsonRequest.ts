import type { ZodType } from "zod";
import { ApiRequestValidationError } from "./errors";

export function serializeJsonRequest(
  method: string,
  path: string,
  schema: ZodType,
  data: unknown,
): { body: string; headers: { "Content-Type": string } } {
  try {
    const body = JSON.stringify(schema.parse(data));
    if (body === undefined) {
      throw new Error("The request data cannot be serialized as JSON.");
    }
    return { body, headers: { "Content-Type": "application/json" } };
  } catch (cause) {
    throw new ApiRequestValidationError(method, path, cause);
  }
}
