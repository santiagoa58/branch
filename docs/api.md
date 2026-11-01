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
| POST   | `/api/ai/:stage`                                       | stage input JSON                         | 200 stage output JSON                        |

JSON writes require `Content-Type: application/json` and are limited to 4 MB even when `Content-Length` is absent or too low. Invalid request data returns 400; unsupported media returns 415; unknown paths return 404; known paths with unsupported methods, including HEAD, return 405. Missing or foreign owned documents return 404 so existence is not disclosed. Stale revisions return 409. Stored documents failing their response schema return 500, distinct from malformed client input.

The editor save coordinator owns drafts and revision chaining. TanStack Query owns fetched project, diagram, and version server state for the signed-in account; query options live in `src/services/workspaceQuery.ts`.

## AI design

`POST /api/ai/:stage` runs one stage of the AI design pipeline. `stage` is one of `requirements`, `components`, `decisions`, `api` or `data-model`. It requires the same Clerk owner authentication as the workspace routes. The JSON body is validated by that stage's input schema in `src/schemas/aiDesign.ts` and is limited to `AI_MAX_BODY_BYTES` (64 KB). The response is the stage output JSON, validated against the stage output schema.

| Status | Meaning                                                                    |
| ------ | -------------------------------------------------------------------------- |
| 200    | Stage output                                                               |
| 400    | Invalid stage input                                                        |
| 402    | "AI budget reached": the AI Gateway budget was exceeded                    |
| 404    | Unknown stage                                                              |
| 405    | Unsupported method, including GET and HEAD                                 |
| 413    | "Request is too large."                                                    |
| 415    | Body is not JSON                                                           |
| 429    | AI Gateway rate limit; `Retry-After` is forwarded when present             |
| 502    | "The design was too large to generate" when the model output was truncated |
| 502    | "The AI service is unavailable. Please retry." for any other failure       |

### Server configuration

| Variable                                                                                                    | Notes                                                              |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `AI_GATEWAY_API_KEY`                                                                                        | Server only. Optional when Vercel OIDC authentication is available |
| `AI_MODEL`                                                                                                  | Required. Default model for every stage, as `provider/model-id`    |
| `AI_MODEL_REQUIREMENTS`, `AI_MODEL_COMPONENTS`, `AI_MODEL_DECISIONS`, `AI_MODEL_API`, `AI_MODEL_DATA_MODEL` | Optional per-stage model overrides                                 |

Every call passes the Clerk user id as the AI Gateway `user`, so per-user budgets apply. Never expose these variables to the browser.

### Vercel setup

Spend and request rate are controlled in Vercel, not in application code.

1. In the Vercel dashboard open AI Gateway, then Budgets. Set a team budget and a default per-user budget. Requests over budget return 402, which the API reports as "AI budget reached".
2. Optionally add a Vercel Firewall rate-limit rule for the path `/api/ai/*` to cap request rate. Limited requests receive 429.
3. Add `AI_MODEL` (and `AI_GATEWAY_API_KEY` unless OIDC is used) to the project environment variables for each environment.

### Prompt evaluation

`pnpm eval:ai` runs the stage prompts against the live gateway; it needs `.env.local` with the AI variables above. `pnpm eval:prompts` writes the built prompts to `.superpowers/eval-prompts/` without calling a model. Results are recorded in `server/ai/eval/RESULTS.md`.
