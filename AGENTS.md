# Branch — Architecture Workspace

React 19 + TypeScript diagram editor built on React Flow v12, with GSAP-powered
edge/simulation animations and Zustand state. See `README.md` for the feature tour
and `.cursor/` for deep references (`rules.md`, `features.md`, `components.mdc`,
`design-system.md`, `glossary.md`).

## Commands

```bash
pnpm dev            # Vite+ development server on :5173
pnpm audit          # Dependency vulnerability audit
pnpm check          # Strict format, lint, and type checks
pnpm test:run       # Vitest run (one-shot)
pnpm test:coverage  # Vitest run with V8 coverage
pnpm build          # TypeScript and Vite+ production build
```

## Source of truth

Node and edge/protocol types are **centralized in `src/constants/index.ts`**
(`NODE_TYPES_CONFIG`, `PROTOCOL_CONFIG`, `EDGE_STYLES`, `GROUP_TYPES_CONFIG`).
The type unions live in `src/types/index.ts` (`ArchitectureNodeType`, `EdgeProtocol`,
`GroupNodeType`). Adding a node type or protocol means updating several files in
lockstep — use the `add-node-type` skill, or follow that skill's steps manually.

## State (Zustand stores in `src/store/`)

- `diagramStore` — nodes, edges, clipboard, undo/redo. Call `saveToHistory()` before
  user-initiated changes; persist via `debouncedSave()`. Never mutate state directly.
- `simulationStore` — flow/failure/chaos state. **Ephemeral**: never persisted to
  localStorage, never in undo/redo. `setMode` resets the previous mode.
- `animationStore` — pending-deletion orchestration. Use `requestDelete()` for
  user-initiated deletes (animated shatter), **not** `diagramStore.deleteNode()`.
- `workspaceStore`, `uiStore`, `themeStore`, `aiStore`.

## Hard rules (enforced conventions — breaking these is a bug)

- **React Flow v12:** use `parentId`, NOT `parentNode`. Parent nodes MUST appear
  before child nodes in the array. Child positions are relative to the parent; convert
  absolute↔relative when adding/removing from a group. Always set `extent: 'parent'`.
- **GSAP:** import only from `src/lib/gsap.ts`, never directly from `gsap`. Use the
  `useGSAP()` hook for cleanup. Target React Flow elements via `data-node-id` /
  `data-edge-id` attributes, NOT React refs. Edge/sim animations use `MotionPathPlugin`;
  respect `simulationStore.speed` via `timeline.timeScale(speed)`. The
  `#animation-overlay` div is for shatter fragments only.
- **Graph algorithms** in `src/utils/graphTraversal.ts` (BFS path trace, blast radius,
  Union-Find partition) are pure — no side effects.
- **AI:** providers implement `AIProvider` (`src/types/ai.ts`). API keys are
  client-side only (localStorage via `aiStore`); never send keys to the backend, and
  always check for a key before making a call.
- **Validation:** all untrusted data (API requests/responses, imports, share URLs,
  AI/provider responses, and browser preferences) must cross
  a Zod schema in `src/schemas/`. Do not use handwritten structural validators or
  type assertions at trust boundaries.
- **Styling:** Tailwind v4. Use `zinc-*`, never `gray-*`. Use the `cn()` helper from
  `@/lib/utils`. Theme via CSS variables in `src/index.css` — don't hardcode colors.

## Key directories

- `components/nodes|edges|panels|ui/` — `ArchitectureNode`, GSAP-animated
  `ArchitectureEdge`, palette/properties/simulation panels.
- `hooks/` — `useSimulationAnimation`, `useChaosSimulation`, `useEdgeAnimation`,
  `useDestroyAnimation`.
- `services/api.ts` + `services/ai/providers/` — backend client and AI integrations.

## Cloud persistence and deployment

- One Vite frontend + same-repository Vercel Function in `api/`; server modules in
  `server/` must never be imported by browser code.
- Clerk supplies verified owner IDs. Every project, diagram, and version query must
  be scoped to that owner. Secrets belong only in server environment variables.
- `cloudWorkspace` owns the active document identity, revision, serialized save queue,
  load cancellation, and save status. Store edits call `saveDiagram()` to schedule a
  captured snapshot; hydrate using `hydrateDiagram()` without saving or adding edits.
- Navigation must flush pending edits or stay in the editor on failure. Never add
  localStorage document fallback. Simulation state remains ephemeral.
- Diagram PATCH, thumbnail PUT, version creation and restore require `expectedRevision`.
- Add append-only SQL migrations under `migrations/`; run `pnpm db:migrate` against
  a direct Neon connection, explicitly outside application builds.
- `pnpm dev` serves frontend only; `pnpm dev:cloud` runs Vercel frontend + API locally.
