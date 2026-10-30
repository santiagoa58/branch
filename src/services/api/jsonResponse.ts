import type { ZodType } from "zod";
import { ApiResponseValidationError } from "./errors";

export function parseJsonText(text: string): unknown {
  return text.trim() === "" ? undefined : JSON.parse(text);
}

export async function readJsonResponse<T>(
  method: string,
  path: string,
  response: Response,
  schema: ZodType<T>,
): Promise<T> {
  const text = await response.text();
  try {
    return schema.parse(parseJsonText(text));
  } catch (cause) {
    throw new ApiResponseValidationError(method, path, cause);
  }
}
