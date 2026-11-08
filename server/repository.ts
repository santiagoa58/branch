import { randomUUID } from "node:crypto";
import {
  apiProjectSchema,
  apiProjectListSchema,
  apiWorkspaceSchema,
  apiDiagramSchema,
  apiDiagramSummaryListSchema,
  apiDiagramVersionSchema,
  apiDiagramVersionListSchema,
  apiDiagramVersionFullSchema,
  type CreateProjectRequest,
  type UpdateProjectRequest,
  type CreateDiagramRequest,
  type UpdateDiagramRequest,
  type UpdateThumbnailRequest,
  type CreateDiagramVersionRequest,
} from "../src/schemas/api";
import { HttpError } from "./http/errors";

export interface Queryable {
  query(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: unknown[]; rowCount: number | null | undefined }>;
}
export interface Database extends Queryable {
  transaction<T>(run: (client: Queryable) => Promise<T>): Promise<T>;
}
const projectColumns = `id, name, description, color, created_at::text AS "createdAt", updated_at::text AS "updatedAt"`;
const diagramColumns = `id, project_id AS "projectId", name, description, data, thumbnail, version, revision, created_at::text AS "createdAt", updated_at::text AS "updatedAt"`;
const diagramSummaryColumns = `id, project_id AS "projectId", name, description, thumbnail, version, revision, created_at::text AS "createdAt", updated_at::text AS "updatedAt"`;
const versionColumns = `id, diagram_id AS "diagramId", version_number AS "versionNumber", label, thumbnail, created_at::text AS "createdAt"`;
const ownedDiagram = `id = $1 AND project_id IN (SELECT id FROM projects WHERE owner_id = $2)`;

function first(rows: unknown[]) {
  if (!rows.length) {
    throw new HttpError(404, "Document not found.");
  }
  return rows[0];
}

export class WorkspaceRepository {
  constructor(private db: Database) {}
  async workspace(owner: string) {
    const [projects, result] = await Promise.all([
      this.projects(owner),
      this.db.query(
        `SELECT ${diagramSummaryColumns} FROM diagrams WHERE project_id IN (SELECT id FROM projects WHERE owner_id = $1) ORDER BY updated_at DESC`,
        [owner],
      ),
    ]);
    const diagrams = apiDiagramSummaryListSchema.parse(result.rows);
    const byProject = new Map<string, typeof diagrams>();
    for (const diagram of diagrams) {
      const projectDiagrams = byProject.get(diagram.projectId);
      if (projectDiagrams) {
        projectDiagrams.push(diagram);
      } else {
        byProject.set(diagram.projectId, [diagram]);
      }
    }
    return apiWorkspaceSchema.parse(
      projects.map((project) => ({ ...project, diagrams: byProject.get(project.id) ?? [] })),
    );
  }
  async projects(owner: string) {
    return apiProjectListSchema.parse(
      (
        await this.db.query(
          `SELECT ${projectColumns} FROM projects WHERE owner_id = $1 ORDER BY updated_at DESC`,
          [owner],
        )
      ).rows,
    );
  }
  async project(owner: string, id: string, client: Queryable = this.db) {
    return apiProjectSchema.parse(
      first(
        (
          await client.query(
            `SELECT ${projectColumns} FROM projects WHERE id = $1 AND owner_id = $2`,
            [id, owner],
          )
        ).rows,
      ),
    );
  }
  async createProject(owner: string, input: CreateProjectRequest) {
    return apiProjectSchema.parse(
      first(
        (
          await this.db.query(
            `INSERT INTO projects (id, owner_id, name, description, color) VALUES ($1,$2,$3,$4,$5) RETURNING ${projectColumns}`,
            [randomUUID(), owner, input.name, input.description ?? null, input.color ?? null],
          )
        ).rows,
      ),
    );
  }
  async updateProject(owner: string, id: string, input: UpdateProjectRequest) {
    return apiProjectSchema.parse(
      first(
        (
          await this.db.query(
            `UPDATE projects SET name = COALESCE($3,name), description = COALESCE($4,description), color = COALESCE($5,color), updated_at = now() WHERE id = $1 AND owner_id = $2 RETURNING ${projectColumns}`,
            [id, owner, input.name ?? null, input.description ?? null, input.color ?? null],
          )
        ).rows,
      ),
    );
  }
  async deleteProject(owner: string, id: string) {
    first(
      (
        await this.db.query("DELETE FROM projects WHERE id = $1 AND owner_id = $2 RETURNING id", [
          id,
          owner,
        ])
      ).rows,
    );
  }
  async diagrams(owner: string, projectId: string) {
    await this.project(owner, projectId);
    return apiDiagramSummaryListSchema.parse(
      (
        await this.db.query(
          `SELECT ${diagramSummaryColumns} FROM diagrams WHERE project_id = $1 AND project_id IN (SELECT id FROM projects WHERE owner_id = $2) ORDER BY updated_at DESC`,
          [projectId, owner],
        )
      ).rows,
    );
  }
  async createDiagram(owner: string, projectId: string, input: CreateDiagramRequest) {
    return apiDiagramSchema.parse(
      first(
        (
          await this.db.query(
            `INSERT INTO diagrams (id, project_id, name, description, data) SELECT $1, id, $4, $5, $6::jsonb FROM projects WHERE id = $2 AND owner_id = $3 RETURNING ${diagramColumns}`,
            [
              randomUUID(),
              projectId,
              owner,
              input.name,
              input.description ?? null,
              JSON.stringify(input.data ?? { nodes: [], edges: [], flows: [] }),
            ],
          )
        ).rows,
      ),
    );
  }
  async diagram(owner: string, id: string, client: Queryable = this.db, lock = false) {
    return apiDiagramSchema.parse(
      first(
        (
          await client.query(
            `SELECT ${diagramColumns} FROM diagrams WHERE ${ownedDiagram}${lock ? " FOR UPDATE" : ""}`,
            [id, owner],
          )
        ).rows,
      ),
    );
  }
  async updateDiagram(owner: string, id: string, input: UpdateDiagramRequest) {
    const result = await this.db.query(
      `UPDATE diagrams SET name = COALESCE($4,name), description = COALESCE($5,description), data = COALESCE($6::jsonb,data), revision = revision + 1, updated_at = now() WHERE ${ownedDiagram} AND revision = $3 RETURNING ${diagramColumns}`,
      [
        id,
        owner,
        input.expectedRevision,
        input.name ?? null,
        input.description ?? null,
        input.data === undefined ? null : JSON.stringify(input.data),
      ],
    );
    if (!result.rows.length) {
      await this.diagram(owner, id);
      throw new HttpError(409, "This diagram changed in another tab or window.");
    }
    return apiDiagramSchema.parse(first(result.rows));
  }
  async thumbnail(owner: string, id: string, input: UpdateThumbnailRequest) {
    const result = await this.db.query(
      `UPDATE diagrams SET thumbnail = $4, revision = revision + 1, updated_at = now() WHERE ${ownedDiagram} AND revision = $3 RETURNING ${diagramColumns}`,
      [id, owner, input.expectedRevision, input.thumbnail],
    );
    if (!result.rows.length) {
      await this.diagram(owner, id);
      throw new HttpError(409, "This diagram changed in another tab or window.");
    }
    return apiDiagramSchema.parse(first(result.rows));
  }
  async deleteDiagram(owner: string, id: string) {
    first(
      (await this.db.query(`DELETE FROM diagrams WHERE ${ownedDiagram} RETURNING id`, [id, owner]))
        .rows,
    );
  }
  async versions(owner: string, diagramId: string) {
    await this.diagram(owner, diagramId);
    return apiDiagramVersionListSchema.parse(
      (
        await this.db.query(
          `SELECT ${versionColumns} FROM diagram_versions WHERE diagram_id = $1 AND diagram_id IN (SELECT id FROM diagrams WHERE project_id IN (SELECT id FROM projects WHERE owner_id = $2)) ORDER BY version_number DESC`,
          [diagramId, owner],
        )
      ).rows,
    );
  }
  async version(owner: string, diagramId: string, versionId: string, client: Queryable = this.db) {
    return apiDiagramVersionFullSchema.parse(
      first(
        (
          await client.query(
            `SELECT ${versionColumns}, data FROM diagram_versions WHERE diagram_id = $1 AND id = $2 AND diagram_id IN (SELECT id FROM diagrams WHERE project_id IN (SELECT id FROM projects WHERE owner_id = $3))`,
            [diagramId, versionId, owner],
          )
        ).rows,
      ),
    );
  }
  async createVersion(owner: string, diagramId: string, input: CreateDiagramVersionRequest) {
    return this.db.transaction(async (client) => {
      const diagram = await this.diagram(owner, diagramId, client, true);
      if (diagram.revision !== input.expectedRevision) {
        throw new HttpError(409, "The saved diagram changed before the snapshot was created.");
      }
      const versionNumber = diagram.version + 1;
      await client.query(`UPDATE diagrams SET version = $3 WHERE ${ownedDiagram}`, [
        diagramId,
        owner,
        versionNumber,
      ]);
      return apiDiagramVersionSchema.parse(
        first(
          (
            await client.query(
              `INSERT INTO diagram_versions (id, diagram_id, version_number, label, data, thumbnail) VALUES ($1,$2,$3,$4,$5::jsonb,$6) RETURNING ${versionColumns}`,
              [
                randomUUID(),
                diagramId,
                versionNumber,
                input.label ?? null,
                JSON.stringify(diagram.data),
                diagram.thumbnail,
              ],
            )
          ).rows,
        ),
      );
    });
  }
  async restoreVersion(
    owner: string,
    diagramId: string,
    versionId: string,
    expectedRevision: number,
  ) {
    return this.db.transaction(async (client) => {
      const diagram = await this.diagram(owner, diagramId, client, true);
      if (diagram.revision !== expectedRevision) {
        throw new HttpError(409, "The diagram changed before the version could be restored.");
      }
      const version = await this.version(owner, diagramId, versionId, client);
      return apiDiagramSchema.parse(
        first(
          (
            await client.query(
              `UPDATE diagrams SET data = $3::jsonb, thumbnail = $4, revision = revision + 1, updated_at = now() WHERE ${ownedDiagram} RETURNING ${diagramColumns}`,
              [diagramId, owner, JSON.stringify(version.data), version.thumbnail],
            )
          ).rows,
        ),
      );
    });
  }
  async deleteVersion(owner: string, diagramId: string, versionId: string) {
    first(
      (
        await this.db.query(
          "DELETE FROM diagram_versions WHERE diagram_id = $1 AND id = $2 AND diagram_id IN (SELECT id FROM diagrams WHERE project_id IN (SELECT id FROM projects WHERE owner_id = $3)) RETURNING id",
          [diagramId, versionId, owner],
        )
      ).rows,
    );
  }
}
