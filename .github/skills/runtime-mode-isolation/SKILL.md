---
name: runtime-mode-isolation
description: "Maintain one codebase that supports local-only (client) and server-backed collaboration modes without branch drift. Use when adding routes, persistence, API calls, or real-time features."
---

# Runtime Mode Isolation

Use this skill when the app must run in two modes:

- `local`: client-only, localStorage-first, no required backend
- `server`: API-backed workspace + collaboration

## Environment Contract

- `VITE_APP_MODE=local|server`
- `VITE_API_URL=http://localhost:3000/api` (used in server mode)
- `VITE_ENABLE_COLLAB=true|false` (effective only in server mode)

## Rules

1. Put all mode logic in `src/config/runtime.ts`.
2. UI components should not branch heavily by mode; branch at routing/data boundaries.
3. Guard backend writes/reads behind `IS_SERVER_MODE`.
4. Guard socket setup behind `ENABLE_COLLAB`.
5. Keep local fallback persistence (`localStorage`) active in both modes where safe.
6. Prefer adapter boundaries over duplicated pages/components.

## Integration Checklist

- Routes:
  - local mode should open editor directly.
  - server mode should expose project/diagram workspace routes.
- Store persistence:
  - always save local copy
  - only call API when `IS_SERVER_MODE` and `diagramId` exist
- Collaboration:
  - no socket connection when `ENABLE_COLLAB` is false
- Query pages:
  - avoid rendering API-only pages in local mode

## Verification

1. Run type-check and tests.
2. In local mode, start app with backend off and ensure editor still loads/saves.
3. In server mode, verify projects/diagrams CRUD and collaboration connection.
4. Switch between diagrams and confirm no cross-diagram contamination.
