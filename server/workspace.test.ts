// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect, vi } from "vite-plus/test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import {
  apiProjectSchema,
  apiDiagramSchema,
  apiDiagramVersionSchema,
  apiWorkspaceSchema,
} from "../src/schemas/api";
import { createHandler } from "./handler";
import { WorkspaceRepository, type Database } from "./repository";

let database: PGlite;
let handle: (request: Request) => Promise<Response>;
const query = vi.fn<Database["query"]>();
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
  query.mockImplementation(async (text, values = []) => {
    const result = await database.query(text, [...values]);
    return { rows: result.rows, rowCount: result.affectedRows };
  });
  const adapter: Database = {
    query,
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
  it("requires authentication for workspace reads before querying the database", async () => {
    query.mockClear();
    expect((await api("/workspace", "GET", undefined, "")).status).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });
  it("lists all owned projects with metadata-only diagrams in two scoped queries", async () => {
    const alice = "workspace-alice";
    const bob = "workspace-bob";
    const createProject = async (name: string, owner: string) =>
      json(
        await api("/projects", "POST", { name, description: `${name} project` }, owner),
        apiProjectSchema,
      );
    const aliceProject = await createProject("Alice design", alice);
    const aliceEmpty = await createProject("Alice empty", alice);
    const aliceOther = await createProject("Alice other", alice);
    const bobProject = await createProject("Bob design", bob);
    const createDiagram = async (projectId: string, name: string, owner: string) =>
      json(
        await api(
          `/projects/${projectId}/diagrams`,
          "POST",
          { name, description: `${name} diagram`, data: empty },
          owner,
        ),
        apiDiagramSchema,
      );
    const aliceFirst = await createDiagram(aliceProject.id, "First", alice);
    const aliceSecond = await createDiagram(aliceProject.id, "Second", alice);
    const aliceThird = await createDiagram(aliceOther.id, "Third", alice);
    const bobDiagram = await createDiagram(bobProject.id, "Private", bob);
    const aliceUpdated = await json(
      await api(
        `/diagrams/${aliceFirst.id}/thumbnail`,
        "PUT",
        {
          thumbnail: "data:image/png;base64,dGVzdA==",
          expectedRevision: aliceFirst.revision,
        },
        alice,
      ),
      apiDiagramSchema,
    );
    await json(
      await api(
        `/diagrams/${aliceFirst.id}/versions`,
        "POST",
        { expectedRevision: aliceUpdated.revision },
        alice,
      ),
      apiDiagramVersionSchema,
    );
    const aliceVersioned = await json(
      await api(`/diagrams/${aliceFirst.id}`, "GET", undefined, alice),
      apiDiagramSchema,
    );
    const summaries = [aliceVersioned, aliceSecond, aliceThird, bobDiagram].map(
      ({ data, ...summary }) => {
        expect(data).toEqual(empty);
        return summary;
      },
    );

    query.mockClear();
    const response = await api("/workspace", "GET", undefined, alice);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const workspace = await json(response, apiWorkspaceSchema);
    expect(workspace).toHaveLength(3);
    expect(workspace).toEqual(
      expect.arrayContaining([
        { ...aliceProject, diagrams: [summaries[0], summaries[1]] },
        { ...aliceEmpty, diagrams: [] },
        { ...aliceOther, diagrams: [summaries[2]] },
      ]),
    );
    expect(workspace.flatMap((project) => project.diagrams)).toHaveLength(3);
    expect(query).toHaveBeenCalledTimes(2);
    for (const [sql, values] of query.mock.calls) {
      expect(sql).toMatch(/owner_id = \$1/);
      expect(sql).not.toMatch(/\bdata\b/i);
      expect(values).toEqual([alice]);
    }

    query.mockClear();
    expect(await json(await api("/workspace", "GET", undefined, bob), apiWorkspaceSchema)).toEqual([
      { ...bobProject, diagrams: [summaries[3]] },
    ]);
    expect(query).toHaveBeenCalledTimes(2);
    for (const [, values] of query.mock.calls) {
      expect(values).toEqual([bob]);
    }
  });
  it("returns an empty workspace or empty project without per-project queries", async () => {
    const owner = "workspace-empty";
    query.mockClear();
    expect(
      await json(await api("/workspace", "GET", undefined, owner), apiWorkspaceSchema),
    ).toEqual([]);
    expect(query).toHaveBeenCalledTimes(2);
    const project = await json(
      await api("/projects", "POST", { name: "Empty" }, owner),
      apiProjectSchema,
    );
    query.mockClear();
    expect(
      await json(await api("/workspace", "GET", undefined, owner), apiWorkspaceSchema),
    ).toEqual([{ ...project, diagrams: [] }]);
    expect(query).toHaveBeenCalledTimes(2);
  });
  it.each(["POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])(
    "rejects %s /workspace without accessing or changing documents",
    async (method) => {
      query.mockClear();
      expect((await api("/workspace", method)).status).toBe(405);
      expect(query).not.toHaveBeenCalled();
    },
  );
  it("does not treat nested workspace paths as the listing endpoint", async () => {
    query.mockClear();
    expect((await api("/workspace/projects")).status).toBe(404);
    expect(query).not.toHaveBeenCalled();
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
