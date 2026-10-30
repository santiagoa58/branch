import { ApiError } from "./errors";

let getToken: (() => Promise<string | null>) | null = null;

export function setApiTokenProvider(provider: (() => Promise<string | null>) | null) {
  getToken = provider;
}

export async function getApiToken(signal?: AbortSignal | null): Promise<string> {
  signal?.throwIfAborted();
  const token = await getToken?.();
  signal?.throwIfAborted();
  if (!token) {
    throw new ApiError(401, "Sign in to access this workspace.");
  }
  return token;
}
