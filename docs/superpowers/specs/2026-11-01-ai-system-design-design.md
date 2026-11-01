# AI system design — design spec

Status: draft for review · Date: 2026-11-01

## 1. Goal

Let a user ask an AI to design a system the way a strong candidate would in a system design
interview, then iterate on it. At any time, without clicking individual nodes, the user can see:

- the requirements being designed for (functional, non-functional, constraints)
- the assumptions made, and what is explicitly out of scope
- the reasoning and tradeoffs behind every component
- the API of the system (endpoint catalog), and on demand its data model

Changing any input (answering a question, rejecting an assumption, enabling a "revisit when"
condition, editing the graph) updates the design. User-friendliness and correctness come first;
speed second.

### Non-goals (this iteration)

- Chat-style conversation with the AI.
- Field-level patches or AI-decided diffs.
- Pinning components against regeneration (revisit only if regeneration churn is a real problem).
- Markdown export of the brief (JSON export/import carries it automatically).
- Seeding a brief from starter templates.

## 2. Decisions locked in during brainstorming

| Topic | Decision |
| --- | --- |
| Existing AI code | Removed entirely (browser OpenAI provider, `aiStore`, AI settings panel, analysis/suggestion/chat types and schemas, `openai` dependency). |
| Provider | Vercel AI SDK (`ai@7`) through the Vercel AI Gateway, called only from our backend. |
| Credentials | Server-held `AI_GATEWAY_API_KEY` (or Vercel OIDC in deployments). No key UI. Signed-in users only. Spend is capped by AI Gateway budgets (team and per user) and request rate by a Vercel Firewall rule — infrastructure configuration, not application code. |
| Output target | The current diagram. Regenerating the graph saves a version first and is one undo step. |
| API view | Endpoint catalog (plus async events). Data model is generated only on demand; schema supports it. |
| Architecture | Staged pipeline mirroring the interview. Each stage regenerates its whole (small) output from its inputs. Code — never the AI — decides what is stale, what re-runs, ids, references, layout and persistence. |
| Open questions | No partial designs while questions are open. User answers, or chooses "Assume for me", which turns every unanswered question into a visible assumption. |
| Provenance | No `source` locking. Requirements are a user-owned document; a `basis` field records whether an item was stated, answered or assumed, for display only. |

## 3. The pipeline

```
 prompt + scope + criteria
          │
   ┌──────▼───────┐   questions? ──► user answers / "Assume for me" (deterministic)
   │ 1 Requirements│
   └──────┬───────┘
          │ enabled requirements
   ┌──────▼───────┐
   │ 2 Components  │  graph: groups, components, connections, summary, main flow
   └──┬────────┬──┘
      │        │   (run concurrently)
 ┌────▼───┐ ┌──▼─────┐
 │3 Decis-│ │ 4 API  │
 │  ions  │ │        │
 └────────┘ └────────┘
                         5 Data model — only when the user asks
```

| Stage | Input | AI output (structured) | Re-runs when |
| --- | --- | --- | --- |
| 1 Requirements | prompt, scope, criteria the user typed, current requirements (as settled) | questions (with options when applicable, and a recommended answer), plus new requirements, assumptions, out-of-scope | Prompt or scope changes, or the user presses "Re-check requirements". Editing requirements never re-runs it. |
| 2 Components | prompt, scope, enabled requirements, previous graph keys | groups, components, connections, summary, main flow entry | Marked out of date by a prompt, scope or requirement edit, or by a stage 1 re-run that added requirements |
| 3 Decisions | enabled requirements, summary, one component and its neighbours | choice, reason, gains, costs, alternatives, revisit-when | The component has no decision (new key, or its type changed), the user edited that node by hand, or the user asks per node |
| 4 API | enabled requirements, graph | endpoints, events | Marked out of date by a stage 2 run or a hand edit to the graph |
| 5 Data model | enabled requirements, graph, endpoints | entities | Only on explicit request |

Stage 3 runs one request per component, concurrently. The concurrency level, and whether to batch
several components per call instead, are decided from measurements in the prompt trials; the
interface does not change.

Stage 1 is **additive**: it receives the current requirements as settled and returns only new
questions, requirements, assumptions and out-of-scope items. Code appends them; nothing the user
has is removed or rewritten by a re-run.

### 3.1 What is deterministic (our code)

- **Staleness: dependency-ordered dirty flags.** The brief records which stages are out of date.
  Code sets the flags from what the user did, never by comparing AI output:
  1. Editing the prompt, scope or requirements marks stage 2 out of date.
  2. Running a stage marks every stage downstream of it out of date.
  3. A hand edit to the graph marks stage 4 out of date, and stage 3 for the nodes touched.
  4. After stage 2 runs, a component with the **same key and same type** keeps its decision;
     rewording a label or responsibility does not count as a change. Components that are new or
     changed type get decisions. Identity, not content, decides reuse, so wording drift in AI output
     never causes needless regeneration.

  "New design", "continue an unfinished design" and "apply my change" are one operation: run the
  first out-of-date stage, then everything it marks. Because the flags live in the persisted brief,
  undo, versions and reload restore them for free. Known, accepted cost: changing a requirement and
  then manually changing it back still shows the design as out of date until the user updates.
- A component's `responsibility` is stored as the node `description`; `previousKeys` is passed to
  stage 2 as a hint so unchanged components keep their keys.
- **Answers → requirements.** Each question has a short `topic`. Answering produces a requirement
  `"<topic>: <answer>"` with `basis: "answered"`. "Assume for me" picks each unanswered question's
  recommended answer and produces a requirement with `basis: "assumed"`. No AI call.
- **Requirement edits.** Add, edit, enable/disable, confirm an assumption (`basis` → `stated`),
  bring an out-of-scope item into scope, require a "revisit when" condition. All plain document edits.
- **Ids.** Stage 2 returns slug `key`s so connections can reference components. Code validates them
  (slug format, unique, references resolve) and uses them as node ids. Previous keys are passed back
  so unchanged components usually keep their ids; if the model renames one, the only cost is an extra
  decision call for it.
- **Reference cleanup.** Dangling connections, unknown groups, group cycles, endpoints for unknown
  services are dropped and reported in a warning summary. The stage fails only if the result is
  unusable (for example, zero components).
- **Mapping to the diagram.** Components → architecture nodes, groups → group nodes (parents before
  children, `extent: 'parent'`), connections → edges, decisions → `data.decision`, endpoints →
  request/response contracts on the matching edge (`calledBy` → `service`), main flow → a saved
  named flow. Then the existing auto-layout.
- **Persistence, versions, undo** through the existing stores and `cloudWorkspace`.

### 3.2 What is the AI's job

Only judgment: which questions matter, what to assume, which components and connections satisfy the
requirements, why each was chosen and at what cost, and what the API looks like.

## 4. Stage contracts

All schemas live in `src/schemas/aiDesign.ts` (shared by server and client, per the Zod rule). Types
are inferred from them. Enums reuse the catalog sources of truth (`NODE_TYPES_CONFIG`,
`GROUP_TYPES_CONFIG`, `PROTOCOL_CONFIG`).

**Limits policy.** A schema enforces only invariants our code or the feature's purpose depends on;
each one below states its reason. Stylistic guidance (length, how many items) lives in the prompts
and is never validated. Size guards (body size, concurrency) are configuration set from measurement;
spend and request-rate controls live in Vercel (Section 6), not constants chosen up front.

### Request envelope (every stage)

```ts
{ stage: "requirements" | "components" | "decisions" | "api" | "data-model", input: <stage input> }
```

### Stage 1 — requirements

```ts
input:  { prompt: string; scope: Scope; criteria: { functional: string[]; nonFunctional: string[]; constraints: string[] };
          settled: Requirement[] }
output: {
  questions: { id: string; topic: string; question: string; why: string;
               options: { label: string; impact: string }[];   // empty = free-text answer; otherwise ≥2 (one option is not a choice)
               recommended: string;                             // required: lets "Assume for me" answer without an AI call
               allowsCustom: boolean }[];
  functional:    { text: string }[];
  nonFunctional: { text: string; category: "scale" | "latency" | "availability" | "consistency" | "durability" | "security" | "cost" | "other" }[];
  constraints:   { text: string }[];
  assumptions:   { text: string; kind: RequirementKind }[];
  outOfScope:    { text: string }[];
}
```

`Scope` = `"frontend" | "backend" | "fullstack"`:

- `frontend`: client-side architecture in detail; the backend is one `external` or `service` box.
- `backend`: services, data and infrastructure in detail; clients are one box per client kind.
- `fullstack`: both in detail.

Asking rule (prompt guidance, not validated): ask only when the answer changes which components
exist or a major technology choice; anything smaller is assumed and listed. No fixed question count.

### Stage 2 — components

```ts
input:  { prompt; scope; requirements: Requirement[] /* enabled only */; previousKeys: string[] }
output: {
  summary: string;
  groups:      { key: string; type: GroupNodeType; label: string; parent?: string }[];
  components:  { key: string; type: ArchitectureNodeType; label: string; responsibility: string; group?: string }[];
  connections: { from: string; to: string; protocol: EdgeProtocol; purpose: string; async: boolean }[];
  mainFlow:    { name: string; entry: string };
}
```

### Stage 3 — decisions

```ts
input:  { requirements; summary; component: Component; neighbours: { key; type; label; protocol; direction: "in" | "out" }[] }
output: {
  choice: string; reason: string;
  gains: string[];                                   // ≥1: a decision with no gain or no cost is not a tradeoff
  costs: string[];                                   // ≥1
  considered: { option: string; whyNot: string }[];  // ≥1: reasoning needs an alternative
  revisitWhen: { condition: string; kind: RequirementKind }[];
}
```

Prompt guidance: short phrases, most significant items only. Maps onto the existing `DesignDecision` (`gains` → `benefits`, `costs` → `drawbacks`,
`revisitWhen[].condition` → `revisitWhen`). Groups get decisions too, like templates.

### Stage 4 — API

```ts
input:  { requirements; summary; graph: { components; connections } }
output: {
  endpoints: { key: string; service: string; calledBy: string[];
               method: HttpMethod; path: string; summary: string;
               auth: "none" | "user" | "service" | "admin";
               style: "request" | "stream" | "realtime";
               request?: Record<string, string>; response?: Record<string, string>;   // compact field maps
               errors: { status: number; when: string }[] }[];
  events:    { name: string; producer: string; consumers: string[]; payload: Record<string, string> }[];
}
```

### Stage 5 — data model (on demand)

```ts
output: { entities: { name: string; store: string;
                      fields: { name: string; type: string; key?: "primary" | "foreign" | "index" }[];
                      relations: { to: string; kind: "one-to-one" | "one-to-many" | "many-to-many" }[] }[] }
```

## 5. Persisted document: `DiagramData.brief`

An optional field validated by `diagramStructureSchema`, so it saves, versions, undoes, exports and
imports with the diagram. Diagrams without a brief are unchanged.

```ts
interface DesignBrief {
  prompt: string;
  scope: Scope;
  questions: (Question & { answer?: string })[];
  requirements: { id: string; kind: RequirementKind; text: string;
                  basis: "stated" | "answered" | "assumed"; enabled: boolean;
                  category?: NfrCategory }[];
  outOfScope: { id: string; text: string }[];
  summary?: string;
  api?: { endpoints: Endpoint[]; events: ApiEvent[] };
  dataModel?: { entities: Entity[] };
  outdated: { components: boolean; api: boolean; dataModel: boolean;
              decisions: string[] /* node ids */ };
  graphEditedByHand: boolean;   // set by hand edits, cleared when stage 2 applies; drives the replace warning
}
```

`RequirementKind` = `"functional" | "nonFunctional" | "constraint"`.

The graph itself is the diagram; it is not duplicated in the brief.

## 6. Server

- `server/ai/models.ts` — model id per stage from env (`AI_MODEL`, optional `AI_MODEL_<STAGE>`),
  default to a fast gateway model chosen during prompt trials.
- `server/ai/stages/<stage>.ts` — builds system and user prompts, calls
  `generateText({ model, system, prompt, output: Output.object({ schema }) })`, low temperature.
  On schema failure, one retry that includes the validation error; a second failure is surfaced
  rather than retried again. Returns the parsed output.
- `server/ai/examples/` — one compact worked example derived from a starter template, used as a
  few-shot example in the stage 2/3/4 prompts. A test asserts it still matches the template it was
  taken from, so the two cannot drift.
- `server/routes/ai.ts` — `POST /api/ai/:stage`. Behind existing `requireOwner`; a body limit set from the largest measured
  legitimate stage input with headroom (measured in the prompt trials);
  request validated with the stage input schema; returns JSON. 400/413/415 as for other routes.
  Gateway budget exceeded (402) returns 402 "AI budget reached"; gateway rate limit (429) returns 429
  with `Retry-After` when provided; other gateway failures return 502 with a safe message; truncated
  output (finish reason `length`) returns 502 with "the design was too large".
- Spend and rate controls are configured in Vercel, not coded:
  - AI Gateway **budgets**: a team budget and a default per-user budget. Each request passes the
    Clerk owner id as the gateway user so per-user budgets apply (exact option confirmed during
    implementation).
  - Optionally, a Vercel Firewall rate-limit rule on `/api/ai/*`.
  - `docs/api.md` documents the setup.
- `serverEnvSchema` gains `AI_GATEWAY_API_KEY` (optional when OIDC is present) and `AI_MODEL`.
  `vercel.json` sets the function `maxDuration` to cover the slowest stage.
- Responses are not streamed. Each stage is small; progress is shown stage by stage and decisions
  fill in as they complete, which gives the incremental feel streaming was meant to provide while
  keeping whole-object validation. Revisit streaming for stage 2 only if measured latency calls for it.

## 7. Client

- `src/services/api/ai.ts` — one helper per stage, composed from the existing transport helpers;
  responses validated with the stage output schemas.
- `src/utils/aiDesign/` (pure, unit-tested):
  - `staleness.ts` — dirty-flag transitions for each user action and stage run
  - `requirements.ts` — answers, assume-for-me, confirm, bring into scope, require condition
  - `applyComponents.ts` — stage 2 output → nodes, edges, flow, with reference cleanup
  - `applyDecisions.ts`, `applyApi.ts` — merge into nodes, edge contracts and brief
- `src/store/aiDesignStore.ts` — **ephemeral** run state: current stage, decision progress
  (done/total), warnings, error, abort controller. Never persisted, never in undo/redo. Replaces `aiStore`.
- `src/hooks/useDesignPipeline.ts` — orchestration: run the first stale stage and its dependants,
  cancel, retry a failed stage. Before regenerating the graph it flushes pending saves and creates a
  version ("Before AI update"); the apply is one `saveToHistory()` entry followed by `saveDiagram()`.
  Canvas editing is locked while a run is in progress.
- Brief edits are `diagramStore` actions (`saveToHistory()` first, then save), like other document edits.

## 8. UI

Proposed here; to be confirmed with a clickable mockup before UI implementation.

### Entry points

- "Design with AI" in the toolbar, and beside "Browse starter templates" on the empty canvas.

### Design panel

A docked panel with tabs in interview order. Each tab shows a dot when it is out of date.

1. **Brief**
   - **Initial state:** a composer with the prompt, a scope control (Frontend / Backend / Full stack,
     each with a one-line explanation of what will be detailed) and an optional "Add requirements"
     section with three free-text lists.
   - **After stage 1:** questions as cards. Options are chips showing their impact; the recommended
     one is marked; custom answers are allowed. Actions: "Continue" and "Assume the rest for me".
   - Then the requirements document, grouped by kind. Each item has an enable toggle and is editable.
     Assumptions are listed in their own section with Confirm / Change / Reject. "Out of scope" items
     have "Bring into scope".
2. **Design**
   - The summary.
   - Every component with its choice, reason and tradeoffs in a compact form. Clicking selects the
     node on the canvas.
3. **API**
   - Endpoints grouped by service: method, path, auth, style, request/response fields, errors.
   - Events below the endpoints.
   - Clicking an endpoint highlights its edges.
4. **Data model**
   - Empty state with "Generate data model". Entities once generated.

### Update bar and progress

- **Update bar.** Sticky at the bottom of the panel whenever something is stale, for example:
  "2 requirements changed · Components, reasoning and API will update — Update design". It names
  what will re-run. If the graph was edited by hand since generation, one line warns that those edits
  will be replaced and that a version is saved first.
- **Progress.** A stepper (Requirements → Components → Reasoning 7/12 → API) with Cancel. Failed
  stages show the error with Retry, and everything already applied stays.
- **After applying.** Added and changed nodes are briefly highlighted (using the diff statuses from
  `diagramDiff`), and a toast reads "+3 added · 2 changed · 1 removed" with Undo.

### Node inspector

- The Design tab gains the new tradeoff presentation.
- When a brief exists, each "Revisit when" row has **Require this**, which adds the condition as a
  requirement and marks the design stale.
- There is also a per-node "Regenerate reasoning".

### Tradeoff presentation

Replaces the neutral Benefits/Drawbacks boxes.

- **Labels:** "Gains" and "Costs" (the decision is a trade, not a diff).
- **Colour:**
  - Two new theme tokens, `--tradeoff-gain` (cool blue) and `--tradeoff-cost` (warm amber), with
    dark-mode values in `src/index.css`.
  - Blue/amber is the standard colour-blind-safe pair and does not read as added/removed.
  - The colour is used only on the marker and a thin leading rule; text stays foreground, so the
    card fits the zinc theme.
- **Shape as well as colour:** gains use a `+` marker, costs a `−` marker, so meaning never depends
  on colour.
- **Layout:** side by side when wide, stacked when narrow; "Considered instead" and "Revisit when"
  follow.

## 9. Removal inventory

- `src/services/ai/**` (OpenAI provider, diagram serializer and their tests)
- `src/store/aiStore.ts`
- `src/types/ai.ts`
- `src/schemas/ai.ts`
- `src/components/panels/SettingsPanel.tsx` and its Navbar wiring
- AI settings schemas in `src/schemas/persistence.ts` (and tests)
- `clearSessionAnalysis` call in `CloudAuth.tsx`
- `openai` dependency
- the coverage reference in `vite.config.ts`
- README "AI Integration (OpenAI)" sections and client-side-key statements
- `AGENTS.md` AI rule, rewritten to: "AI calls go through `/api/ai/*` with the server-held gateway
  key; stage schemas in `src/schemas/aiDesign.ts`; code owns staleness, ids and layout."

Stale `ai-settings` localStorage entries are removed once on load.

## 10. Error handling summary

| Failure | Behaviour |
| --- | --- |
| Not signed in | AI entry points prompt sign-in; the server returns 401. |
| Budget reached | 402; the panel says the AI budget is used up for now. |
| Rate limited | 429 with `Retry-After` when provided; the panel shows when to retry. |
| Gateway or model error | 502; the stage shows Retry; nothing applied. |
| Schema-invalid output | One automatic retry with the error; then the stage fails visibly. |
| Truncated output | 502 "too large"; the stage fails visibly. |
| Dangling references | Cleaned deterministically; the warnings summary is shown in the panel. |
| User cancels | Abort in-flight requests; completed stages stay applied. |
| Save conflict during apply | The existing `cloudWorkspace` conflict flow; the AI result is not lost because it is applied to the in-memory document first. |

## 11. Testing

- **Unit:**
  - schemas (valid and invalid fixtures)
  - staleness transitions (each action sets exactly the expected flags; same key + type keeps a decision)
  - requirement operations
  - apply functions, including reference cleanup, parent ordering and contract mapping
- **Server:**
  - route auth, validation and error mapping (402, 429, 502, truncation), with the AI call stubbed
  - prompt builders produce the expected sections
- **Component:**
  - composer, questions (answer, assume-for-me), requirement toggles marking stale, update bar,
    tradeoff rendering, Require this
- **Prompt evaluation (next phase):**
  - golden briefs from `docs/system-design-capability-audit.md` (vague, partial, complete,
    conflicting; frontend, backend and full-stack)
  - checks: schema conformance, question discipline (asks when it should, asks nothing when the brief is complete, recommended answer
    present), structural expectations (for example, realtime transport for chat; every component
    has a decision), output size
  - run first through a small, fast subagent, later against the real gateway via a script

## 12. Delivery order

1. Remove the old AI integration.
2. Schemas and brief persistence.
3. Server stage route, env, gateway error mapping.
4. Pure apply/staleness utilities.
5. Pipeline hook and ephemeral store.
6. UI, after the mockup review.
7. Prompt trials and tuning (system, stage and user prompts).
8. Docs (`docs/api.md`, README, AGENTS).
