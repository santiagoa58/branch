// @vitest-environment node
import { EventEmitter } from "node:events";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ZodError } from "zod";
import packageConfig from "../../package.json";
import vercelConfig from "../../vercel.json";

type DevChild = EventEmitter & { kill: (signal: NodeJS.Signals) => boolean };

const { spawn, mkdtemp, writeFile, rm } = vi.hoisted(() => ({
  spawn: vi.fn<(...args: unknown[]) => DevChild>(),
  mkdtemp: vi.fn<(prefix: string) => Promise<string>>(),
  writeFile: vi.fn<(path: string, contents: string, options: object) => Promise<void>>(),
  rm: vi.fn<(path: string, options: object) => Promise<void>>(),
}));

vi.mock("node:child_process", () => ({ spawn }));
vi.mock("node:fs/promises", () => ({ mkdtemp, writeFile, rm }));

const directory = join(tmpdir(), "branch-dev-test");
const configPath = join(directory, "vercel.json");

// Re-import the top-level runner for each scenario without executing a real child process.
const runDev = () => import("../../scripts/dev.mjs");

describe("unified development commands", () => {
  it("exposes one public dev entry that loads local env and starts the full runtime", () => {
    expect(packageConfig.scripts.dev).toBe("node --env-file=.env.local scripts/dev.mjs");
    expect(Object.keys(packageConfig.scripts).filter((name) => /^dev(?::|$)/.test(name))).toEqual([
      "dev",
    ]);
  });

  it("runs the internal frontend directly on Vercel's supplied port, never pnpm dev", () => {
    expect(vercelConfig.devCommand).toBe("pnpm exec vp dev --port $PORT");
  });
});

describe("development runtime runner", () => {
  let child: DevChild;
  let previousExitCode: typeof process.exitCode;

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    previousExitCode = process.exitCode;
    vi.stubEnv("DATABASE_URL", "postgresql://db.example/branch-test");
    vi.stubEnv("CLERK_SECRET_KEY", "test-secret");
    vi.stubEnv("VITE_CLERK_PUBLISHABLE_KEY", "test-public");
    vi.stubEnv("CLERK_AUTHORIZED_PARTIES", "http://localhost:3000, https://branch.test");
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-gateway-key");
    vi.stubEnv("AI_MODEL", "provider/default");
    vi.stubEnv("AI_MODEL_API", "provider/api");
    vi.stubEnv("BRANCH_UNRELATED_SETTING", "do-not-forward");
    child = Object.assign(new EventEmitter(), {
      kill: vi.fn<(signal: NodeJS.Signals) => boolean>().mockReturnValue(true),
    });
    mkdtemp.mockResolvedValue(directory);
    writeFile.mockResolvedValue(undefined);
    rm.mockResolvedValue(undefined);
    spawn.mockImplementation(() => {
      queueMicrotask(() => child.emit("exit", 0));
      return child;
    });
  });

  afterEach(() => {
    process.exitCode = previousExitCode;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("launches the full local Vercel runtime with a private, validated config and cleans up", async () => {
    const interruptListeners = process.listenerCount("SIGINT");
    const terminateListeners = process.listenerCount("SIGTERM");

    await runDev();

    expect(writeFile).toHaveBeenCalledWith(
      configPath,
      JSON.stringify({
        ...vercelConfig,
        env: {
          DATABASE_URL: "postgresql://db.example/branch-test",
          CLERK_SECRET_KEY: "test-secret",
          VITE_CLERK_PUBLISHABLE_KEY: "test-public",
          CLERK_AUTHORIZED_PARTIES: "http://localhost:3000,https://branch.test",
          AI_GATEWAY_API_KEY: "test-gateway-key",
          AI_MODEL: "provider/default",
          AI_MODEL_API: "provider/api",
        },
      }),
      { mode: 0o600 },
    );
    expect(spawn).toHaveBeenCalledExactlyOnceWith(
      "pnpm",
      ["dlx", "vercel@latest", "dev", "--local", "--local-config", configPath, "--listen", "3000"],
      { stdio: "inherit" },
    );
    expect(rm).toHaveBeenCalledWith(directory, { recursive: true, force: true });
    expect(process.exitCode).toBe(0);
    expect(process.listenerCount("SIGINT")).toBe(interruptListeners);
    expect(process.listenerCount("SIGTERM")).toBe(terminateListeners);
  });

  it.each([
    ["DATABASE_URL", "not-a-url"],
    ["CLERK_SECRET_KEY", undefined],
    ["VITE_CLERK_PUBLISHABLE_KEY", undefined],
    ["CLERK_AUTHORIZED_PARTIES", "not-an-origin"],
    ["AI_MODEL", undefined],
  ])("rejects invalid %s before writing settings or spawning Vercel", async (name, value) => {
    vi.stubEnv(name, value);

    await expect(runDev()).rejects.toThrow(ZodError);

    expect(mkdtemp).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(spawn).not.toHaveBeenCalled();
  });

  it.each([7, null])("propagates child exit %s and removes the temporary config", async (code) => {
    spawn.mockImplementation(() => {
      queueMicrotask(() => child.emit("exit", code));
      return child;
    });

    await runDev();

    expect(process.exitCode).toBe(code ?? 1);
    expect(rm).toHaveBeenCalledWith(directory, { recursive: true, force: true });
  });

  it("removes the temporary config if launching the runtime throws", async () => {
    const error = new Error("Unable to launch pnpm");
    spawn.mockImplementation(() => {
      throw error;
    });

    await expect(runDev()).rejects.toThrow(error);

    expect(rm).toHaveBeenCalledWith(directory, { recursive: true, force: true });
  });
});
