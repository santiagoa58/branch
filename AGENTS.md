# Branch — Architecture Workspace

React 19 + TypeScript diagram editor built on React Flow v12, with GSAP-powered
edge/simulation animations and Zustand state. See `README.md` for the feature tour.

## Commands

```bash
pnpm dev            # Complete app (Vite+ frontend + Vercel API) on :3000
pnpm audit          # Dependency vulnerability audit
pnpm check          # Strict format, lint, type checks, and knip (unused code/deps)
pnpm test:run       # Vitest run (one-shot)
pnpm test:coverage  # Vitest run with V8 coverage
pnpm build          # TypeScript and Vite+ production build
```

## Source of truth

Node and edge/protocol types are **centralized in `src/constants/index.ts`**
(`NODE_TYPES_CONFIG`, `PROTOCOL_CONFIG`, `GROUP_TYPES_CONFIG`).
The type unions live in `src/types/index.ts` (`ArchitectureNodeType`, `EdgeProtocol`,
`GroupNodeType`). Adding a node type, group type or protocol means updating, in lockstep:

1. The union in `src/types/index.ts`.
2. The Zod enum in `src/schemas/catalogEnums.ts` (`architectureNodeTypeSchema`,
   `groupNodeTypeSchema`, `edgeProtocolSchema`; `src/schemas/diagram.ts` re-exports them).
3. The config entry in `src/constants/index.ts`: `NODE_TYPES_CONFIG` via `catalogNode()`
   (style preset, label, description, Heroicon `icon`, search keywords), `GROUP_TYPES_CONFIG`,
   or `PROTOCOL_CONFIG` (label, group, colors, style, `requestResponse`, `defaultForNodes`).
4. Node types: a palette category in `src/constants/nodeCategories.ts`.
5. Protocols: no `<option>` to add. The protocol `<select>` in
   `src/components/panels/PropertiesPanel.tsx` is generated from `PROTOCOL_CONFIG`; a new
   `group` needs a label in its `PROTOCOL_GROUP_LABELS` (a typed record, so TypeScript enforces it).
6. If it applies, the role sets in `src/utils/designRules.ts` (`OUTSIDE_ACTORS`,
   `ENTRY_POINTS`, `DIRECT_PROTOCOLS`).
7. Removing or renaming a node type: map the old name in `RETIRED_NODE_TYPES`
   (`src/schemas/diagram.ts`) so saved documents still load.

`src/constants/nodeCatalog.test.ts` fails when the node union, enum, config and categories
drift. The AI components prompt (`server/ai/prompts/components.ts`) reads the enums, so it
needs no edit.

## State (Zustand stores in `src/store/`)

- `diagramStore` — nodes, edges, clipboard, undo/redo. Call `saveToHistory()` before
  user-initiated changes; persist via `saveDiagram()`. Never mutate state directly.
- `simulationStore` — flow/failure/chaos state. **Ephemeral**: never persisted to
  localStorage, never in undo/redo. `setMode` resets the previous mode.
- `animationStore` — pending-deletion orchestration. Use `requestDelete()` for
  user-initiated deletes (animated shatter), **not** `diagramStore.deleteNode()`.
- `workspaceStore`, `uiStore`, `themeStore`, `aiDesignStore` (ephemeral state of the current AI design run).

## Hard rules (enforced conventions — breaking these is a bug)

- **React Flow v12:** use `parentId`, NOT `parentNode`. Parent nodes MUST appear
  before child nodes in the array. Child positions are relative to the parent; convert
  absolute↔relative when adding/removing from a group. Always set `extent: 'parent'`.
- **GSAP:** import only from `src/lib/gsap.ts` (it registers `MotionPathPlugin`), never
  directly from `gsap`. Only `useEdgeAnimation` uses `useGSAP()`, on refs to the edge's own
  SVG elements. `useSimulationAnimation`, `useTrafficSimulation` and `useDestroyAnimation`
  run GSAP from `useEffect` and clean up manually: simulation and traffic effects kill their
  timelines and tweens, clear props and remove injected dots in the effect cleanup; shatter
  timelines remove their fragments on complete. Those hooks reach React Flow elements through
  `data-node-id` / `data-edge-id` (or React Flow's `.react-flow__edge[data-id]` wrapper), not
  React refs. Edge/sim animations use `MotionPathPlugin`; respect `simulationStore.speed`
  via `timeline.timeScale(speed)`. The `#animation-overlay` div is for shatter fragments only.
- **Graph algorithms** in `src/utils/graphTraversal.ts` (BFS path trace, blast radius,
  Union-Find partition) are pure — no side effects.
- **AI:** AI calls go through `POST /api/ai/:stage` using the server-held AI Gateway
  key; the browser never holds a provider key. Stage input/output schemas live in
  `src/schemas/aiDesign.ts`. The model proposes; code owns freshness, ids, layout and
  persistence.
- **Validation:** all untrusted data (API requests/responses, imports, share URLs,
  AI/provider responses, and browser preferences) must cross
  a Zod schema in `src/schemas/`. Do not use handwritten structural validators or
  type assertions at trust boundaries.
- **Quality gates:** lint and knip are enforced by `pnpm check`. Fix violations rather than
  disabling rules; any disable comment needs a `-- reason`, and size/complexity debt is marked
  `-- debt: <reason>` until it is refactored.
- **Styling:** Tailwind v4. Use `zinc-*`, never `gray-*`. Use the `cn()` helper from
  `@/lib/utils`. Theme via CSS variables in `src/index.css` — don't hardcode colors.

## Key directories

- `components/nodes|edges|panels|ui/` — `ArchitectureNode`, GSAP-animated
  `ArchitectureEdge`, palette/properties/simulation panels.
- `hooks/` — `useSimulationAnimation`, `useChaosSimulation`, `useEdgeAnimation`,
  `useDestroyAnimation`.
- `services/api.ts` + `services/api/` — backend client, including the AI stage calls (`services/api/ai.ts`).
- `server/ai/` — AI design stage prompts, model selection, examples and prompt evaluation.

## Cloud persistence and deployment

- One Vite frontend + same-repository Vercel Function in `api/`; server modules in
  `server/` must never be imported by browser code. Workspace HTTP routes are explicit
  Hono handlers in `server/routes/`; see `docs/api.md`. Browser calls compose the helpers
  under `src/services/api/`, and TanStack Query options live in `workspaceQuery.ts`.
  Keep draft saves in `cloudWorkspace`, not in the Query cache.
- Clerk supplies verified owner IDs. Every project, diagram, and version query must
  be scoped to that owner. Secrets belong only in server environment variables.
- `cloudWorkspace` owns the active document identity, revision, serialized save queue,
  load cancellation, and save status. Store edits call `saveDiagram()` to schedule a
  captured snapshot; hydrate using `hydrateDiagram()` without saving or adding edits.
- Navigation must flush pending edits or stay in the editor on failure. Never add
  localStorage document fallback. Simulation state remains ephemeral.
- Diagram PATCH, thumbnail PUT, version creation and restore require `expectedRevision`.
- Keep SQL schema changes under `migrations/`. Apply them explicitly through the
  Neon SQL Editor or a trusted PostgreSQL client, never during application builds.
  `001_workspace.sql` initializes an empty database; do not rerun it on existing tables.
- `pnpm dev` runs the complete app (Vite frontend + Vercel API) on port 3000. Vercel starts Vite internally; never make its `devCommand` call `pnpm dev` recursively.
