# AI system design — specification

## 1. Purpose

Users describe a system and an AI designs it the way a strong candidate would in a system design
interview:

1. Settle the requirements, assuming whatever the brief leaves open.
2. Propose components and connections.
3. Justify every choice with its tradeoffs.
4. Define the API.
5. On request, the data model.

The whole design is generated in one run from what the user first provides: nothing is asked
along the way. The user then reviews the assumptions, refines the inputs and the design updates.

At all times, without opening individual nodes, the user can see:

- the requirements being designed for, the assumptions made, and what is out of scope
- the reasoning and tradeoffs behind every component
- the API (endpoint catalog and events), and the data model once generated

### Out of scope

- Conversational chat with the AI.
- Clarifying questions. The AI never stops a run to ask; it assumes, and the user edits the
  assumptions afterwards.
- Incremental or partial updates to a generated design. Any change re-runs the affected stages in
  full.
- Markdown export of the brief. JSON export and import carry it as part of the diagram.

## 2. Overview

The design is produced by a pipeline of five stages. Each stage is one structured-output AI call
through the Vercel AI SDK and the Vercel AI Gateway, made by our backend.

```
 user inputs (prompt, scope, requirement lines, out-of-scope lines)
      │
 ┌────▼─────────────┐  asks nothing: open decisions become assumptions
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

|          | Responsible for                                                                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The AI   | Judgment only: what to assume, which components and connections meet the requirements, why each was chosen and at what cost, and what the API looks like. |
| Our code | Everything else: what is out of date, what runs next, ids, reference cleanup, mapping to the diagram, layout, persistence, versions and undo.             |

## 3. Concepts

### 3.1 User inputs are the source of truth

The user owns a small set of inputs:

- **Prompt:** free text describing the system. Required.
- **Scope:**
  - `frontend` details the client side, and the backend is a single box.
  - `backend` details services, data and infrastructure, and clients are one box per kind.
  - `fullstack` details both.
- **Requirement lines:** free text, each with a kind: functional, non-functional or constraint. At
  least one functional line is required to generate or update a design. A non-functional line that
  starts with a category, as in "Latency: p99 under 200 ms", carries that category (section 4.1)
  to the stages; nothing extra is stored, so the line text stays the only source.
- **Out-of-scope lines:** free text.

The user writes each section as a multi-line box, one item per line, so a whole section can be
pasted or changed at once. Lines are trimmed; blank lines and repeats (by normalized text) are
dropped.

- **Answers:** kept only for briefs saved by the earlier question round-trip, which asked the user
  questions before designing. Each is stored with its question text; one chosen by "Assume for me"
  is marked `assumed`. New briefs never get answers.

Everything else in the brief is AI output derived from these inputs. Every user action in the
panel is an edit to the inputs:

| User action                                     | Edit to inputs                                    |
| ----------------------------------------------- | ------------------------------------------------- |
| Type or edit a requirement or out-of-scope line | Edit that line                                    |
| Edit all, then Update design                    | Replace the prompt, scope and every line at once  |
| Confirm an assumption                           | Add its text as a requirement line                |
| Confirm or change a saved assumed answer        | Record it as the user's answer (`assumed: false`) |
| Change an assumption                            | Add the edited text as a requirement line         |
| Remove a derived requirement                    | Add its text as an out-of-scope line              |
| Bring a derived out-of-scope item into scope    | Add its text as a requirement line                |
| Make a decision's assumption a requirement      | Add the assumption as a requirement line          |

**Requirements and assumptions.** Requirements are the user's own lines; assumptions are the AI's.
Both the brief's assumptions and the assumptions behind each decision (below) can be promoted to a
requirement, which is then the user's line.

User lines are always displayed verbatim. Stage 1 never restates them; it adds derived items around
them.

**Line ids in a bulk edit.** A line whose normalized text is unchanged keeps its id; a new or
edited line gets a new one. Ids only identify rows: the inputs fingerprint ignores them and the
order of lines, so a bulk edit that changes nothing leaves every stage fresh, and an unchanged form
adds no history entry.

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
- Nothing stops the pipeline between stages: stage 1 asks no questions, so a new brief runs every
  stage in one go.
- A brief saved by the earlier question round-trip may still hold open questions. It runs from
  stage 1, which now assumes them.

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
  requirements: { kind: RequirementKind; text: string; category?: NfrCategory }[];  // user lines; category read from a "Latency:" prefix
  outOfScope: string[];                                              // user lines
  answers: { question: string; answer: string; assumed: boolean }[];  // from saved briefs only
  askQuestions: false;   // the design runs in one go; stage 1 never asks
}
output: {
  questions: {
    id: string; topic: string; question: string; why: string;
    options: { label: string; impact: string }[];  // empty for a free-text answer; otherwise ≥2, since one option is not a choice
    recommended: string;                            // required: a question returned anyway is assumed with it
    allowsCustom: boolean;
  }[];
  requirements: { kind: RequirementKind; text: string; category?: NfrCategory }[];  // derived; never restates user lines
  assumptions:  { kind: RequirementKind; text: string }[];
  outOfScope:   string[];                                                          // derived; never restates user lines
}
```

`askQuestions` is a literal `false`: the field states the contract explicitly in every request,
and widening it to a boolean is the way to bring a question mode back. The output keeps its
`questions` field, so the output schema and saved briefs stay as they were; the prompt says it is
always an empty list.

Prompt rules:

- **Ask nothing.** Decide everything that is open yourself, including anything that changes which
  components exist or a major technology choice, and list each decision as an assumption.
- **Answered questions** (saved briefs). Never re-ask them. Turn answers into derived requirements;
  an answer marked `assumed` becomes an assumption instead.
- **Conflicts.** When the user's lines conflict with an earlier assumption, drop the assumption.
- **Ambiguous inputs.** When two user lines conflict, choose the reading that fits the rest of the
  brief and list that choice as an assumption.

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
  revisitWhen: string[];                             // the assumptions the choice rests on
}
```

- **Assumptions.** `revisitWhen` keeps its name, in the stage schema and in saved decisions, but
  the prompt asks for the assumptions the choice rests on: short statements that hold today, such
  as "Links are only looked up by their short code", which would change the choice if they stopped
  holding. In an AI design the UI shows them as "Assumes" (section 9.4). Hand-made diagrams and
  templates keep "Revisit when", since their items are written as triggers.

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
  questions: Stage1Output["questions"]; // always empty now; saved round-trip briefs may hold some
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
3. **Assume any question.** The model is told to ask nothing, but code owns the result: each
   question it returns anyway becomes an assumption, `{ kind: "constraint", text: "<topic>:
   <recommended>" }`, unless an assumption with that text exists or there is no recommended
   answer. `questions` is stored empty, so nothing blocks the run.

   Assumptions are stage 1 output, not inputs, so the inputs stay the user's own: the inputs
   fingerprint does not change and stage 1 stays fresh after the run. Stages 2 to 4 read
   assumptions through `DesignContext`, so they see these in the same run. (Recording them as
   assumed answers instead would change the inputs, leave stage 1 out of date straight after the
   run, and hide them from stages 2 to 4, which never read answers.)

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

- Runs from the first out-of-date stage. For a new brief that is the whole design, in one run.
- Runs stages 3 and 4 concurrently.
- Never stops for questions.
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
  - one labelled multi-line box per section (functional, non-functional, constraints, out of
    scope), one item per line, each with help text tied by `aria-describedby` and a placeholder
    of concrete examples. Functional is required.
  - non-functional presets: a button per category (scale, latency, availability, consistency,
    durability, security, cost) that adds "<Category>: <example>" with the example selected
  - **Generate design**, which runs every stage in one go. It is disabled until there is a
    prompt and a functional line, with the reason shown and tied to the button.
- **Edit all:** turns the brief into the composer's form, prefilled from the user's inputs.
  **Update design** records the change as one edit and runs the stages it outdated; **Cancel**
  leaves the brief alone. The same prompt and functional-line rule applies.
- **Requirements:** grouped by kind. User lines are editable and removable. Derived requirements
  have **Remove**.
- **Assumptions:** stage 1 assumptions (including questions it assumed) and, in saved briefs,
  assumed answers, each with **Confirm** and **Change**.
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
- When the diagram has a brief, the decision's `revisitWhen` items are headed **Assumes**, and each
  has **Make this a requirement**, or a "Required" tag once a requirement line has its text. The
  node detail popup uses the same heading. Without a brief the list stays "Revisit when", with no
  action.

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
  "Assumes" ("Revisit when" without a brief) follow.

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

- Composer: required-field gating, bulk paste, presets with their category.
- Edit all: many lines in one edit, ids kept for unchanged lines.
- A saved brief with open questions shows no question round-trip and offers Update.
- Each assumption, requirement and out-of-scope action.
- The update bar's content.
- Progress, cancel and retry.
- Tradeoff rendering.
- **Make this a requirement**, and the "Assumes" labels.

**Prompt evaluation**

- **Golden inputs** drawn from `docs/system-design-capability-audit.md`: vague, partial, complete
  and self-conflicting briefs, across all three scopes.
- **Checks:**
  - schema conformance
  - question discipline: asks nothing in any case, and lists at least one assumption for a brief
    that leaves decisions open
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

**Step 1. The user presses Generate design** (inputs fingerprint `i1`):

- Prompt: "Design a shared grocery list app for households. Members add items and check them off
  while shopping."
- Requirement line (functional): "Members of a household share the same lists".

**Step 2. Stage 1 runs and asks nothing.** It decides what the brief leaves open and returns:

- Derived requirements: add, edit and remove items; check items off; invite members; check-off
  feels immediate.
- Assumptions: "About 1M households"; "Members see each other's changes instantly"; "online
  only"; "email or social sign-in".
- Derived out of scope: ordering groceries; recipes.

Had it returned a question anyway, such as scale with the recommended answer "About 1M", code
would have added the assumption "Scale: About 1M" instead. The run carries straight on.

**Steps 3 and 4** are gone: the earlier flow stopped here for the user to answer, then ran stage
1 again. The steps below keep their numbers.

**Step 5. Stage 2 runs, in the same run.** It returns:

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
  - **Assumes:** "Members have signal while shopping".
- Stage 4 returns:
  - Endpoints: `POST /households/{id}/lists`, `PATCH /lists/{listId}/items/{itemId}` (with a
    version number and a 409 on conflict), and `GET /households/{id}/stream` (realtime).
  - Events: `item.changed`.

### A.2 Iteration

**Step 7. The user adds offline support.** The sync service's decision assumes "Members have
signal while shopping", which is wrong for them. They press **Edit all** in the Brief tab, add the
functional line "Members use the list without signal in the store", and press **Update design**.
(Pressing **Make this a requirement** on the assumption would instead hold the design to it.) The
inputs fingerprint becomes `i3`, so every stage is out of date and the update runs them all.

**Step 8. Stage 1 re-runs and asks nothing:**

- "Online only" is no longer assumed, because it contradicts a user line.
- It assumes "Last write wins when two members change the same item offline" and lists it with
  the other assumptions, where the user can change it later.

**Step 9** is gone: the earlier flow stopped here for an answer.

**Step 10. A version is saved,** then stage 2 runs in the same run. The previous keys are kept, and these are
added:

- local storage on the mobile app
- a service worker on the web app
- a sync path from each client for queued changes

**Step 11. Stages 3 and 4 run for the new graph.**

- The sync service's decision now covers merging queued offline changes.
- The API adds `POST /lists/{listId}/changes` for batches of queued changes.

**Step 12. The panel highlights what changed:** "+3 added · 4 changed".
