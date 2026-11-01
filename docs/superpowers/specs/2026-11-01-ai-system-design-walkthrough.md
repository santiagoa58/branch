# AI system design — worked walkthrough

Companion to `2026-11-01-ai-system-design-design.md`. Follows one design from first prompt through
an iteration, showing every request, the expected AI response (abridged), what our code does
deterministically, and the fingerprints. Responses are illustrative of what the prompts should
produce, not recorded model output.

Example: a shared grocery list app, full stack.

---

## Step 0 — The user composes

The user types:

- Prompt: "Design a shared grocery list app for households. Members add items and check them off
  while shopping."
- Scope: Full stack
- Functional criteria: "Members of a household share the same lists"

Nothing is generated yet. Every stage is out of date because nothing has run.

---

## Step 1 — Requirements (AI call 1)

**Request** `POST /api/ai/requirements`

```json
{
  "prompt": "Design a shared grocery list app for households. Members add items and check them off while shopping.",
  "scope": "fullstack",
  "criteria": { "functional": ["Members of a household share the same lists"], "nonFunctional": [], "constraints": [] },
  "settled": []
}
```

**Expected response**

The model asks only what changes components or major technology choices: scale and how fresh
shared changes must be. Smaller things are assumed and listed.

```json
{
  "questions": [
    {
      "id": "q-scale", "topic": "Scale",
      "question": "Roughly how many households should this serve?",
      "why": "Decides between a single database and partitioned storage, and how much caching is needed.",
      "options": [
        { "label": "Up to 10k households", "impact": "One database, no caching layer" },
        { "label": "About 1M households", "impact": "Read replicas and a cache for hot lists" },
        { "label": "10M+ households", "impact": "Partitioned storage by household" }
      ],
      "recommended": "About 1M households", "allowsCustom": true
    },
    {
      "id": "q-sync", "topic": "Change visibility",
      "question": "When one member checks off an item, how quickly must others see it?",
      "why": "Instant updates need a persistent connection service; delayed updates can use polling.",
      "options": [
        { "label": "Instantly, while shopping together", "impact": "Realtime connection service (WebSocket)" },
        { "label": "Within a minute is fine", "impact": "Clients poll; no realtime service" }
      ],
      "recommended": "Instantly, while shopping together", "allowsCustom": false
    }
  ],
  "functional": [
    { "text": "Members of a household share the same lists" },
    { "text": "Members add, edit and remove items" },
    { "text": "Members check items off and uncheck them" },
    { "text": "Members invite others to their household" }
  ],
  "nonFunctional": [
    { "text": "Checking off an item feels immediate to the person doing it", "category": "latency" }
  ],
  "constraints": [],
  "assumptions": [
    { "text": "The app needs a connection to load and change lists (online only)", "kind": "nonFunctional" },
    { "text": "Members sign in with email or a social account", "kind": "functional" }
  ],
  "outOfScope": [
    { "text": "Ordering or paying for groceries" },
    { "text": "Recipe and meal planning" }
  ]
}
```

**Our code (deterministic)**

- Writes the brief: requirements with `basis: "stated"`, assumptions as requirements with
  `basis: "assumed"`, out-of-scope items, and the two questions.
- The panel shows the questions; "Continue" waits until both have answers.

---

## Step 2 — The user answers (no AI call)

- Scale: picks "About 1M households".
- Change visibility: does not answer, presses **Assume the rest for me**.

**Our code**

```text
+ requirement  "Scale: About 1M households"                      basis: answered
+ requirement  "Change visibility: Instantly, while shopping together"   basis: assumed
```

The second is `assumed` because the user did not pick it; it shows in the Assumptions list with
Confirm / Change / Reject.

Fingerprints after this step:

| Stage | Fingerprint of | Stored | Current | State |
| --- | --- | --- | --- | --- |
| 1 Requirements | prompt, scope, requirements after its own merge | `r1` | `r2` | see Issue 2 |
| 2 Components | prompt, scope, enabled requirements | none | `c1` | out of date (never run) |

---

## Step 3 — Components (AI call 2)

**Request** `POST /api/ai/components`

```json
{
  "prompt": "…", "scope": "fullstack",
  "requirements": [ /* the 9 enabled requirements, kind + text */ ],
  "previousKeys": []
}
```

**Expected response (abridged)**

```json
{
  "summary": "Mobile and web clients talk to a lists API through a gateway. A sync service holds WebSocket connections per household and fans out item changes published by the lists API. Lists live in PostgreSQL with Redis caching hot lists.",
  "groups": [ { "key": "backend", "type": "vpc", "label": "Backend" } ],
  "components": [
    { "key": "mobile",  "type": "mobileapp",    "label": "Mobile app", "responsibility": "Lists and check-off while shopping" },
    { "key": "web",     "type": "webapp",       "label": "Web app",    "responsibility": "Manage lists and household" },
    { "key": "gateway", "type": "gateway",      "label": "API gateway", "responsibility": "Auth check and routing", "group": "backend" },
    { "key": "auth",    "type": "auth",         "label": "Auth provider", "responsibility": "Sign-in and tokens" },
    { "key": "lists",   "type": "service",      "label": "Lists service", "responsibility": "Lists, items and households", "group": "backend" },
    { "key": "sync",    "type": "service",      "label": "Sync service", "responsibility": "Pushes item changes to connected members", "group": "backend" },
    { "key": "db",      "type": "database",     "label": "Lists database", "responsibility": "Source of truth", "group": "backend" },
    { "key": "cache",   "type": "cache",        "label": "Hot lists cache", "responsibility": "Fast reads of active lists", "group": "backend" },
    { "key": "bus",     "type": "eventbus",     "label": "Item change events", "responsibility": "Decouples writes from fan-out", "group": "backend" }
  ],
  "connections": [
    { "from": "mobile",  "to": "gateway", "protocol": "http",      "purpose": "List and item changes", "async": false },
    { "from": "web",     "to": "gateway", "protocol": "http",      "purpose": "List and household management", "async": false },
    { "from": "mobile",  "to": "sync",    "protocol": "websocket", "purpose": "Live item updates", "async": false },
    { "from": "web",     "to": "sync",    "protocol": "websocket", "purpose": "Live item updates", "async": false },
    { "from": "gateway", "to": "auth",    "protocol": "oauth",     "purpose": "Verify tokens", "async": false },
    { "from": "gateway", "to": "lists",   "protocol": "http",      "purpose": "Route requests", "async": false },
    { "from": "lists",   "to": "db",      "protocol": "sql",       "purpose": "Read and write lists", "async": false },
    { "from": "lists",   "to": "cache",   "protocol": "redis",     "purpose": "Cache hot lists", "async": false },
    { "from": "lists",   "to": "bus",     "protocol": "eventbridge", "purpose": "Publish item changes", "async": true },
    { "from": "bus",     "to": "sync",    "protocol": "eventbridge", "purpose": "Deliver item changes", "async": true }
  ],
  "mainFlow": { "name": "Check off an item", "entry": "mobile" }
}
```

**Our code**

1. Validates keys and references (all resolve; nothing dropped).
2. Maps to group, architecture nodes and edges; `responsibility` becomes the node description.
3. Creates the named flow "Check off an item" from `mobile`.
4. Runs auto-layout and applies the result as one undo step. This is the first graph, so no
   version is saved yet.
5. Stores the components fingerprint `c1` and the generated-graph fingerprint `g1`.
6. Stage 3 is now out of date for all 10 nodes (9 components + 1 group); stage 4 is out of date.

---

## Step 4 — Decisions and API, concurrently (AI calls 3–13)

### Decisions: one request per node

**Request** `POST /api/ai/decisions` (for `sync`)

```json
{
  "requirements": [ /* enabled requirements */ ],
  "summary": "…",
  "component": { "key": "sync", "type": "service", "label": "Sync service", "responsibility": "Pushes item changes to connected members" },
  "neighbours": [
    { "key": "mobile", "type": "mobileapp", "label": "Mobile app", "protocol": "websocket", "direction": "in" },
    { "key": "web",    "type": "webapp",    "label": "Web app",    "protocol": "websocket", "direction": "in" },
    { "key": "bus",    "type": "eventbus",  "label": "Item change events", "protocol": "eventbridge", "direction": "in" }
  ]
}
```

**Expected response**

```json
{
  "choice": "WebSocket sync service, one channel per household",
  "reason": "Members shopping together must see check-offs instantly, which needs a held connection.",
  "gains": ["Changes appear in under a second", "Lists API stays stateless"],
  "costs": ["Holds many open connections", "Reconnects must re-fetch missed changes"],
  "considered": [
    { "option": "Polling every few seconds", "whyNot": "Delays and wasted requests while shopping" },
    { "option": "Server-sent events", "whyNot": "Clients also send presence; one socket is simpler" }
  ],
  "revisitWhen": [
    { "condition": "Members need the list without signal in the store", "kind": "functional" }
  ]
}
```

### API: one request

**Request** `POST /api/ai/api` with the requirements, the summary, and the graph (keys, types,
labels, connections).

**Expected response (abridged)**

```json
{
  "endpoints": [
    { "key": "create-list", "service": "lists", "calledBy": ["mobile", "web"], "method": "POST", "path": "/households/{householdId}/lists",
      "summary": "Create a list", "auth": "user", "style": "request",
      "request": { "name": "string" }, "response": { "id": "string", "name": "string" },
      "errors": [ { "status": 403, "when": "Not a member of the household" } ] },
    { "key": "check-item", "service": "lists", "calledBy": ["mobile", "web"], "method": "PATCH", "path": "/lists/{listId}/items/{itemId}",
      "summary": "Check or uncheck an item", "auth": "user", "style": "request",
      "request": { "checked": "boolean", "version": "number" }, "response": { "id": "string", "checked": "boolean", "version": "number" },
      "errors": [ { "status": 409, "when": "Item changed since the client's version" } ] },
    { "key": "list-stream", "service": "sync", "calledBy": ["mobile", "web"], "method": "GET", "path": "/households/{householdId}/stream",
      "summary": "Live item changes for a household", "auth": "user", "style": "realtime",
      "response": { "type": "item.changed", "listId": "string", "item": "object" }, "errors": [] }
  ],
  "events": [
    { "name": "item.changed", "producer": "lists", "consumers": ["sync"], "payload": { "listId": "string", "itemId": "string", "checked": "boolean", "version": "number" } }
  ]
}
```

**Our code**

- **Decisions:** each one is written to its node as it arrives, and progress shows "Reasoning 7/10".
- **Endpoint contracts:** each endpoint's request/response is copied onto the edge running from a
  `calledBy` component to its `service`.
  - `check-item` has no direct edge, because `mobile → lists` goes through the gateway. It goes on
    the client → gateway edge. See Issue 4.
- **Fingerprints:** the decision fingerprint for each node, and the API fingerprint, are stored.

**Result:** the panel shows every overview:

- Brief: requirements, with 2 assumptions highlighted.
- Design: the summary and 10 decisions with Gains / Costs.
- API: 3 endpoints and 1 event.

---

## Step 5 — Iteration: the user wants offline support

The user sees the assumption "The app needs a connection… (online only)" and, on the Sync service,
the revisit-when row "Members need the list without signal in the store". They press
**Require this**. No AI call yet.

**Our code**

```text
+ requirement  "Members need the list without signal in the store"   kind: functional, basis: stated
```

The conflicting assumption "online only" is now contradicted. See Issue 3.

| Stage | Stored | Current | State |
| --- | --- | --- | --- |
| 1 Requirements | `r2` | `r3` | out of date (see Issue 2) |
| 2 Components | `c1` | `c2` | out of date |
| 3 Decisions | per node | requirements are part of every decision fingerprint (see Issue 1) | all out of date |
| 4 API | `a1` | `a2` | out of date |

The update bar reads: "1 requirement changed · Components, reasoning and API will update —
Update design".

---

## Step 6 — Update (AI calls 14+)

1. Our code saves a version, "Before AI update".
2. **Components** runs with `previousKeys` set to the 9 existing keys. The expected response keeps
   all 9 keys and adds:
   - `mobile-store` (`clientstorage`, "Local copy of lists and pending changes")
   - `web-sw` (`serviceworker`, "Offline cache and change queue for the web app")
   - connections `mobile → mobile-store` and `web → web-sw`
   - a "Sync pending changes" path from the clients to the lists API
3. Our code applies the new graph. The 9 kept components keep their node ids. Hand edits since `g1`?
   None, so no warning appears.
4. **Decisions** run for all 12 nodes. The offline requirement changed what "right" means for
   existing components: the sync service must now merge queued offline edits. See Issue 1.
5. **API** runs again and is expected to add a batch endpoint such as
   `POST /lists/{listId}/changes`, which takes queued changes with client ids and versions.

---

## Issues found by this walkthrough

### Issue 1 — Reused decisions can go stale in meaning

**Problem.** If a decision's fingerprint covers only the component's identity (key, type,
neighbours), the sync service would keep its old reasoning after offline support was added. That
reasoning would say nothing about merging offline edits, so it would no longer be correct.

**Resolution.** A decision's fingerprint also covers the enabled requirements.

- **Consequence:** any requirement change regenerates every decision. That is one round of small
  calls running concurrently, so the wall-clock time is about one call.
- **Reuse still applies:** a hand edit to one node, or "Regenerate reasoning" on a node, re-runs
  only that node. Labels and descriptions stay out of the fingerprint, so renaming never triggers
  regeneration.

### Issue 2 — Requirement changes can raise new questions

**Problem.** Offline support raises a real question: when two members edit the same item offline,
whose change wins? Stage 2 cannot ask questions. If only stage 2 re-runs, the conflict policy gets
decided silently inside a decision. That contradicts "no default assumptions".

**Resolution.** When requirements change, Update runs stage 1 first, in additive mode.

- Its fingerprint covers prompt, scope and requirements, stored *after* its own merge so its output
  does not make it stale again.
- If it returns questions, the pipeline pauses for answers or "Assume for me".
- Here it would ask: "When two members change the same item offline, which change wins?"
- This reverses the earlier rule that editing requirements never re-runs stage 1. Additive mode is
  what makes that safe.

### Issue 3 — Contradicted assumptions

**Problem.** "Online only" and "needs the list without signal" are both enabled after Step 5.

**Resolution.** Stage 1's additive re-check also returns `conflicts`: pairs of requirement ids that
contradict each other, each with a suggested resolution. The panel shows them as a one-click choice
(for example, "Disable 'online only'"), and the pipeline waits for it, just as it waits for
questions.

### Issue 4 — Endpoints behind a gateway

**Problem.** Callers reach services through the gateway, so there is often no direct
`calledBy → service` edge to carry the contract.

**Resolution.** Our code follows the path from caller to service: the shortest directed path, using
the existing graph traversal utilities.

- The contract goes on the **first edge** of that path, the one the client actually calls.
- The API panel shows the full path when an endpoint is selected.
- If no path exists, the endpoint stays in the catalog and gets a warning: "No connection from Web
  app to Lists service".

### Issue 5 — Duplicate requirements from additive re-runs

**Problem.** A re-check can restate an existing requirement in different words.

**Resolution.** The prompt passes every settled requirement and answered question, and instructs
the model not to restate them. Our code drops exact duplicates (after trimming and ignoring case).
Near-duplicates may still appear, and the user can delete them. This is accepted; it is not worth
semantic matching.

---

## Fingerprint definitions

All fingerprints are computed over normalized content: text is trimmed and lowercased, and sets are
sorted.

| Fingerprint | Covers | Excludes (on purpose) |
| --- | --- | --- |
| Requirements (stage 1) | prompt, scope, enabled requirements (kind + text), answered questions; stored after the merge | ids, basis |
| Components (stage 2) | prompt, scope, enabled requirements | previous keys (a hint, not an input) |
| Decision (stage 3, per node) | enabled requirements, the node's key and type, its neighbours as (key, type, protocol, direction) | labels, descriptions |
| API (stage 4) | enabled requirements, component keys and types, connections (from, to, protocol, async) | labels, descriptions, decisions |
| Data model (stage 5) | enabled requirements, graph structure as for the API, endpoints (service, method, path) | wording |
| Generated graph | graph structure as for the API, at the time stage 2 applied | — |

Reverting an edit restores the earlier fingerprint, so the stage stops showing as out of date.
