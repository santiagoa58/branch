import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { devAiEnvSchema, serverEnvSchema } from "../src/schemas/server.ts";
import config from "../vercel.json" with { type: "json" };

// Vercel's unlinked local runtime isolates function workers from the parent env.
// Pass only the required settings, plus whichever AI settings are set, through a private,
// short-lived local config.
const settings = serverEnvSchema.parse(process.env);
const env = {
  ...settings,
  CLERK_AUTHORIZED_PARTIES: settings.CLERK_AUTHORIZED_PARTIES.join(","),
  ...devAiEnvSchema.parse(process.env),
};
const directory = await mkdtemp(join(tmpdir(), "branch-vercel-"));
const path = join(directory, "vercel.json");
try {
  await writeFile(path, JSON.stringify({ ...config, env }), { mode: 0o600 });
  const child = spawn(
    "pnpm",
    ["dlx", "vercel@latest", "dev", "--local", "--local-config", path, "--listen", "3000"],
    { stdio: "inherit" },
  );
  const interrupt = () => child.kill("SIGINT");
  const terminate = () => child.kill("SIGTERM");
  process.on("SIGINT", interrupt);
  process.on("SIGTERM", terminate);
  process.exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  process.off("SIGINT", interrupt);
  process.off("SIGTERM", terminate);
} finally {
  await rm(directory, { recursive: true, force: true });
}
