# Workspace API

The browser talks only to same-origin `/api`. Clerk supplies a session bearer token; every query is scoped to the verified owner. Resource routes are explicit in `server/routes/`, mounted by `server/handler.ts`. Zod schemas in `src/schemas/api.ts` and `src/schemas/server.ts` are the request and response contract.

| Method | Path                                                   | Request                                  | Success                                      |
| ------ | ------------------------------------------------------ | ---------------------------------------- | -------------------------------------------- |
| GET    | `/api/workspace`                                       | none                                     | 200 workspace projects and diagram summaries |
| GET    | `/api/projects`                                        | none                                     | 200 project list                             |
| POST   | `/api/projects`                                        | project name, optional description/color | 201 project                                  |
| GET    | `/api/projects/:projectId`                             | UUID                                     | 200 project                                  |
| PATCH  | `/api/projects/:projectId`                             | optional name/description/color          | 200 project                                  |
| DELETE | `/api/projects/:projectId`                             | UUID                                     | 204                                          |
| GET    | `/api/projects/:projectId/diagrams`                    | UUID                                     | 200 diagram summaries                        |
| POST   | `/api/projects/:projectId/diagrams`                    | name, optional description/data          | 201 full diagram                             |
| GET    | `/api/diagrams/:diagramId`                             | UUID                                     | 200 full diagram                             |
| PATCH  | `/api/diagrams/:diagramId`                             | expected revision, optional fields       | 200 full diagram                             |
| DELETE | `/api/diagrams/:diagramId`                             | UUID                                     | 204                                          |
| PUT    | `/api/diagrams/:diagramId/thumbnail`                   | thumbnail and expected revision          | 200 full diagram                             |
| GET    | `/api/diagrams/:diagramId/versions`                    | UUID                                     | 200 version summaries                        |
| POST   | `/api/diagrams/:diagramId/versions`                    | expected revision, optional label        | 201 version                                  |
| GET    | `/api/diagrams/:diagramId/versions/:versionId`         | UUIDs                                    | 200 version and data                         |
| DELETE | `/api/diagrams/:diagramId/versions/:versionId`         | UUIDs                                    | 204                                          |
| POST   | `/api/diagrams/:diagramId/versions/:versionId/restore` | expected revision                        | 200 restored diagram                         |

JSON writes require `Content-Type: application/json` and are limited to 4 MB even when `Content-Length` is absent or too low. Invalid request data returns 400; unsupported media returns 415; unknown paths return 404; known paths with unsupported methods, including HEAD, return 405. Missing or foreign owned documents return 404 so existence is not disclosed. Stale revisions return 409. Stored documents failing their response schema return 500, distinct from malformed client input.

The editor save coordinator owns drafts and revision chaining. TanStack Query owns fetched project, diagram, and version server state for the signed-in account; query options live in `src/services/workspaceQuery.ts`.
