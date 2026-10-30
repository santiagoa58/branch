import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { migrationEnvSchema, migrationRowsSchema } from "../src/schemas/server.ts";

const env = migrationEnvSchema.parse(process.env);
if (new URL(env.DATABASE_URL_UNPOOLED).hostname.includes("-pooler")) {
  throw new Error("Use a direct Neon connection in DATABASE_URL_UNPOOLED for migrations.");
}
const client = new pg.Client({ connectionString: env.DATABASE_URL_UNPOOLED });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(728341920)");
  await client.query(
    "CREATE TABLE IF NOT EXISTS branch_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const applied = migrationRowsSchema.parse(
    (await client.query("SELECT name, checksum FROM branch_migrations")).rows,
  );
  const directory = new URL("../migrations/", import.meta.url);
  for (const name of (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort()) {
    const sql = await readFile(new URL(name, directory), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const previous = applied.find((migration) => migration.name === name);
    if (previous) {
      if (previous.checksum !== checksum) {
        throw new Error(`Applied migration ${name} was changed. Add a new migration instead.`);
      }
      continue;
    }
    await client.query(sql);
    await client.query("INSERT INTO branch_migrations (name, checksum) VALUES ($1,$2)", [
      name,
      checksum,
    ]);
    process.stdout.write(`Applied ${name}\n`);
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
