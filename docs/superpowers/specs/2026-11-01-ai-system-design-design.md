# AI system design — specification

## 1. Purpose

Users describe a system and an AI designs it the way a strong candidate would in a system design
interview:

1. Clarify the requirements.
2. Propose components and connections.
3. Justify every choice with its tradeoffs.
4. Define the API.
5. On request, the data model.

The user then refines the inputs and the design updates.

At all times, without opening individual nodes, the user can see:

- the requirements being designed for, the assumptions made, and what is out of scope
- the reasoning and tradeoffs behind every component
- the API (endpoint catalog and events), and the data model once generated

### Out of scope

- Conversational chat with the AI.
- Incremental or partial updates to a generated design. Any change re-runs the affected stages in
  full.
- Markdown export of the brief. JSON export and import carry it as part of the diagram.

## 2. Overview

The design is produced by a pipeline of five stages. Each stage is one structured-output AI call
through the Vercel AI SDK and the Vercel AI Gateway, made by our backend.

```
 user inputs (prompt, scope, requirement lines, out-of-scope lines, answers)
      │
 ┌────▼─────────────┐  open questions? → pipeline stops until the user answers
 │ 1 Requirements   │
 └────┬─────────────┘
      │ design context (requirements, assumptions, out of scope)
 ┌────▼─────────────┐
 │ 2 Components     │  groups, components, connections, summary, main flow
 └──┬────────────┬──┘
    │            │   run concurrently
 ┌──▼─────────┐ ┌▼────────┐
 │ 3 Decisions│ │ 4 API   │
 │ (per node) │ │         │
 └────────────┘ └─────────┘
                              5 Data model: only when the user asks
```

**Every stage regenerates its whole output from its inputs.**

|          | Responsible for                                                                                                                                                                   |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The AI   | Judgment only: which questions matter, what to assume, which components and connections meet the requirements, why each was chosen and at what cost, and what the API looks like. |
| Our code | Everything else: what is out of date, what runs next, ids, reference cleanup, mapping to the diagram, layout, persistence, versions and undo.                                     |

## 3. Concepts

### 3.1 User inputs are the source of truth

The user owns a small set of inputs:

- **Prompt:** free text describing the system.
- **Scope:**
  - `frontend` details the client side, and the backend is a single box.
  - `backend` details services, data and infrastructure, and clients are one box per kind.
  - `fullstack` details both.
- **Requirement lines:** free text, each with a kind: functional, non-functional or constraint.
- **Out-of-scope lines:** free text.
- **Answers:** the user's answer to each question stage 1 asked, stored with the question text.
  An answer chosen by "Assume for me" is marked `assumed`.

Everything else in the brief is AI output derived from these inputs. Every user action in the
panel is an edit to the inputs:

| User action                                     | Edit to inputs                                                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| Type or edit a requirement or out-of-scope line | Edit that line                                                                        |
| Answer a question                               | Add an answer                                                                         |
| Assume for me                                   | Add the question's recommended answer, marked `assumed`, for each unanswered question |
| Confirm an assumption                           | Add its text as a requirement line                                                    |
| Change an assumption                            | Add the edited text as a requirement line                                             |
| Remove a derived requirement                    | Add its text as an out-of-scope line                                                  |
| Bring a derived out-of-scope item into scope    | Add its text as a requirement line                                                    |
| Require a "revisit when" condition              | Add the condition as a requirement line                                               |

User lines are always displayed verbatim. Stage 1 never restates them; it adds derived items around
them.

### 3.2 Freshness

Two fingerprints decide what is out of date. A fingerprint is a stable hash of normalized content:
text trimmed and lowercased, lists sorted, ids and display wording excluded. Neither covers AI
output, so differences in AI wording never mark anything out of date. Reverting an edit restores
the earlier fingerprint.

| Fingerprint | Covers                                                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inputs      | prompt, scope, requirement lines, out-of-scope lines, answers                                                                                                             |
| Graph       | architecture and group nodes as (key, type, parent), and edges as (from, to, protocol, async). Labels, descriptions, decisions, positions and comment nodes are excluded. |

Each stage records the fingerprint it ran from:

| Stage          | Records        | Out of date when                                                          |
| -------------- | -------------- | ------------------------------------------------------------------------- |
| 1 Requirements | inputs         | the inputs fingerprint differs                                            |
| 2 Components   | inputs         | the inputs fingerprint differs                                            |
| 3 Decisions    | inputs + graph | either fingerprint differs                                                |
| 4 API          | inputs + graph | either fingerprint differs                                                |
| 5 Data model   | inputs + graph | either fingerprint differs; shown as out of date, never run automatically |

**Update** runs the first out-of-date stage and every stage after it, in order:

- Stages 3 and 4 run concurrently.
- The pipeline stops after stage 1 while it has open questions. Stage 2 never runs with
  unanswered questions.

Consequences:

- Editing inputs re-runs everything from stage 1.
- Editing the graph by hand re-runs stages 3 and 4.
- Re-running stage 2 changes the graph, which in turn makes stages 3 and 4 out of date.

## 4. Stage contracts

Request and response schemas live in `src/schemas/aiDesign.ts`, are shared by server and client, and
are the only trust boundary for AI data. Types are inferred from them. Enums are derived from the
catalog sources of truth:

| Enum         | Source               |
| ------------ | -------------------- |
| Node types   | `NODE_TYPES_CONFIG`  |
| Group types  | `GROUP_TYPES_CONFIG` |
| Protocols    | `PROTOCOL_CONFIG`    |
| HTTP methods | `HttpMethod`         |

**Validation policy:**

- Schemas enforce only invariants that code or the feature's purpose depends on. Each such
  constraint is annotated with its reason below.
- Length and count guidance is written into the prompts and is not validated.

### 4.1 Shared types

```ts
type Scope = "frontend" | "backend" | "fullstack";
type RequirementKind = "functional" | "nonFunctional" | "constraint";
type NfrCategory =
  | "scale"
  | "latency"
  | "availability"
  | "consistency"
  | "durability"
  | "security"
  | "cost"
  | "other";

// Sent to stages 2–5: everything a designer needs to know about the problem.
interface DesignContext {
  prompt: string;
  scope: Scope;
  requirements: { kind: RequirementKind; text: string; assumed: boolean; category?: NfrCategory }[];
  outOfScope: string[];
}
```

`DesignContext.requirements` is the user's requirement lines, plus stage 1's derived requirements,
plus its assumptions (`assumed: true`). `outOfScope` is the user's out-of-scope lines plus stage 1's
derived ones.

### 4.2 Stage 1: requirements

```ts
input: {
  prompt: string; scope: Scope;
  requirements: { kind: RequirementKind; text: string }[];          // user lines
  outOfScope: string[];                                              // user lines
  answers: { question: string; answer: string; assumed: boolean }[];
}
output: {
  questions: {
    id: string; topic: string; question: string; why: string;
    options: { label: string; impact: string }[];  // empty for a free-text answer; otherwise ≥2, since one option is not a choice
    recommended: string;                            // required: "Assume for me" answers with it
    allowsCustom: boolean;
  }[];
  requirements: { kind: RequirementKind; text: string; category?: NfrCategory }[];  // derived; never restates user lines
  assumptions:  { kind: RequirementKind; text: string }[];
  outOfScope:   string[];                                                          // derived; never restates user lines
}
```

Prompt rules:

- **When to ask.** Ask only when the answer changes which components exist or a major technology
  choice; anything smaller is assumed and listed.
- **Answered questions.** Never re-ask them. Turn answers into derived requirements; an answer
  marked `assumed` becomes an assumption instead.
- **Conflicts.** When the user's lines conflict with an earlier assumption, drop the assumption.
- **Ambiguous inputs.** When two user lines conflict, ask a question about it.

### 4.3 Stage 2: components

```ts
input: { context: DesignContext; previousKeys: string[] }   // previousKeys: a hint so unchanged components keep their keys
output: {
  summary: string;
  groups:      { key: string; type: GroupNodeType; label: string; parent?: string }[];
  components:  { key: string; type: ArchitectureNodeType; label: string; responsibility: string; group?: string }[];
  connections: { from: string; to: string; protocol: EdgeProtocol; purpose: string; async: boolean }[];
  mainFlow:    { name: string; description: string; entry: string };
}
```

- `key` is a slug, unique across groups and components. Keys are used as node ids.
- Prompt guidance: the summary is two or three sentences.

### 4.4 Stage 3: decisions (one call per node)

```ts
input: {
  context: DesignContext; summary: string;
  node: { key: string; type: ArchitectureNodeType | GroupNodeType; label: string; responsibility?: string };
  neighbours: { key: string; type: string; label: string; protocol: EdgeProtocol; direction: "in" | "out" }[];
}
output: {
  choice: string; reason: string;
  gains: string[];                                   // ≥1: without a gain and a cost there is no tradeoff to show
  costs: string[];                                   // ≥1
  considered: { option: string; whyNot: string }[];  // ≥1: a justification needs an alternative
  revisitWhen: string[];
}
```

- **Where it runs.** Stage 3 runs for every architecture node and group node. Calls run
  concurrently. The concurrency level, or batching several nodes per call, is configuration tuned
  from measurements during prompt evaluation.
- **Mapping.** The output maps onto the existing `DesignDecision`:
  - `gains` → `benefits`
  - `costs` → `drawbacks`
  - `considered` → `considered`
  - `revisitWhen` → `revisitWhen`
- **Prompt guidance.** Short phrases; only the most significant items.

### 4.5 Stage 4: API

```ts
input: { context: DesignContext; summary: string; graph: { nodes: { key; type; label }[]; edges: { from; to; protocol; async }[] } }
output: {
  endpoints: {
    key: string; service: string; calledBy: string[];
    method: HttpMethod; path: string; summary: string;
    auth: "none" | "user" | "service" | "admin";
    style: "request" | "stream" | "realtime";
    request?: Record<string, string>;   // field name → type, as in template contracts
    response?: Record<string, string>;
    errors: { status: number; when: string }[];
  }[];
  events: { name: string; producer: string; consumers: string[]; payload: Record<string, string> }[];
}
```

### 4.6 Stage 5: data model

```ts
input: { context: DesignContext; graph: { … as stage 4 }; endpoints: { service: string; method: HttpMethod; path: string }[] }
output: {
  entities: {
    name: string; store: string;   // store: key of the component that owns the entity
    fields: { name: string; type: string; key?: "primary" | "foreign" | "index" }[];
    relations: { to: string; kind: "one-to-one" | "one-to-many" | "many-to-many" }[];
  }[];
}
```

## 5. Persisted document

`DiagramData` gains an optional `brief`, validated by `diagramStructureSchema`. It is therefore
saved, versioned, undone, exported and imported with the diagram. Diagrams without a brief behave
as today.

```ts
interface DesignBrief {
  inputs: {
    prompt: string;
    scope: Scope;
    requirements: { id: string; kind: RequirementKind; text: string }[];
    outOfScope: { id: string; text: string }[];
    answers: { id: string; question: string; answer: string; assumed: boolean }[];
  };
  // Stage 1 output (latest run)
  questions: Stage1Output["questions"]; // open questions; empty when none
  requirements: { kind: RequirementKind; text: string; category?: NfrCategory }[];
  assumptions: { kind: RequirementKind; text: string }[];
  outOfScope: string[];
  // Stage 2–5 output not stored on nodes and edges
  summary?: string;
  api?: { endpoints: Endpoint[]; events: ApiEvent[] };
  dataModel?: { entities: Entity[] };
  // Fingerprints each stage last ran from (section 3.2)
  ranFrom: {
    requirements?: string;
    components?: string;
    decisions?: string;
    api?: string;
    dataModel?: string;
  };
}
```

The graph, and the decision for each node, are stored in the diagram's nodes and edges as today.

## 6. Applying stage output (deterministic)

Pure functions in `src/utils/aiDesign/`, each unit tested.

### Stage 1

1. Replace the brief's stage 1 fields with the output.
2. Drop derived items that exactly duplicate a user line, after normalization.

### Stage 2

1. **Validate keys.** Keys must be slugs and unique, and must not collide with comment node ids.
2. **Clean up references.** Drop connections to unknown keys, unknown group parents, and group
   cycles. Report each as a warning. The stage fails if no components remain.
3. **Replace the graph.** Replace all architecture nodes, group nodes and edges:
   - Components become architecture nodes, with `responsibility` as the description.
   - Groups become group nodes. Parents come before children, children use `parentId`, and every
     child has `extent: 'parent'`.
   - Connections become edges, with `purpose` as the label and `async` set.
4. **Keep what isn't generated.** Comment nodes are kept. Saved flows whose nodes all still exist
   are kept.
5. **Main flow.** It replaces the previous AI main flow, which has the fixed id `flow-ai-main`. It
   is built the same way `defineTemplate` builds a template's flow.
6. **Layout and summary.** Run the existing auto-layout, then store the summary.

### Stages 3 to 5

| Stage | Applied as                                                                                                                                                                                                                               |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3     | Write the decision to the node's `data.decision` as each call completes.                                                                                                                                                                 |
| 4     | Store `endpoints` and `events` in the brief. Endpoints are independent of edge request/response contracts, which remain a manual feature. Endpoints whose `service` or `calledBy` keys are unknown are kept and flagged in the API view. |
| 5     | Store the entities in the brief.                                                                                                                                                                                                         |

### Every apply

- One `saveToHistory()` entry, followed by `saveDiagram()`.
- Before an update that runs stage 2 on a diagram that already has a graph, flush pending saves and
  create a version labelled "Before AI update".

## 7. Server

### Endpoint

`POST /api/ai/:stage`, where `stage` is `requirements | components | decisions | api | data-model`.
It is mounted in `server/handler.ts` behind the existing `requireOwner`.

**Request handling:**

1. Require a JSON content type.
2. Apply a body size limit, set from the largest measured legitimate stage input with headroom.
3. Validate the body with the stage's input schema.

**Response:** the validated stage output as JSON.

**Errors:**

| Condition                                 | Response                                    |
| ----------------------------------------- | ------------------------------------------- |
| Invalid input                             | 400                                         |
| Body too large                            | 413                                         |
| Unsupported media type                    | 415                                         |
| Gateway budget exceeded (gateway 402)     | 402, "AI budget reached"                    |
| Gateway rate limit (gateway 429)          | 429, forwarding `Retry-After` when present  |
| Output truncated (finish reason `length`) | 502, "The design was too large to generate" |
| Any other gateway or model failure        | 502, with a safe message                    |

### Modules

| Module                  | Responsibility                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------- |
| `server/routes/ai.ts`   | Route, validation, error mapping                                                      |
| `server/ai/models.ts`   | Model id per stage: `AI_MODEL`, optionally overridden per stage by `AI_MODEL_<STAGE>` |
| `server/ai/stages/*.ts` | One module per stage, as described below                                              |
| `server/ai/examples/`   | Worked examples used as few-shot input in the stage 2, 3 and 4 prompts                |

Each stage module:

- Builds the system and user prompts.
- Calls `generateText({ model, system, prompt, output: Output.object({ schema }) })` at low
  temperature.
- Passes the Clerk owner id as the gateway user, so per-user budgets apply.
- If the output fails schema validation, retries once with the validation error included in the
  prompt. A second failure is returned as an error.

The worked examples are taken from one starter template. A test asserts that each still matches
its source template.

### Configuration

| Setting              | Notes                                                               |
| -------------------- | ------------------------------------------------------------------- |
| `AI_GATEWAY_API_KEY` | Server only. Optional when Vercel OIDC authentication is available. |
| `AI_MODEL`           | Default model for all stages.                                       |
| `AI_MODEL_<STAGE>`   | Optional per-stage override.                                        |

- All are added to `serverEnvSchema` and `.env.example`.
- `vercel.json` sets the function `maxDuration` to cover the slowest stage.
- Spend and request rate are controlled in Vercel, not in application code: AI Gateway budgets (team
  and default per user), and optionally a Vercel Firewall rate-limit rule on `/api/ai/*`. The setup
  is documented in `docs/api.md`.

## 8. Client

| Module                               | Responsibility                                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `src/services/api/ai.ts`             | One function per stage, built from the existing transport helpers; validates responses with the stage output schemas. |
| `src/utils/aiDesign/fingerprints.ts` | Normalization, the inputs and graph fingerprints, out-of-date stages, next stage to run.                              |
| `src/utils/aiDesign/inputs.ts`       | Each user action from section 3.1 as a pure inputs edit; builds `DesignContext`.                                      |
| `src/utils/aiDesign/apply*.ts`       | The apply functions from section 6.                                                                                   |
| `src/store/aiDesignStore.ts`         | Ephemeral run state, described below.                                                                                 |
| `src/hooks/useDesignPipeline.ts`     | Runs the pipeline, described below.                                                                                   |

**Ephemeral run state** (`aiDesignStore`): the current stage, decision progress (done/total),
warnings, the last error per stage, and the abort controller. It is never persisted and never in
undo/redo.

**The pipeline hook** (`useDesignPipeline`):

- Runs from the first out-of-date stage.
- Runs stages 3 and 4 concurrently.
- Stops at open questions.
- Supports cancel, retry of a failed stage, and "Regenerate reasoning" for a single node.
- Canvas editing is locked while a run is in progress.

Inputs edits are `diagramStore` actions: `saveToHistory()` first, then `saveDiagram()`.

## 9. User interface

The layout below is validated with a clickable mockup before implementation.

### 9.1 Entry points

- "Design with AI" in the editor toolbar.
- "Design with AI" beside "Browse starter templates" on the empty canvas.

### 9.2 Design panel

A docked panel with four tabs in interview order. A tab shows a dot when its content is out of date.

**Brief**

- **Composer** (no brief yet):
  - prompt
  - scope control: Frontend / Backend / Full stack, each with a one-line description of what will
    be detailed
  - an optional "Add requirements" section for requirement and out-of-scope lines
  - **Start design**
- **Questions:** cards in which options are chips showing their impact. The recommended option is
  marked, and custom answers are allowed where the question permits. Actions: **Continue** (enabled
  once every question is answered) and **Assume the rest for me**. Both record the answers and run
  the update.
- **Requirements:** grouped by kind. User lines are editable and removable. Derived requirements
  have **Remove**.
- **Assumptions:** stage 1 assumptions and assumed answers, each with **Confirm** and **Change**.
- **Out of scope:** user lines are editable. Derived items have **Bring into scope**.

**Design**

- The summary.
- Every component and group with its choice, reason and tradeoffs. Selecting one selects the node.

**API**

- Endpoints grouped by service: method, path, auth, style, request and response fields, errors.
- Events below the endpoints.
- Selecting an endpoint highlights its service and callers on the canvas.

**Data model**

- An empty state with **Generate data model**, then the entities. Shows an out-of-date dot when the
  inputs or graph changed since it was generated.

### 9.3 Update bar and progress

- **Update bar.** Pinned to the bottom of the panel while anything is out of date. It names what
  will run, for example "Requirements, components, reasoning and API will update". Its action is
  **Update design**. When stage 2 will run, it states that the current design is replaced and a
  version is saved first.
- **Progress.** A stepper (Requirements → Components → Reasoning 7/12 → API) with **Cancel**.
  - A failed stage shows its error and **Retry**.
  - Completed stages remain applied.
- **After an update.** Added and changed nodes are briefly highlighted, using `diagramDiff` against
  the version saved before the update. A toast summarizes the change, for example
  "+3 added · 2 changed · 1 removed", with **Undo**.

### 9.4 Node inspector

On the Design tab:

- The tradeoff presentation below.
- **Regenerate reasoning**.
- When the diagram has a brief, each "Revisit when" item has **Require this**.

### 9.5 Tradeoff presentation

Used in the inspector and the Design tab.

- **Labels.** "Gains" and "Costs".
- **Colour tokens.** Two theme tokens in `src/index.css`, each with a dark-mode value:
  - `--tradeoff-gain`: a cool blue
  - `--tradeoff-cost`: a warm amber
- **Why blue and amber.** The pair is colour-blind safe and does not read as an added/removed diff.
- **Where colour appears.** Only on the item marker and a thin leading rule. Item text uses the
  foreground colour, so the card stays within the zinc theme.
- **Shape as well as colour.** Gains use a `+` marker and costs a `−` marker, so meaning never
  depends on colour alone.
- **Layout.** Side by side when there is room, stacked when narrow. "Considered instead" and
  "Revisit when" follow.

## 10. Error handling

| Situation                              | Behaviour                                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Signed out                             | AI entry points prompt sign-in; the server returns 401.                                                            |
| Budget reached (402)                   | The panel says the AI budget is used up for now.                                                                   |
| Rate limited (429)                     | The panel shows when to retry.                                                                                     |
| Gateway or model failure (502)         | The stage shows its error and **Retry**; nothing from that stage is applied.                                       |
| Dangling references in stage 2 output  | Cleaned up (section 6); warnings shown in the panel.                                                               |
| Endpoint references unknown components | Kept and flagged in the API view.                                                                                  |
| Cancel                                 | In-flight requests are aborted; completed stages stay applied.                                                     |
| Save conflict during apply             | Existing `cloudWorkspace` conflict flow. The result is applied to the in-memory document first, so it is not lost. |

## 11. Removal of the existing AI integration

Remove:

- `src/services/ai/**`
- `src/store/aiStore.ts`
- `src/types/ai.ts`
- `src/schemas/ai.ts`
- `src/components/panels/SettingsPanel.tsx` and its Navbar wiring
- AI settings schemas in `src/schemas/persistence.ts`, and their tests
- the `clearSessionAnalysis` call in `CloudAuth.tsx`
- the `openai` dependency
- the coverage entry in `vite.config.ts`

Then:

- Delete any stale `ai-settings` localStorage entry once on load.
- Update the README.
- Replace the AI rule in `AGENTS.md`: AI calls go through `/api/ai/*` using the server-held gateway
  key; stage schemas live in `src/schemas/aiDesign.ts`; code owns freshness, ids, layout and
  persistence.

## 12. Testing

**Unit**

- Every schema, with valid and invalid fixtures.
- Fingerprints: normalization; wording changes don't alter them; reverting restores them.
- Next stage to run, for each kind of change.
- Each inputs edit.
- Each apply function, including reference cleanup, parent ordering, comment and flow preservation,
  and duplicate removal.

**Server**

- Authentication, validation, body limit, and error mapping (402, 429, 502, truncation), with the
  AI call stubbed.
- Prompt builders include the context, answers and examples.

**Component**

- Composer.
- Questions, including Assume for me.
- Each assumption, requirement and out-of-scope action.
- The update bar's content.
- Progress, cancel and retry.
- Tradeoff rendering.
- **Require this**.

**Prompt evaluation**

- **Golden inputs** drawn from `docs/system-design-capability-audit.md`: vague, partial, complete
  and self-conflicting briefs, across all three scopes.
- **Checks:**
  - schema conformance
  - question discipline: asks when it should, asks nothing for a complete brief, never re-asks an
    answered question, always gives a recommended answer
  - structural expectations, for example a realtime transport for collaborative or chat systems,
    and a decision for every node
  - output size and latency
- **How it runs:** first through a small, fast model acting as a stand-in, then against the real
  gateway via a script.

## 13. Delivery order

1. Remove the existing AI integration.
2. Schemas, the `brief` field, and persistence round-trip.
3. Server route, stage modules with stubbed prompts, configuration and error mapping.
4. Pure utilities: fingerprints, inputs edits, apply functions.
5. Pipeline hook and run-state store.
6. Clickable UI mockup review, then the UI.
7. Prompt evaluation and tuning of the system, stage and user prompts.
8. Documentation: `docs/api.md`, README, `AGENTS.md`.

---

## Appendix A: worked example

A shared grocery list app, full stack. The responses are abridged illustrations of what the prompts
should produce.

### A.1 First run

**Step 1. The user starts a design** (inputs fingerprint `i1`):

- Prompt: "Design a shared grocery list app for households. Members add items and check them off
  while shopping."
- Requirement line (functional): "Members of a household share the same lists".

**Step 2. Stage 1 runs.** It asks two questions:

- Scale. Options: up to 10k households, about 1M, 10M+. Recommended: about 1M.
- How quickly members must see each other's changes. Options: instantly, or within a minute.
  Recommended: instantly.

It also returns:

- Derived requirements: add, edit and remove items; check items off; invite members; check-off
  feels immediate.
- Assumptions: "online only"; "email or social sign-in".
- Derived out of scope: ordering groceries; recipes.

The pipeline stops because questions are open.

**Step 3. The user answers.** They pick "About 1M households" for scale, then press **Assume the
rest for me**. The visibility answer is recorded as assumed. The inputs fingerprint becomes `i2`.

**Step 4. Stage 1 runs again.** There are no questions this time.

- Derived requirements now include "Serve about 1M households".
- Assumptions now include "Members see changes instantly".

**Step 5. Stage 2 runs.** It returns:

- Components:
  - mobile and web apps
  - API gateway
  - auth provider
  - lists service
  - sync service (WebSocket)
  - PostgreSQL database
  - Redis cache
  - an event bus from the lists service to the sync service
- Group: a backend VPC.
- Main flow: "Check off an item", starting from the mobile app.

The graph is applied and laid out. The graph fingerprint is `g1`.

**Step 6. Stages 3 and 4 run concurrently.**

- Stage 3 runs once for each of the 10 nodes. The sync service's decision:
  - **Choice:** WebSocket channel per household.
  - **Gains:** sub-second updates; a stateless lists API.
  - **Costs:** many open connections; reconnects must catch up.
  - **Considered:** polling; server-sent events.
  - **Revisit when:** "Members need the list without signal in the store".
- Stage 4 returns:
  - Endpoints: `POST /households/{id}/lists`, `PATCH /lists/{listId}/items/{itemId}` (with a
    version number and a 409 on conflict), and `GET /households/{id}/stream` (realtime).
  - Events: `item.changed`.

### A.2 Iteration

**Step 7. The user adds offline support.** On the sync service they press **Require this** on
"Members need the list without signal in the store". This adds a requirement line, and the inputs
fingerprint becomes `i3`. Every stage is now out of date. The update bar reads "Requirements,
components, reasoning and API will update".

**Step 8. The user presses Update design.** Stage 1 re-runs:

- "Online only" is no longer assumed, because it contradicts a user line.
- It asks: "When two members change the same item offline, which change wins?" Options: last write
  wins, or keep both and let a member resolve.

The pipeline stops at the open question.

**Step 9. The user answers.** Stage 1 runs and returns no questions.

**Step 10. A version is saved,** then stage 2 runs. The previous keys are kept, and these are
added:

- local storage on the mobile app
- a service worker on the web app
- a sync path from each client for queued changes

**Step 11. Stages 3 and 4 run for the new graph.**

- The sync service's decision now covers merging queued offline changes.
- The API adds `POST /lists/{listId}/changes` for batches of queued changes.

**Step 12. The panel highlights what changed:** "+3 added · 4 changed".
