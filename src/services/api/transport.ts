import { apiErrorBodySchema } from "@/schemas/api";
import { getApiToken } from "./auth";
import { ApiError } from "./errors";
import { parseJsonText } from "./jsonResponse";

export async function sendApiRequest(
  method: string,
  path: string,
  init?: Omit<RequestInit, "method">,
): Promise<Response> {
  const token = await getApiToken(init?.signal);
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`/api${path}`, { ...init, method, headers });
  if (response.ok) {
    return response;
  }

  const failed = (detail: string, cause?: unknown) =>
    new ApiError(
      response.status,
      `${method} ${path} failed (${response.status} ${response.statusText}): ${detail}`,
      cause,
      detail,
    );

  const text = await response.text();
  let errorData: unknown;
  try {
    errorData = parseJsonText(text);
  } catch (cause) {
    throw failed("the backend returned malformed JSON.", cause);
  }

  const errorBody = apiErrorBodySchema.safeParse(errorData);
  if (!errorBody.success) {
    throw failed("the backend returned an invalid error body.", errorBody.error);
  }
  throw failed(errorBody.data.message);
}
