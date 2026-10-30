import { createClerkClient } from "@clerk/backend";
import { serverEnvSchema } from "../src/schemas/server";

export async function authenticate(request: Request): Promise<string | null> {
  const config = serverEnvSchema.safeParse(process.env);
  if (!config.success) {
    throw new Error(
      `Invalid server configuration: ${config.error.issues.map((issue) => issue.path.join(".")).join(", ")}`,
    );
  }
  const env = config.data;
  // Accept only explicit session bearer tokens; never trust a user ID sent by the client.
  if (!request.headers.get("authorization")?.startsWith("Bearer ")) {
    return null;
  }
  const clerk = createClerkClient({
    secretKey: env.CLERK_SECRET_KEY,
    publishableKey: env.VITE_CLERK_PUBLISHABLE_KEY,
  });
  const state = await clerk.authenticateRequest(request, {
    authorizedParties: env.CLERK_AUTHORIZED_PARTIES,
    acceptsToken: "session_token",
  });
  return state.isAuthenticated ? state.toAuth().userId : null;
}
