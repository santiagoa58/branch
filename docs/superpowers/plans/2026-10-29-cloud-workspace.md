# Cloud Workspace Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** One authenticated cloud workspace on Vite + same-repository Vercel Functions and Neon PostgreSQL.
**Architecture:** Clerk React and Backend SDKs supply verified user identity. A small fetch-style Vercel API dispatches the existing REST contract to ownership-scoped PostgreSQL queries. A cloud persistence controller serializes revision-checked saves and separates hydration from editing.
**Tech Stack:** React 19, TypeScript, Vite, Clerk, pg, @vercel/functions, Zod, PostgreSQL.
**Spec:** /Users/santiagogomez/.codex/attachments/013c0a66-fb1e-4cfc-bfb8-63d826993eae/goal-objective.md

## Global Constraints

- Preserve the editor, UI, animation, grouping, contracts, undo/redo, import/export and non-collaboration features.
- No framework migration, separate backend process, guest editing, browser document storage, collaboration, or local/server build modes.
- Validate untrusted input/output using src/schemas; scope every document query to the authenticated owner.
- Preserve existing user edits. Keep backend imports out of browser modules. Never expose secrets via VITE_*.
- External provisioning is not required for implementing and testing; document credentials/setup that remain.

## Review Focus

- Stale loads after route changes; prior document stays isolated.
- Delayed and overlapping saves; correct document ID, expected revision, and latest edits.
- Network failure or 409 conflict; preserve in-memory edits, expose retry or export/reload.
- Navigation/sign-out with pending edits; block navigation and warn before unload.
- Version create/restore; capture the saved revision, atomic ownership-checked restore.

### Task 1: Authorized API and migrations

Files: api/[...path].ts, server/{auth,db,handler,repository}.ts, migrations/001_workspace.sql, scripts/migrate.ts, src/schemas/{api,server}.ts, server/*.test.ts, package.json, vercel.json.
Interfaces: Existing projects/diagrams/versions REST paths, diagram `revision` and required `expectedRevision` for diagram writes, version create and restore. Restore returns the updated diagram.

- [x] Add failing API/ownership/concurrency tests and revision request contract tests.
- [x] Implement schema, pooled database access, Clerk verification, REST dispatch, transaction-safe version snapshots, migrations and Vercel routing.
- [x] Run focused tests and type checks.

### Task 2: Cloud persistence correctness

Files: src/store/diagramStore.ts, src/services/cloudPersistence.ts, src/services/api.ts, src/services/cloudPersistence.test.ts, src/App.tsx.
Interfaces: Store hydrates without saving; edit path schedules controller snapshot immediately with a captured diagram ID. Controller exposes loading/saving/saved/error/conflict state, flush, retry, load, restore and version capture.

- [x] Write failing deferred-response tests for stale loads, serialized saves, navigation, failure retention and conflicts.
- [x] Implement controller; remove document localStorage and URL auto-loading; retain preferences and client-side AI key settings. Remove persistent AI analysis cache (contains diagram-derived data).
- [x] Run focused persistence/store tests.

### Task 3: Auth UI and collaboration removal

Files: src/main.tsx, src/components/CloudAuth.tsx, src/components/{Navbar,DiagramEditor}.tsx, src/components/panels/VersionsPanel.tsx, src/pages/{ProjectsPage,ProjectPage}.tsx, src/utils/export.ts and affected tests; collaboration-only files removed.

- [x] Add Clerk provider, protected workspace routes, account controls, save state/retry and navigation guard.
- [x] Use controller for versions; remove collaboration UI/dependencies/schemas/tests and runtime branching.
- [x] Copy private document URLs without embedded snapshots; retain explicit import/export and local laser pointer.
- [x] Run UI/schema/export tests.

### Task 4: Documentation and final verification

Files: README.md, .env.example, AGENTS.md, deployment config; remove obsolete Docker/nginx files.

- [x] Document Neon, Clerk and Vercel setup, development commands, migration safety, previews, conflicts and legacy data import.
- [x] Run pnpm check, pnpm test:run and pnpm build; inspect production routing and browser/server bundle separation.
- [x] Obtain fresh review and address important findings with regression tests.

## Progress / rulings

- Plan presented; user explicitly requests implementation after planning and only blocking questions, so no separate design approval gate.
- Existing four UI edits preserved in place; use a new branch in current checkout rather than copying an incomplete working tree.
- Clerk chosen for maintained React sign-in UI and server token verification; pg pooled connections + attachDatabasePool follow current Vercel/Neon guidance. No ORM needed for three tables.

- Task 1 complete: real SQL migration applied in PGlite API tests; ownership tested for every endpoint, revisions and atomic version restore covered. No external DB touched.
- Task 2 complete: stale-load, serialized-save, failure, retry, conflict, navigation, restore reset and lock tests pass. Hydration adds a baseline only and never saves; simulation stays ephemeral.
- Task 3 complete: Clerk gate and account controls; private links; collaboration and mode split removed. Auth expiry retains dirty memory for the same owner; new accounts clear document/clipboard and derived analysis state.
- Final review: fresh read-only reviewer found keyboard mutations during version lock, cross-account clipboard retention and potential repeated navigation retries. Fixed in one pass with focused regression coverage; all 292 tests and strict checks pass.
- Ruling: wait for animated deletion requests before navigation/sign-out/version actions; delayed callbacks also check document identity. This prevents pending editor actions from crossing document boundaries.
- Ruling: explicit SPA route-prefix rewrites replace a universal fallback. Real local Vercel testing demonstrated the universal rule rewrote Vite module requests into HTML. Supported deep links, JS module requests and API JSON errors verified with the real local runtime.
- Vercel local development uses `--local` and explicit `pnpm dev --port $PORT`, so no linked cloud project is required. Placeholder server settings were used only for local unauthenticated routing checks.
- Remaining external validation: configure Clerk/Neon, run the migration against an isolated branch, deploy to Vercel, then perform the documented two-account smoke test. These need actual account configuration; no resources were provisioned and no deployment was made.

- Dependency audit: keep Vercel CLI as an on-demand tool (`pnpm dlx vercel@latest`) rather than an app development dependency. Runtime @vercel/functions requires a compatible Zod 4 security patch through a scoped pnpm override. Original package-manager release-age settings are preserved.

Final validation: pnpm check passed; 292 tests in 22 files passed; pnpm build passed (large editor chunk advisory); pnpm audit reports no known vulnerabilities; git diff --check passed; server-only DB/auth identifiers absent from browser JS. Real Vercel local requests verified supported SPA deep links (200 HTML), Vite modules (200 JS), and private API access (401 JSON). No live authenticated external smoke test was possible without configured credentials.
