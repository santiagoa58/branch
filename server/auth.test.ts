// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { authenticate } from "./auth";
const { authenticateRequest, createClient } = vi.hoisted(() => ({
  authenticateRequest:
    vi.fn<
      (
        request: Request,
        options: object,
      ) => Promise<{ isAuthenticated: boolean; toAuth(): { userId: string } }>
    >(),
  createClient: vi.fn<(options: object) => object>(),
}));
vi.mock("@clerk/backend", () => ({ createClerkClient: createClient }));

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://db.example/branch");
  vi.stubEnv("CLERK_SECRET_KEY", "test-secret");
  vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "test-public");
  vi.stubEnv("CLERK_PUBLISHABLE_KEY", undefined);
  vi.stubEnv("CLERK_AUTHORIZED_PARTIES", "https://branch.test,http://localhost:3000");
  createClient.mockReturnValue({ authenticateRequest });
  authenticateRequest.mockResolvedValue({
    isAuthenticated: true,
    toAuth: () => ({ userId: "verified-owner" }),
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("Clerk session verification", () => {
  it("reports configuration failure separately from malformed API requests without exposing values", async () => {
    vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", undefined);
    await expect(authenticate(new Request("https://branch.test/api/projects"))).rejects.toThrow(
      "server configuration",
    );
  });

  it("rejects client-supplied identity without a bearer session", async () => {
    expect(
      await authenticate(
        new Request("https://branch.test/api/projects", { headers: { "x-user-id": "alice" } }),
      ),
    ).toBeNull();
    expect(authenticateRequest).not.toHaveBeenCalled();
  });
  it("uses only the verified Clerk subject and checks the origin allowlist", async () => {
    const request = new Request("https://branch.test/api/projects", {
      headers: { authorization: "Bearer signed-session", "x-user-id": "alice" },
    });
    expect(await authenticate(request)).toBe("verified-owner");
    expect(createClient).toHaveBeenCalledWith({
      secretKey: "test-secret",
      publishableKey: "test-public",
    });
    expect(authenticateRequest).toHaveBeenCalledWith(request, {
      authorizedParties: ["https://branch.test", "http://localhost:3000"],
      acceptsToken: "session_token",
    });
  });
  it("rejects invalid or expired sessions", async () => {
    authenticateRequest.mockResolvedValueOnce({
      isAuthenticated: false,
      toAuth: () => ({ userId: "unverified" }),
    });
    expect(
      await authenticate(
        new Request("https://branch.test/api/projects", {
          headers: { authorization: "Bearer invalid" },
        }),
      ),
    ).toBeNull();
  });
});
