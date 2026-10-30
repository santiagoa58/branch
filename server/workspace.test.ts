// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect } from "vite-plus/test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { apiProjectSchema, apiDiagramSchema, apiDiagramVersionSchema } from "../src/schemas/api";
import { createHandler } from "./handler";
import { WorkspaceRepository, type Database } from "./repository";

let database: PGlite;
let handle: (request: Request) => Promise<Response>;
const empty = { nodes: [], edges: [], flows: [] };
async function api(path: string, method = "GET", body?: object, user = "alice") {
  return handle(
    new Request(`https://branch.test/api${path}`, {
      method,
      headers: { "x-test-user": user, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  );
}
async function json<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  const value: unknown = await response.json();
  return schema.parse(value);
}

beforeAll(async () => {
  database = new PGlite();
  await database.exec(
    await readFile(new URL("../migrations/001_workspace.sql", import.meta.url), "utf8"),
  );
  const adapter: Database = {
    query: async (text, values = []) => {
      const result = await database.query(text, [...values]);
      return { rows: result.rows, rowCount: result.affectedRows };
    },
    transaction: async (run) =>
      database.transaction(async (tx) =>
        run({
          query: async (text, values = []) => {
            const result = await tx.query(text, [...values]);
            return { rows: result.rows, rowCount: result.affectedRows };
          },
        }),
      ),
  };
  handle = createHandler({
    authenticate: async (request) => request.headers.get("x-test-user") || null,
    repository: new WorkspaceRepository(adapter),
  });
}, 30000);
afterAll(async () => database?.close());

describe("authenticated cloud API", () => {
  it("rejects unauthenticated requests before accessing documents", async () => {
    expect((await api("/projects", "GET", undefined, "")).status).toBe(401);
  });
  it("validates untrusted input and returns JSON errors", async () => {
    expect((await api("/projects", "POST", { name: "" })).status).toBe(400);
    expect((await api("/missing")).status).toBe(404);
    expect((await api("/projects", "PUT", {})).status).toBe(405);
  });
  it("scopes projects, diagrams and every version operation to the owner", async () => {
    const project = await json(
      await api("/projects", "POST", { name: "Private" }),
      apiProjectSchema,
    );
    const diagram = await json(
      await api(`/projects/${project.id}/diagrams`, "POST", { name: "Design", data: empty }),
      apiDiagramSchema,
    );
    const version = await json(
      await api(`/diagrams/${diagram.id}/versions`, "POST", {
        expectedRevision: diagram.revision,
        label: "Initial",
      }),
      apiDiagramVersionSchema,
    );
    expect(
      await json(await api("/projects", "GET", undefined, "bob"), z.array(apiProjectSchema)),
    ).toEqual([]);
    const routes: [string, string, object?][] = [
      [`/projects/${project.id}`, "GET"],
      [`/projects/${project.id}`, "PATCH", { name: "Stolen" }],
      [`/projects/${project.id}`, "DELETE"],
      [`/projects/${project.id}/diagrams`, "GET"],
      [`/projects/${project.id}/diagrams`, "POST", { name: "Intruder" }],
      [`/diagrams/${diagram.id}`, "GET"],
      [`/diagrams/${diagram.id}`, "PATCH", { data: empty, expectedRevision: 1 }],
      [`/diagrams/${diagram.id}`, "DELETE"],
      [`/diagrams/${diagram.id}/thumbnail`, "PUT", { thumbnail: "test", expectedRevision: 1 }],
      [`/diagrams/${diagram.id}/versions`, "GET"],
      [`/diagrams/${diagram.id}/versions`, "POST", { expectedRevision: 1 }],
      [`/diagrams/${diagram.id}/versions/${version.id}`, "GET"],
      [`/diagrams/${diagram.id}/versions/${version.id}`, "DELETE"],
      [`/diagrams/${diagram.id}/versions/${version.id}/restore`, "POST", { expectedRevision: 1 }],
    ];
    for (const [path, method, body] of routes) {
      expect((await api(path, method, body, "bob")).status, `${method} ${path}`).toBe(404);
    }
    expect((await api(`/diagrams/${diagram.id}`)).status).toBe(200);
  });
  it("rejects stale writes and restores snapshots atomically with a new revision", async () => {
    const project = await json(
      await api("/projects", "POST", { name: "Versions" }),
      apiProjectSchema,
    );
    const diagram = await json(
      await api(`/projects/${project.id}/diagrams`, "POST", { name: "A", data: empty }),
      apiDiagramSchema,
    );
    const path = `/diagrams/${diagram.id}`;
    expect((await api(path, "PATCH", { data: empty })).status).toBe(400);
    const v1 = await json(
      await api(`${path}/versions`, "POST", { expectedRevision: 1 }),
      apiDiagramVersionSchema,
    );
    const updated = await json(
      await api(path, "PATCH", { name: "B", expectedRevision: 1 }),
      apiDiagramSchema,
    );
    expect(updated.revision).toBe(2);
    expect((await api(path, "PATCH", { name: "Lost update", expectedRevision: 1 })).status).toBe(
      409,
    );
    expect((await api(`${path}/versions`, "POST", { expectedRevision: 1 })).status).toBe(409);
    expect(
      (await api(`${path}/versions/${v1.id}/restore`, "POST", { expectedRevision: 1 })).status,
    ).toBe(409);
    const restored = await json(
      await api(`${path}/versions/${v1.id}/restore`, "POST", { expectedRevision: 2 }),
      apiDiagramSchema,
    );
    expect(restored.revision).toBe(3);
    expect(restored.data).toEqual(empty);
    const v2 = await json(
      await api(`${path}/versions`, "POST", { expectedRevision: 3 }),
      apiDiagramVersionSchema,
    );
    expect(v2.versionNumber).toBeGreaterThan(v1.versionNumber);
    expect((await api(`${path}/versions/${v1.id}`, "DELETE")).status).toBe(204);
    expect((await api(`/projects/${project.id}`, "DELETE")).status).toBe(204);
    expect((await api(path)).status).toBe(404);
  });
});
