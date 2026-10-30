import { voidResponseSchema } from "@/schemas/api";
import { ApiResponseValidationError } from "./errors";

export async function readEmptyResponse(
  method: string,
  path: string,
  response: Response,
): Promise<void> {
  if (response.status !== 204) {
    throw new ApiResponseValidationError(method, path, new Error("Expected HTTP 204 No Content."));
  }
  const text = await response.text();
  const result = voidResponseSchema.safeParse(text === "" ? undefined : text);
  if (!result.success) {
    throw new ApiResponseValidationError(method, path, result.error);
  }
}
