# AI System Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the browser-side OpenAI integration with a staged, server-side AI pipeline that
designs a system from user-owned inputs and keeps requirements, assumptions, reasoning, tradeoffs
and the API visible in a design panel.

**Architecture:**

- **Server:** a stateless Hono route, `POST /api/ai/:stage`, runs one structured-output
  `generateText` call per request through the Vercel AI Gateway.
- **Client:** decides which stages are out of date from two fingerprints (user inputs, graph
  structure), runs the pipeline, and applies each stage's output deterministically to the diagram
  and a persisted `brief`.
- **UI:** a docked design panel presents the brief in interview order.

**Tech Stack:** React 19, TypeScript, Zustand, React Flow v12, Hono, Zod 4, Vercel AI SDK
`ai@7.0.159` with `@ai-sdk/gateway@4.0.132`, Vitest via `vite-plus/test`, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-11-01-ai-system-design-design.md`. Section numbers below
(§n) refer to it.

## Global Constraints

**Dependencies and versions**

- Pin `ai@7.0.159` and `@ai-sdk/gateway@4.0.132`. Remove `openai`.

**Validation and trust boundaries**

- All untrusted data crosses a Zod schema in `src/schemas/`; no handwritten validators or type
  assertions at trust boundaries.
- AI request and response schemas live only in `src/schemas/aiDesign.ts`.
- Validation policy (§4): schemas enforce only invariants that code or the feature depends on, each
  with a reason comment. Length and count guidance goes in prompts, never in schemas.

**Server and secrets**

- Server modules (`server/**`) are never imported by browser code.
- Secrets are server-only env vars with no `VITE_` prefix.
- Every AI call passes the Clerk owner id as `providerOptions.gateway.user`.

**React Flow and diagram structure**

- Use `parentId`, never `parentNode`.
- Parent nodes come before their children in the nodes array.
- Every child node has `extent: 'parent'`.

**State and persistence**

- Simulation state stays ephemeral.
- No localStorage document fallback.
- `aiDesignStore` is never persisted and never in undo/redo.
- Document edits call `saveToHistory()` and `saveDiagram()`.

**Styling**

- Use `zinc-*`, never `gray-*`.
- Use `cn()` from `@/lib/utils`.
- Colours come from CSS variables in `src/index.css`.

**Tests and checks**

- Tests import from `vite-plus/test`.
- Server tests start with `// @vitest-environment node`.
- Every task ends with `pnpm check` and `pnpm test:run` passing.

## Review Focus

Each of these is tested in the task named.

1. **Editing while a pipeline runs.** Keyboard shortcuts, palette drops and inspector edits during a
   run must not change the diagram. A run's own applies must still land and save. (Task 3)
2. **Switching diagrams mid-run.** Results from a run started on another diagram are discarded, not
   applied to the newly opened one. (Task 10)
3. **Malformed stage 2 output.** Duplicate keys, keys equal to a comment node id, connections to
   group keys, self-loops, or zero components never corrupt the graph. Zero components leaves the
   diagram unchanged. (Task 8)
4. **Undo and reload.** Undoing past a generation restores the previous brief as well as the graph.
   Reloading a diagram without a brief, or importing JSON with an invalid brief, behaves as today or
   shows the existing import error. (Task 3)
5. **Partial stage 3 failure.** Decisions that succeeded are kept. The stage is not recorded as
   fresh, and Retry re-runs it. (Task 10)

---

## File Structure

| Path                                      | Responsibility                                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/schemas/aiDesign.ts`                 | Stage enum, shared types, stage input/output schemas, brief schema                       |
| `src/schemas/diagram.ts` (modify)         | `brief` on `diagramStructureSchema`                                                      |
| `src/types/index.ts` (modify)             | `DiagramData.brief`, `HistoryState.brief`                                                |
| `src/store/diagramStore.ts` (modify)      | Holds `brief`; AI-run edit guard; `applyAiResult` action                                 |
| `src/store/aiDesignStore.ts`              | Ephemeral run state                                                                      |
| `src/schemas/server.ts` (modify)          | `aiEnvSchema`                                                                            |
| `server/http/body.ts` (modify)            | `jsonBody(maxBytes)` factory                                                             |
| `server/ai/models.ts`                     | Model id per stage                                                                       |
| `server/ai/errors.ts`                     | Gateway error → HTTP status/message                                                      |
| `server/ai/runner.ts`                     | `AiStageRunner` interface and gateway implementation (`generateText` + one repair retry) |
| `server/ai/prompts/*.ts`                  | System and user prompt builders per stage                                                |
| `server/ai/examples/`                     | Few-shot example taken from a starter template                                           |
| `server/routes/ai.ts`                     | Route, validation, error mapping                                                         |
| `src/utils/aiDesign/fingerprint.ts`       | Normalization, fingerprints, out-of-date stages, next stage                              |
| `src/utils/aiDesign/inputs.ts`            | User actions as pure input edits; `buildDesignContext`                                   |
| `src/utils/aiDesign/applyRequirements.ts` | Apply stage 1 output                                                                     |
| `src/utils/aiDesign/applyComponents.ts`   | Apply stage 2 output                                                                     |
| `src/utils/aiDesign/applyResults.ts`      | Apply stages 3–5 output                                                                  |
| `src/services/api/ai.ts`                  | Client call per stage                                                                    |
| `src/hooks/useDesignPipeline.ts`          | Orchestration                                                                            |
| `src/components/ui/TradeoffList.tsx`      | Gains/Costs presentation                                                                 |
| `src/components/panels/design/*`          | Design panel (tabs, update bar, progress)                                                |
| `scripts/ai-eval.ts`, `server/ai/eval/*`  | Prompt evaluation harness                                                                |

---

### Task 1: Remove the existing AI integration

**Files:**

- Delete:
  - `src/services/ai/` (whole directory)
  - `src/store/aiStore.ts`
  - `src/types/ai.ts`
  - `src/schemas/ai.ts`
  - `src/components/panels/SettingsPanel.tsx`
- Modify:
  - `src/components/Navbar.tsx` (remove `SettingsPanel` import, `settingsOpen` state, the button
    that opens it, and the render at the bottom)
  - `src/components/CloudAuth.tsx` (remove the `useAIStore` import and the
    `clearSessionAnalysis()` call)
  - `src/schemas/persistence.ts` and `src/schemas/persistence.test.ts` (remove
    `aiProviderTypeSchema`, `aiModelSchema`, `aiSettingsSchema` and their tests)
  - `vite.config.ts:60` (remove the `src/services/ai/providers/openai.ts` entry)
  - `src/main.tsx` (add the one-time cleanup below)
  - `package.json` (remove `openai`)
- Test: `src/test/legacyAiCleanup.test.ts`

**Interfaces:**

- Produces: `removeLegacyAiSettings(storage: Pick<Storage, "removeItem">): void`, in
  `src/lib/legacyAiCleanup.ts`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vite-plus/test";
import { removeLegacyAiSettings } from "@/lib/legacyAiCleanup";

describe("removeLegacyAiSettings", () => {
  it("removes the stale ai-settings key", () => {
    const storage = { removeItem: vi.fn() };
    removeLegacyAiSettings(storage);
    expect(storage.removeItem).toHaveBeenCalledWith("ai-settings");
  });
  it("ignores storage that throws", () => {
    const storage = {
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => removeLegacyAiSettings(storage)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run** `pnpm test:run src/test/legacyAiCleanup.test.ts`. Expected: FAIL (module
      not found).
- [ ] **Step 3: Implement `removeLegacyAiSettings`** (try/catch around `removeItem("ai-settings")`).
      Call it once in `src/main.tsx` with `window.localStorage`. Then do the deletions and
      modifications listed above, and run `pnpm install` to update the lockfile.
- [ ] **Step 4: Verify the removal.**
  - Run `pnpm test:run`, then `pnpm check`. Expected: both pass.
  - Run `grep -rn "aiStore\|services/ai\|types/ai\|schemas/ai\|openai" src server`. Expected:
    `technologyIcons.ts` and the iconify files may mention "openai" as an icon name; no other
    matches.
- [ ] **Step 5: Commit**: `git commit -m "refactor!: remove the browser-side AI integration"`

---

### Task 2: AI design schemas and the persisted brief

**Files:**

- Create: `src/schemas/aiDesign.ts`
- Modify:
  - `src/schemas/diagram.ts`: add `brief: designBriefSchema.exactOptional()` to
    `diagramStructureSchema`
  - `src/types/index.ts`: add `brief?: DesignBrief` to `DiagramData`, and
    `brief?: DesignBrief | null` to `HistoryState`
- Test: `src/schemas/aiDesign.test.ts`

**Interfaces:**

- Consumes the enums `architectureNodeTypeSchema`, `groupNodeTypeSchema`, `edgeProtocolSchema` and
  `httpMethodSchema` from `src/schemas/diagram.ts`. These are the catalog's schema form;
  `nodeCatalog.test.ts` already keeps them in sync with `NODE_TYPES_CONFIG` and `PROTOCOL_CONFIG`.
- Produces (all exported, with inferred types of the same name in PascalCase):

  | Group             | Exports                                                                                                                                                                                                                                    |
  | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | Stage list        | `aiStageSchema = z.enum(["requirements","components","decisions","api","data-model"])`, type `AiStage`                                                                                                                                     |
  | Shared types      | `scopeSchema`, `requirementKindSchema`, `nfrCategorySchema`, `designContextSchema`                                                                                                                                                         |
  | Per-stage schemas | `requirementsInputSchema`/`requirementsOutputSchema`, `componentsInputSchema`/`componentsOutputSchema`, `decisionsInputSchema`/`decisionsOutputSchema`, `apiInputSchema`/`apiOutputSchema`, `dataModelInputSchema`/`dataModelOutputSchema` |
  | Lookup            | `stageSchemas: { [S in AiStage]: { input: ZodType; output: ZodType } }`; `StageInput<S>` and `StageOutput<S>` are the inferred types                                                                                                       |
  | Brief             | `designBriefSchema`, type `DesignBrief`, and `endpointSchema`, `apiEventSchema`, `entitySchema`                                                                                                                                            |

  Field shapes are exactly §4.1–4.6 and §5. `ranFrom` keys are
  `requirements | components | decisions | api | dataModel`.

- [ ] **Step 1: Write the failing tests**

```ts
describe("stage 1 output", () => {
  it("accepts a free-text question with no options", () => {
    expect(requirementsOutputSchema.safeParse(stage1({ options: [] })).success).toBe(true);
  });
  it("rejects a question with exactly one option", () => {
    expect(
      requirementsOutputSchema.safeParse(stage1({ options: [{ label: "A", impact: "x" }] }))
        .success,
    ).toBe(false);
  });
  it("requires a recommended answer", () => {
    expect(requirementsOutputSchema.safeParse(stage1({ recommended: undefined })).success).toBe(
      false,
    );
  });
});
describe("stage 3 output", () => {
  it.each(["gains", "costs", "considered"])("requires at least one %s", (field) => {
    expect(decisionsOutputSchema.safeParse({ ...decision, [field]: [] }).success).toBe(false);
  });
  it("allows an empty revisitWhen", () => {
    expect(decisionsOutputSchema.safeParse({ ...decision, revisitWhen: [] }).success).toBe(true);
  });
});
describe("stage 2 output", () => {
  it("rejects a non-slug key", () => {
    expect(componentsOutputSchema.safeParse(graphWithKey("Lists Service")).success).toBe(false);
  });
  it("rejects an unknown node type", () => {
    expect(componentsOutputSchema.safeParse(graphWithType("mainframe")).success).toBe(false);
  });
});
describe("diagram brief", () => {
  it("round-trips a diagram with a brief", () => {
    expect(diagramDataSchema.parse(withBrief).brief).toEqual(withBrief.brief);
  });
  it("still accepts a diagram without a brief", () => {
    expect(diagramDataSchema.safeParse({ nodes: [], edges: [] }).success).toBe(true);
  });
  it("rejects a brief whose inputs.scope is unknown", () => {
    expect(diagramDataSchema.safeParse(briefWithScope("mobile")).success).toBe(false);
  });
});
```

Fixture builders (`stage1`, `decision`, `graphWithKey`, `graphWithType`, `withBrief`,
`briefWithScope`) live at the top of the test file. Each returns a minimal valid object, with the
named field overridden.

- [ ] **Step 2: Run** `pnpm test:run src/schemas/aiDesign.test.ts`. Expected: FAIL (module not
      found).
- [ ] **Step 3: Implement the schemas.**
  - Use `z.strictObject` throughout.
  - Slug: `/^[a-z][a-z0-9-]*$/`.
  - The options rule is a refinement: length 0 or ≥ 2, with the comment
    `// one option is not a choice`.
  - `.min(1)` on `gains`, `costs` and `considered`, with the reasons from §4.4 as comments.
- [ ] **Step 4: Run** the test file, then `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -m "feat: define AI design stage contracts and the diagram brief"`

---

### Task 3: Brief in the diagram store, and the AI-run edit guard

**Files:**

- Create: `src/store/aiDesignStore.ts`
- Modify: `src/store/diagramStore.ts`
- Test: `src/store/diagramStore.brief.test.ts`

**Interfaces:**

- Produces from `aiDesignStore` (Zustand):

```ts
interface AiDesignState {
  running: boolean;
  stage: AiStage | null;
  decisions: { done: number; total: number };
  warnings: string[];
  errors: Partial<Record<AiStage, string>>;
  controller: AbortController | null;
  diagramId: string | null; // diagram the current run belongs to
  lastChange: { added: number; changed: number; removed: number } | null;
  start(diagramId: string): AbortSignal;
  setStage(stage: AiStage | null): void;
  setDecisionProgress(done: number, total: number): void;
  addWarnings(warnings: string[]): void;
  setError(stage: AiStage, message: string | null): void;
  setLastChange(change: AiDesignState["lastChange"]): void;
  finish(): void; // running=false, controller=null, stage=null
  cancel(): void; // aborts the controller, then finish()
}
```

- Produces from `diagramStore`:
  - State `brief: DesignBrief | null`.
  - `updateBrief(update: (brief: DesignBrief | null) => DesignBrief | null): void`. This is a user
    edit: it honours the guard, then saves history and the diagram.
  - `applyAiResult(next: { nodes?: Node[]; edges?: Edge[]; flows?: NamedFlow[]; brief: DesignBrief }): void`.
    This bypasses the guard and calls `saveDiagram()`. The first apply of a run pushes a history
    entry; later applies in the same run replace that entry, so a whole run is one undo step. The
    store tracks this with a private `aiRunHistoryOpen` flag, cleared by `aiDesignStore.finish()`.
  - `saveDiagram`, `hydrateDiagram`, `exportDiagram`, `importDiagram`, `undo`, `redo` and
    `saveToHistory` all carry `brief`. History entries store `brief` as well.

- [ ] **Step 1: Write the failing tests**

```ts
it("saves the brief with the diagram", () => {
  useDiagramStore.getState().hydrateDiagram({ nodes: [], edges: [], brief });
  useDiagramStore.getState().saveDiagram();
  expect(schedule).toHaveBeenCalledWith(expect.objectContaining({ brief }));
});
it("undo restores the previous brief", () => {
  hydrate({ brief: briefA });
  useDiagramStore.getState().updateBrief(() => briefB);
  useDiagramStore.getState().undo();
  expect(useDiagramStore.getState().brief).toEqual(briefA);
});
it("ignores user edits while an AI run is in progress", () => {
  useAiDesignStore.getState().start("d1");
  useDiagramStore.getState().addNode(node("x"));
  useDiagramStore.getState().updateBrief(() => briefB);
  expect(useDiagramStore.getState().nodes).toEqual([]);
  expect(useDiagramStore.getState().brief).toEqual(briefA);
});
it("applies AI results during a run, as one undo step, and saves each apply", () => {
  useAiDesignStore.getState().start("d1");
  useDiagramStore.getState().applyAiResult({ nodes: [node("x")], edges: [], brief: briefB });
  useDiagramStore
    .getState()
    .applyAiResult({ nodes: [node("x"), node("y")], edges: [], brief: briefC });
  expect(useDiagramStore.getState().nodes).toHaveLength(2);
  useAiDesignStore.getState().finish();
  useDiagramStore.getState().undo();
  expect(useDiagramStore.getState().nodes).toEqual([]);
  expect(useDiagramStore.getState().brief).toEqual(briefA);
  expect(schedule).toHaveBeenCalledTimes(3);
});
it("imports JSON with an invalid brief as an error", () => {
  expect(() =>
    useDiagramStore.getState().importDiagram({ nodes: [], edges: [], brief: { inputs: 1 } }),
  ).toThrow();
});
```

`schedule` is a `vi.spyOn(cloudWorkspace, "schedule")` with an active diagram stubbed, following
the existing setup in `diagramStore.test.ts`.

- [ ] **Step 2: Run** `pnpm test:run src/store/diagramStore.brief.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `setIfEditable` also returns early when `useAiDesignStore.getState().running`.
  - `useEditorShortcuts` and `useAutoFormat` treat `running` like `cloud.locked`.
  - In `DiagramEditor`, wrap the canvas container in `inert={running}`. The design panel (Task 13)
    is rendered outside that wrapper so Cancel stays usable.
- [ ] **Step 4: Run** `pnpm test:run`, then `pnpm check`. Expected: PASS, including the existing
      `diagramStore.test.ts`.
- [ ] **Step 5: Commit**: `git commit -m "feat: persist the design brief and lock edits during AI runs"`

---

### Task 4: AI route, configuration and gateway error mapping

**Files:**

- Create:
  - `server/ai/models.ts`
  - `server/ai/errors.ts`
  - `server/ai/runner.ts` (the interface only, in this task)
  - `server/routes/ai.ts`
- Modify:
  - `server/http/body.ts`
  - `server/handler.ts`
  - `server/types.ts`
  - `src/schemas/server.ts`
  - `scripts/dev.mjs` (forward the AI env)
  - `.env.example`
  - `api/[...path].ts`
- Test: `server/ai.test.ts`, `server/ai/errors.test.ts`

**Interfaces:**

- Produces:

```ts
// src/schemas/server.ts
export const aiEnvSchema: z.ZodObject<{
  AI_GATEWAY_API_KEY: optional string; AI_MODEL: string (min 1);
  AI_MODEL_REQUIREMENTS, AI_MODEL_COMPONENTS, AI_MODEL_DECISIONS, AI_MODEL_API, AI_MODEL_DATA_MODEL: optional string;
}>;
// server/ai/models.ts
export function modelFor(stage: AiStage, env: AiEnv): string;
// server/ai/runner.ts
export interface AiStageRunner {
  run<S extends AiStage>(stage: S, input: StageInput<S>, owner: string, signal: AbortSignal): Promise<StageOutput<S>>;
}
export class StageOutputTooLargeError extends Error {}
// server/ai/errors.ts
export function toAiHttpError(error: unknown): { status: 402 | 429 | 502; message: string; retryAfter?: string };
// server/http/body.ts
export function jsonBody(maxBytes: number): MiddlewareHandler<WorkspaceEnv>;
export const boundedJsonBody = jsonBody(MAX_BODY_BYTES);
// server/types.ts
interface HandlerDependencies { authenticate; repository; ai: AiStageRunner }
```

- Copy fixed by the spec (§7): `"AI budget reached"` and `"The design was too large to generate"`.
- The 413 message is generalized to `"Request is too large."`, keeping the 4 MB text for
  documents.
- The 502 message for other failures is `"The AI service is unavailable. Please retry."`.

- [ ] **Step 1: Write the failing route tests** (`server/ai.test.ts`)

These use `createHandler` with a stub `ai.run` and the existing `x-test-user` authenticate
pattern. The repository is unused, so `{} as never` is not allowed; pass
`new WorkspaceRepository({ query: vi.fn(), transaction: vi.fn() })`.

```ts
it("requires sign-in", async () =>
  expect((await post("/ai/requirements", valid, "")).status).toBe(401));
it("rejects an unknown stage", async () =>
  expect((await post("/ai/chat", valid)).status).toBe(404));
it("rejects input that fails the stage schema", async () =>
  expect((await post("/ai/requirements", { prompt: 1 })).status).toBe(400));
it("rejects non-JSON bodies", async () =>
  expect((await post("/ai/requirements", valid, "alice", "text/plain")).status).toBe(415));
it("returns 413 for an oversized body", async () =>
  expect((await post("/ai/requirements", huge)).status).toBe(413));
it("passes the owner to the runner and returns its output", async () => {
  run.mockResolvedValue(stage1Output);
  const response = await post("/ai/requirements", valid, "alice");
  expect(run).toHaveBeenCalledWith("requirements", valid, "alice", expect.any(AbortSignal));
  expect(await response.json()).toEqual(stage1Output);
});
it.each([
  [402, "AI budget reached"],
  [429, expect.any(String)],
  [502, "The design was too large to generate"],
])("maps runner failures to %i", async (status, message) => {
  /* run rejects with the matching error */
});
it("rejects GET and HEAD", async () => {
  /* 405 for both */
});
```

- [ ] **Step 2: Write the failing error-mapping tests** (`server/ai/errors.test.ts`)

```ts
it("maps a gateway 402 to 402", () => expect(toAiHttpError(gatewayError(402)).status).toBe(402));
it("maps a gateway 429 and forwards Retry-After", () =>
  expect(toAiHttpError(apiCallError(429, { "retry-after": "12" }))).toEqual({
    status: 429,
    message: expect.any(String),
    retryAfter: "12",
  }));
it("unwraps RetryError.lastError", () =>
  expect(toAiHttpError(retryError(gatewayError(402))).status).toBe(402));
it("maps truncation to 502 with the too-large message", () =>
  expect(toAiHttpError(new StageOutputTooLargeError())).toEqual({
    status: 502,
    message: "The design was too large to generate",
  }));
it("maps anything else to 502", () => expect(toAiHttpError(new Error("boom")).status).toBe(502));
```

The `gatewayError`, `apiCallError` and `retryError` helpers construct the real classes:
`GatewayError` subclasses from `@ai-sdk/gateway`, and `APICallError` and `RetryError` from `ai`.

- [ ] **Step 3: Run** `pnpm test:run server/ai.test.ts server/ai/errors.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implement.**
  - Add the `ai@7.0.159` and `@ai-sdk/gateway@4.0.132` dependencies.
  - **Error classification:** unwrap `RetryError.isInstance(e) ? e.lastError : e`, then read
    `statusCode` via `GatewayError.isInstance` or `APICallError.isInstance`. Read `retry-after`
    from `APICallError.responseHeaders`.
  - **Route:** `POST /ai/:stage`, validating the param with `aiStageSchema`; unknown stages return
    404 via `notFound`. Middleware order: `jsonBody(AI_MAX_BODY_BYTES)`, then a manual
    `stageSchemas[stage].input.safeParse` that returns 400, then the runner.
  - `AI_MAX_BODY_BYTES` starts equal to `MAX_BODY_BYTES` and is set from measurement in Task 16.
  - Abort with `c.req.raw.signal`.
  - Errors are thrown as `HttpError`. For 429, set `Retry-After` on the response.
  - `modelFor` returns the stage override if set, otherwise `AI_MODEL`.
  - `dev.mjs` merges `aiEnvSchema.parse(process.env)` into the forwarded env.
  - `.env.example` gets `AI_MODEL=provider/model-id` with a comment that the model is chosen during
    prompt evaluation, plus commented per-stage overrides.
  - `api/[...path].ts` passes `ai: createGatewayRunner()`, implemented in Task 5. In this task,
    export a placeholder from `runner.ts` that throws `"Not implemented"`.
- [ ] **Step 5: Run** both test files, then `pnpm test:run` and `pnpm check`. Expected: PASS.
- [ ] **Step 6: Commit**: `git commit -m "feat: add the AI stage route with gateway error mapping"`

---

### Task 5: Stage prompts and the gateway runner

**Files:**

- Create:
  - `server/ai/prompts/shared.ts`, `requirements.ts`, `components.ts`, `decisions.ts`, `api.ts`,
    `dataModel.ts`
  - `server/ai/examples/urlShortener.ts`
- Modify: `server/ai/runner.ts`
- Test: `server/ai/prompts.test.ts`, `server/ai/runner.test.ts`, `server/ai/examples.test.ts`

**Interfaces:**

- Produces:

```ts
// each prompt module
export function build<Stage>Prompt(input: StageInput<S>): { system: string; prompt: string };
export const stagePrompts: { [S in AiStage]: (input: StageInput<S>) => { system: string; prompt: string } };
// runner.ts
export function createGatewayRunner(deps?: { generate?: typeof generateText; env?: AiEnv }): AiStageRunner;
// examples
export const urlShortenerExample: { context: DesignContext; components: ComponentsOutput; decision: { key: string; output: DecisionsOutput }; api: ApiOutput };
```

**Prompt content.** These rules must appear verbatim in meaning; exact wording is tuned in prompt
evaluation.

- **Shared system preamble:** you are a senior engineer in a system design interview; output only
  what the schema asks for; design only for the given requirements; respect the scope definitions
  from §3.1.
- **Requirements:** the four prompt rules in §4.2.
- **Components:**
  - Use only the listed types and protocols.
  - Reuse `previousKeys` for components that still serve the same role.
  - Prompt guidance: the summary is two or three sentences.
  - The url-shortener example is included as the few-shot output.
- **Decisions:**
  - Explain this one component.
  - Gains and costs are short phrases; include only the most significant.
  - Every considered option has a why-not.
  - The example decision is included.
- **API:**
  - Endpoints are owned by `service` component keys.
  - `calledBy` lists component keys.
  - Field maps are `name → type`.
  - The example API is included.
- **Data model:** each entity's `store` is the key of the owning component.

- [ ] **Step 1: Write the failing prompt tests**

```ts
it("requirements prompt includes user lines, out-of-scope lines and answers", () => {
  const { prompt } = buildRequirementsPrompt(stage1Input);
  for (const text of ["Members share lists", "Ordering groceries", "About 1M households"])
    expect(prompt).toContain(text);
});
it("requirements prompt marks assumed answers", () =>
  expect(buildRequirementsPrompt(withAssumedAnswer).prompt).toMatch(/assumed/i));
it("components prompt lists previous keys and the example", () => {
  const { system, prompt } = buildComponentsPrompt(stage2Input);
  expect(prompt).toContain("lists-service");
  expect(system).toContain(urlShortenerExample.components.summary);
});
it("every stage has a prompt builder", () =>
  expect(Object.keys(stagePrompts).sort()).toEqual([...aiStageSchema.options].sort()));
```

- [ ] **Step 2: Write the failing runner tests** (stub `generate`)

```ts
it("calls the gateway with the stage model, schema and owner", async () => {
  await runner.run("decisions", input, "alice", signal);
  expect(generate).toHaveBeenCalledWith(
    expect.objectContaining({
      model: "test/decisions-model",
      abortSignal: signal,
      providerOptions: { gateway: { user: "alice" } },
    }),
  );
});
it("retries once with the validation error, then succeeds", async () => {
  generate
    .mockRejectedValueOnce(noObjectError("bad"))
    .mockResolvedValueOnce({ output: valid, finishReason: "stop" });
  await expect(runner.run("decisions", input, "alice", signal)).resolves.toEqual(valid);
  expect(generate.mock.calls[1][0].prompt).toContain("bad");
});
it("fails after the second schema failure", async () => {
  /* two rejections → rejects */
});
it("throws StageOutputTooLargeError on finishReason length", async () => {
  /* noObjectError with finishReason "length" */
});
```

- [ ] **Step 3: Write the failing example-drift test**

The example's components, connections and decisions must equal the values derived from the
`url-shortener` template in `src/templates/catalog/web.ts`:

- node ids → keys
- node `type` → component type
- edges → connections (from, to, protocol)
- the `api` node's decision → `decision.output`, mapped back (`benefits` → `gains`, `drawbacks` →
  `costs`)

Import the template from `@/templates` (test-only; server code imports only the example module).

- [ ] **Step 4: Run** `pnpm test:run server/ai`. Expected: FAIL.
- [ ] **Step 5: Implement.**
  - The runner calls `generate({ model: modelFor(stage, env), system, prompt, output: Output.object({ schema: stageSchemas[stage].output }), temperature: 0, abortSignal: signal, providerOptions: { gateway: { user: owner } } })`.
  - On `NoObjectGeneratedError`:
    - If `finishReason === "length"`, throw `StageOutputTooLargeError`.
    - Otherwise retry once, appending `"Your previous output was invalid: <error message>. Return output that matches the schema."` to the prompt.
  - Parse the final output with the stage schema.
  - Replace the placeholder from Task 4.
- [ ] **Step 6: Run** `pnpm test:run server`, then `pnpm check`. Expected: PASS.
- [ ] **Step 7: Commit**: `git commit -m "feat: build stage prompts and call the AI gateway"`

---

### Task 6: Fingerprints and stage freshness

**Files:**

- Create: `src/utils/aiDesign/fingerprint.ts`
- Test: `src/utils/aiDesign/fingerprint.test.ts`

**Interfaces:**

- Produces:

```ts
export function inputsFingerprint(inputs: DesignBrief["inputs"]): string;
export function graphFingerprint(nodes: Node[], edges: Edge[]): string;
export type PipelineStage = "requirements" | "components" | "decisions" | "api";
export function outdatedStages(
  brief: DesignBrief,
  nodes: Node[],
  edges: Edge[],
): {
  stages: PipelineStage[];
  dataModel: boolean;
};
export function nextStages(brief: DesignBrief, nodes: Node[], edges: Edge[]): PipelineStage[];
export function resultFingerprint(brief: DesignBrief, nodes: Node[], edges: Edge[]): string; // `${inputs}:${graph}`, recorded by stages 3–5
// nextStages: the first outdated stage and everything after it; [] if stage 1 has open questions and
// requirements is fresh. Stage 3/4 records are `${inputs}:${graph}`.
```

- **Normalization:** trim, lowercase, sort lists, drop ids.
- **Inputs fingerprint content:** `{ prompt, scope, requirements: [kind,text][], outOfScope: text[], answers: [question,answer,assumed][] }`.
- **Graph fingerprint content:** architecture and group nodes as `[id, type|groupType, parentId ?? ""]`, and edges as `[source, target, protocol ?? "", async ?? false]`.
- **Hash:** cyrb53 over `JSON.stringify` of the normalized value, returned as hex. It is synchronous
  and stable, and collisions are irrelevant at this scale.

- [ ] **Step 1: Write the failing tests**

```ts
it("ignores casing, whitespace, ids and order of requirement lines", () =>
  expect(inputsFingerprint(inputs({ requirements: [r("a", "Offline"), r("b", "Sync")] }))).toBe(
    inputsFingerprint(inputs({ requirements: [r("z", " sync "), r("y", "offline")] })),
  ));
it("changes when an answer changes", () =>
  expect(inputsFingerprint(withAnswer("1M"))).not.toBe(inputsFingerprint(withAnswer("10M"))));
it("reverting an edit restores the fingerprint", () => {
  /* edit then undo text → equal */
});
it("graph fingerprint ignores labels, descriptions, decisions, positions and comments", () => {
  /* … */
});
it("graph fingerprint changes when a protocol changes", () => {
  /* … */
});
it("new brief: every stage is next", () =>
  expect(nextStages(emptyBrief, [], [])).toEqual([
    "requirements",
    "components",
    "decisions",
    "api",
  ]));
it("open questions stop the pipeline after requirements", () =>
  expect(nextStages(freshStage1WithQuestions, [], [])).toEqual([]));
it("a hand edit to the graph re-runs decisions and api only", () =>
  expect(nextStages(allFresh, nodesWithNewEdge, edges)).toEqual(["decisions", "api"]));
it("an input edit re-runs everything", () =>
  expect(nextStages(allFreshThenEditedInputs, nodes, edges)).toEqual([
    "requirements",
    "components",
    "decisions",
    "api",
  ]));
it("data model is outdated but never in nextStages", () => {
  /* … */
});
```

- [ ] **Step 2: Run** `pnpm test:run src/utils/aiDesign/fingerprint.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the signatures above.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -m "feat: decide AI stage freshness from input and graph fingerprints"`

---

### Task 7: Input edits and the design context

**Files:**

- Create: `src/utils/aiDesign/inputs.ts`
- Test: `src/utils/aiDesign/inputs.test.ts`

**Interfaces:**

- Produces (all pure; each returns a new `DesignBrief`):

```ts
export function createBrief(
  prompt: string,
  scope: Scope,
  requirements: { kind; text }[],
  outOfScope: string[],
  newId: () => string,
): DesignBrief;
export function addRequirementLine(brief, kind: RequirementKind, text: string, newId): DesignBrief;
export function editRequirementLine(brief, id: string, text: string): DesignBrief;
export function removeRequirementLine(brief, id: string): DesignBrief;
export function addOutOfScopeLine(brief, text, newId): DesignBrief;
export function editOutOfScopeLine(brief, id, text): DesignBrief;
export function removeOutOfScopeLine(brief, id): DesignBrief;
export function answerQuestion(brief, question: string, answer: string, newId): DesignBrief; // replaces an existing answer to the same question
export function assumeRemaining(brief, newId): DesignBrief; // recommended answer, assumed: true, for each unanswered open question
export function confirmAssumption(brief, index: number, newId): DesignBrief; // adds assumption text as a requirement line of its kind
export function changeAssumption(brief, index: number, text: string, newId): DesignBrief;
export function removeDerivedRequirement(brief, index: number, newId): DesignBrief; // adds its text as an out-of-scope line
export function bringIntoScope(brief, index: number, newId): DesignBrief; // derived out-of-scope → functional requirement line
export function requireCondition(brief, text: string, newId): DesignBrief; // functional requirement line
export function buildDesignContext(brief): DesignContext; // §4.1 composition
export function requirementsInput(brief): RequirementsInput;
```

- [ ] **Step 1: Write the failing tests.** There is one test per action, asserting the exact change
      to `brief.inputs` and that stage outputs are untouched. Plus:

```ts
it("assumeRemaining answers only unanswered questions with their recommended answer", () => {
  const next = assumeRemaining(briefWith2QuestionsOneAnswered, ids());
  expect(next.inputs.answers).toEqual([
    answered,
    { id: "id-1", question: "How fresh?", answer: "Instantly", assumed: true },
  ]);
});
it("buildDesignContext merges user lines, derived requirements and assumptions", () => {
  expect(buildDesignContext(brief).requirements).toEqual([
    { kind: "functional", text: "Members share lists", assumed: false },
    { kind: "functional", text: "Check items off", assumed: false },
    { kind: "nonFunctional", text: "Online only", assumed: true },
  ]);
});
it("assumed answers appear as assumptions in the context", () => {
  /* … */
});
```

- [ ] **Step 2: Run** `pnpm test:run src/utils/aiDesign/inputs.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the signatures above.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -m "feat: express design brief actions as input edits"`

---

### Task 8: Apply stage output to the diagram

**Files:**

- Create:
  - `src/utils/aiDesign/applyRequirements.ts`
  - `src/utils/aiDesign/applyComponents.ts`
  - `src/utils/aiDesign/applyResults.ts`
- Test: `src/utils/aiDesign/apply.test.ts`

**Interfaces:**

- Consumes:
  - `archNode`, `groupNode`, `archEdge` from `src/templates/builders.ts`. Pass `attributes: []`
    so no illustrative attributes are invented.
  - `autoLayoutDiagram` from `src/utils/layout.ts`.
  - `inputsFingerprint` and `graphFingerprint` (Task 6).
- Produces:

```ts
export function applyRequirements(brief: DesignBrief, output: RequirementsOutput): DesignBrief; // also sets ranFrom.requirements
export const AI_FLOW_ID = "flow-ai-main";
export function applyComponents(
  current: { nodes: Node[]; edges: Edge[]; flows: NamedFlow[]; brief: DesignBrief },
  output: ComponentsOutput,
  now: string,
):
  | {
      ok: true;
      nodes: Node[];
      edges: Edge[];
      flows: NamedFlow[];
      brief: DesignBrief;
      warnings: string[];
    }
  | { ok: false; warnings: string[] }; // ok:false when no components remain; caller leaves the diagram unchanged
export function applyDecision(nodes: Node[], key: string, output: DecisionsOutput): Node[];
export function applyApi(brief: DesignBrief, output: ApiOutput, ranFrom: string): DesignBrief;
export function applyDataModel(
  brief: DesignBrief,
  output: DataModelOutput,
  ranFrom: string,
): DesignBrief;
export function unknownEndpointRefs(brief: DesignBrief, nodes: Node[]): Set<string>; // endpoint keys with unknown service/calledBy
```

- **Stage 2 cleanup rules,** each producing a human-readable warning:
  - drop later duplicates of a key
  - drop keys equal to a comment node id
  - drop groups whose parent is unknown or forms a cycle (detach the parent)
  - drop components whose group is unknown (place them at the top level)
  - drop connections whose endpoints are not component keys, including group keys
  - drop self-loops
  - drop the main flow if its entry is unknown
- **Edges:** id `ai-${from}-${to}-${index}`, data `{ protocol, label: purpose, async }`.
- **Flows:** keep saved flows whose `sourceNodeId` and `edgeIds` all still exist. Replace any flow
  with id `flow-ai-main`; its colour is the same one `defineTemplate` uses for templates.
- **Order:** groups are emitted parents-first, then components.
- **Fingerprints:** `brief.ranFrom.components = inputsFingerprint(brief.inputs)`.

- [ ] **Step 1: Write the failing tests**

```ts
it("drops derived items that duplicate a user line", () => {
  /* "members share lists" vs "Members share lists " */
});
it("builds groups before children with parentId and extent parent", () => {
  const r = ok(applyComponents(current, outputWithNestedGroups, NOW));
  const ids = r.nodes.map((n) => n.id);
  expect(ids.indexOf("backend")).toBeLessThan(ids.indexOf("lists"));
  expect(r.nodes.find((n) => n.id === "lists")).toMatchObject({
    parentId: "backend",
    extent: "parent",
  });
});
it("keeps comment nodes and valid saved flows, replaces the AI flow", () => {
  /* … */
});
it.each([
  ["duplicate keys", dupKeys],
  ["comment id collision", commentCollision],
  ["group endpoint", edgeToGroup],
  ["self-loop", selfLoop],
  ["group cycle", groupCycle],
  ["unknown flow entry", badFlow],
])("cleans %s with a warning", (_name, output) => {
  const r = ok(applyComponents(current, output, NOW));
  expect(r.warnings.length).toBeGreaterThan(0);
  expect(() =>
    diagramDataSchema.parse({ nodes: r.nodes, edges: r.edges, flows: r.flows }),
  ).not.toThrow();
});
it("returns ok:false when no components remain", () =>
  expect(applyComponents(current, noComponents, NOW).ok).toBe(false));
it("maps a decision onto DesignDecision fields", () => {
  expect(
    applyDecision(nodes, "sync", decision).find((n) => n.id === "sync")?.data.decision,
  ).toEqual({
    choice: decision.choice,
    reason: decision.reason,
    benefits: decision.gains,
    drawbacks: decision.costs,
    considered: decision.considered,
    revisitWhen: decision.revisitWhen,
  });
});
it("flags endpoints whose service is unknown", () =>
  expect(unknownEndpointRefs(briefWithEndpointTo("ghost"), nodes)).toEqual(new Set(["e1"])));
```

- [ ] **Step 2: Run** `pnpm test:run src/utils/aiDesign/apply.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the signatures above.
- [ ] **Step 4: Run** the tests, then `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -m "feat: apply AI stage output deterministically to the diagram"`

---

### Task 9: Client API for AI stages

**Files:**

- Create: `src/services/api/ai.ts`
- Modify: `src/services/api/index` exports, if an index exists (follow `versions.ts`)
- Test: `src/services/api/ai.test.ts`

**Interfaces:**

- Produces:
  `aiApi.run<S extends AiStage>(stage: S, input: StageInput<S>, signal: AbortSignal): Promise<StageOutput<S>>`.
  It is built from `serializeJsonRequest`, `sendApiRequest` and `readJsonResponse` with
  `stageSchemas[stage]`.
- Errors surface as `ApiError` with the server status. The `Retry-After` value is not needed on the
  client; the panel shows the server message.

- [ ] **Step 1: Write the failing tests** (mock `fetch` and `getApiToken`, as in
      `src/services/api.test.ts`)

```ts
it("posts to /api/ai/<stage> and returns the validated output", async () => {
  /* … */
});
it("rejects an output that fails the stage schema", async () => {
  await expect(aiApi.run("decisions", input, signal)).rejects.toBeInstanceOf(
    ApiResponseValidationError,
  );
});
it("surfaces a 402 as ApiError with status 402", async () => {
  /* … */
});
```

- [ ] **Step 2: Run** the test file. Expected: FAIL.
- [ ] **Step 3: Implement** `aiApi.run`.
- [ ] **Step 4: Run** the test file. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -m "feat: call AI stages from the browser"`

---

### Task 10: Pipeline orchestration

**Files:**

- Create: `src/hooks/useDesignPipeline.ts`
- Modify: `src/services/notify.ts`, adding `button?: { title: string; onClick: () => void }` mapped
  to sileo's `button`
- Test: `src/hooks/useDesignPipeline.test.tsx`

**Interfaces:**

- Consumes: Tasks 3 and 6–9.
- Produces:

```ts
export function useDesignPipeline(): {
  update(): Promise<void>; // runs nextStages()
  regenerateDecision(nodeId: string): Promise<void>;
  generateDataModel(): Promise<void>;
  retry(stage: AiStage): Promise<void>; // re-runs from that stage
  cancel(): void;
};
export async function runPipeline(
  deps: PipelineDeps,
  options?: { decisionConcurrency?: number },
): Promise<void>; // pure-ish core, tested directly
interface PipelineDeps {
  api: Pick<typeof aiApi, "run">;
  diagram: () => {
    id: string | null;
    nodes: Node[];
    edges: Edge[];
    flows: NamedFlow[];
    brief: DesignBrief;
  };
  apply: (next: Parameters<DiagramStore["applyAiResult"]>[0]) => void;
  createVersion: (label: string) => Promise<unknown>; // cloudWorkspace.createVersion
  run: AiDesignState; // aiDesignStore actions
  now: () => string;
}
```

**Behaviour.** This is the order and the rules the tests pin.

- **Stage 1.** Run it, then apply. If it returned questions, stop.
- **Before stage 2.**
  - If the diagram already has architecture nodes, call `createVersion("Before AI update")`.
  - Snapshot the current nodes and edges for the change summary.
- **Stage 2.** Apply.
  - On `ok: false`, set the error `"The AI returned no usable components"` and stop.
- **Stages 3 and 4 run concurrently.**
  - Stage 3 uses `decisionConcurrency`, default `Infinity` (tuned in Task 16).
  - Each decision is applied as it arrives, with `setDecisionProgress` updated.
  - `ranFrom.decisions` is recorded only if every node succeeded. Otherwise the stage error is set
    to `"Reasoning failed for N components"`.
- **Discarding stale results.** Before every apply, if the run was cancelled, or
  `diagram().id !== run.diagramId`, discard the result and stop.
- **Errors.** Each error message is the server message (`ApiError.message` after the prefix), keyed
  by stage.
- **Change summary.** On completion, call `diffDiagrams(snapshot, current)` and
  `setLastChange(counts)`, then show
  `notify.success({ title: "Design updated", message: "+A added · C changed · R removed", button: { title: "Undo", onClick: undo } })`.
  Undo reverts the whole run (graph and brief), because a run is one history entry (Task 3).

- [ ] **Step 1: Write the failing tests** (`runPipeline` with fake deps)

```ts
it("stops after requirements when questions are open", async () => {
  api.run.mockResolvedValueOnce(stage1WithQuestions);
  await runPipeline(deps);
  expect(api.run).toHaveBeenCalledTimes(1);
});
it("runs components then decisions and api concurrently", async () => {
  /* assert call order and that api started before all decisions resolved */
});
it("saves a version before replacing an existing graph", async () => {
  expect(createVersion).toHaveBeenCalledWith("Before AI update");
  expect(createVersion.mock.invocationCallOrder[0]).toBeLessThan(applyComponentsCallOrder());
});
it("does not save a version for a first design", async () => {
  /* … */
});
it("discards results when the diagram changes mid-run", async () => {
  api.run.mockImplementationOnce(async () => {
    current.id = "other";
    return stage1Ready;
  });
  await runPipeline(deps);
  expect(apply).not.toHaveBeenCalled();
});
it("keeps successful decisions but leaves the stage outdated when one fails", async () => {
  // 3 nodes; one decision rejects
  expect(nodeDecisions()).toHaveLength(2);
  expect(lastBrief().ranFrom.decisions).toBeUndefined();
  expect(run.errors.decisions).toBe("Reasoning failed for 1 components");
});
it("leaves the diagram unchanged when stage 2 has no usable components", async () => {
  /* … */
});
it("cancel aborts in-flight requests and applies nothing further", async () => {
  /* … */
});
```

- [ ] **Step 2: Run** `pnpm test:run src/hooks/useDesignPipeline.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** `runPipeline`, and the hook that binds it to the stores and
      `cloudWorkspace`.
- [ ] **Step 4: Run** the tests, then `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -m "feat: orchestrate the AI design pipeline"`

---

### Task 11: UI mockup review (checkpoint)

**Files:**

- Create: an Artifact, not repository code.

**Deliverable.** A clickable mockup of §9 using the grocery example from Appendix A:

- composer
- questions
- Brief tab with requirements, assumptions and out of scope
- Design tab with the tradeoff presentation
- API tab
- update bar and progress stepper
- node inspector additions

- [ ] **Step 1:** Publish the mockup, and ask the user to review layout and copy.
- [ ] **Step 2:** Record agreed changes as edits to §9 of the spec, and commit
      `docs: refine the AI design panel after mockup review`.
- [ ] **Step 3:** Do not start Task 12 until the user approves.

---

### Task 12: Tradeoff presentation

**Files:**

- Create: `src/components/ui/TradeoffList.tsx`
- Modify:
  - `src/index.css`: add `--tradeoff-gain` and `--tradeoff-cost` under `:root` and `.dark`, and
    map them to `--color-tradeoff-gain` and `--color-tradeoff-cost` in the theme block
  - `src/components/ui/DesignDecisionSummary.tsx`: replace the Benefits/Drawbacks columns
  - `src/components/ui/DesignDecisionEditor.tsx`: rename labels to "Gains" and "Costs"
  - `src/components/ui/DesignDecisionEditor.test.tsx` and `DesignDecisionSummary.test.tsx`: update
    the label assertions
- Test: `src/components/ui/TradeoffList.test.tsx`

**Interfaces:**

- Produces: `TradeoffList({ gains: string[]; costs: string[] })`.
  - Two `<section>`s, labelled "Gains" and "Costs".
  - Each item has an `aria-hidden` marker (`+` or `−`) coloured with
    `text-tradeoff-gain`/`text-tradeoff-cost`, and a 2px leading rule in the same token.
  - Item text uses `text-foreground`.
  - `@xs:grid-cols-2` when both lists are non-empty.

**Colour values.** Choose oklch values that meet WCAG AA (3:1 for the marker against `--card`) in
both themes, and record them in the CSS:

- gain: cool blue, hue about 240
- cost: warm amber, hue about 70

- [ ] **Step 1: Write the failing tests**

```ts
it("labels the two sides Gains and Costs", () => {
  render(<TradeoffList gains={["Fast"]} costs={["Stale reads"]} />);
  expect(screen.getByRole("region", { name: "Gains" })).toHaveTextContent("Fast");
  expect(screen.getByRole("region", { name: "Costs" })).toHaveTextContent("Stale reads");
});
it("marks items with + and − so meaning does not rely on colour", () => { /* markers present, aria-hidden */ });
it("omits an empty side", () => { /* only Gains region rendered */ });
```

- [ ] **Step 2: Run** the test file. Expected: FAIL.
- [ ] **Step 3: Implement**, and update the two existing components and their tests.
- [ ] **Step 4: Run** `pnpm test:run src/components/ui`, then `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -m "feat: present decisions as gains and costs"`

---

### Task 13: Design panel, Brief tab and entry points

**Files:**

- Create:
  - `src/components/panels/design/DesignPanel.tsx` (tabs, out-of-date dots)
  - `src/components/panels/design/BriefTab.tsx` (composer, questions, requirements, assumptions,
    out of scope)
  - `src/components/panels/design/UpdateBar.tsx` (update bar and progress stepper)
- Modify:
  - `src/components/DiagramEditor.tsx`: a "Design with AI" `ToolbarButton`, a "Design with AI"
    button beside "Browse starter templates", and the panel rendered outside the `inert` canvas
    wrapper
- Test: `src/components/panels/design/BriefTab.test.tsx`,
  `src/components/panels/design/UpdateBar.test.tsx`

**Interfaces:**

- Consumes:
  - `useDesignPipeline` (Task 10)
  - input edits (Task 7) via `diagramStore.updateBrief`
  - `outdatedStages` (Task 6)
  - `useAiDesignStore`
- Signed-out users: the entry points open the existing sign-in flow (as `CloudAuth` does).

**Copy fixed by the spec:**

| Element                              | Text                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------- |
| Composer button                      | "Start design"                                                                         |
| Question actions                     | "Continue", "Assume the rest for me"                                                   |
| Assumption actions                   | "Confirm", "Change"                                                                    |
| Derived requirement action           | "Remove"                                                                               |
| Derived out-of-scope action          | "Bring into scope"                                                                     |
| Update bar action                    | "Update design"                                                                        |
| Update bar message                   | "Requirements, components, reasoning and API will update" (built from the stage names) |
| Update bar, when components will run | "The current design is replaced; a version is saved first."                            |
| Progress                             | "Requirements → Components → Reasoning d/t → API", with "Cancel"                       |
| Stage errors                         | Error text, with "Retry"                                                               |

- [ ] **Step 1: Write the failing tests**

```ts
it("Start design creates the brief from the composer and runs the update", async () => {
  /* updateBrief called with createBrief(...); update() called */
});
it("Continue is disabled until every question has an answer", () => {
  /* … */
});
it("Assume the rest for me records assumed answers and runs the update", () => {
  /* … */
});
it.each(["Confirm", "Change", "Remove", "Bring into scope"])("%s edits the inputs", (label) => {
  /* asserts the matching Task 7 function result */
});
it("user lines are shown verbatim and are editable", () => {
  /* … */
});
it("update bar names the stages that will run and warns about replacement", () => {
  /* … */
});
it("progress shows reasoning d/t and Cancel calls cancel()", () => {
  /* … */
});
it("a failed stage shows its error and Retry", () => {
  /* … */
});
```

- [ ] **Step 2: Run** the test files. Expected: FAIL.
- [ ] **Step 3: Implement.** Follow the existing panel styling (`FlowsPanel` is the closest
      docked-panel precedent).
- [ ] **Step 4: Run** `pnpm test:run`, then `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -m "feat: add the design panel with the brief and update bar"`

---

### Task 14: Design, API and Data model tabs; change highlight

**Files:**

- Create:
  - `src/components/panels/design/DesignTab.tsx`
  - `src/components/panels/design/ApiTab.tsx`
  - `src/components/panels/design/DataModelTab.tsx`
- Modify:
  - `src/components/panels/design/DesignPanel.tsx`
  - `src/components/nodes/ArchitectureNode.tsx`: a transient highlight class driven by
    `useAiDesignStore.highlight`
- Test: `src/components/panels/design/tabs.test.tsx`

**Interfaces:**

- `aiDesignStore` gains `highlight: Set<string>` (node ids) and `setHighlight(ids: string[]): void`.
  Task 10's completion handler sets it to the added and changed ids and clears it after 4 seconds.
- Selecting an endpoint sets `highlight` to its `service` and `calledBy` ids.
- Selecting a component calls `setSelectedNode`.

- [ ] **Step 1: Write the failing tests**

```ts
it("Design tab lists every node with choice and tradeoffs, and selects on click", () => {
  /* … */
});
it("API tab groups endpoints by service with method, path, auth, style, fields and errors", () => {
  /* … */
});
it("API tab flags endpoints with unknown components", () => {
  /* uses unknownEndpointRefs */
});
it("selecting an endpoint highlights its service and callers", () => {
  /* … */
});
it("Data model tab shows Generate data model, then entities, and an outdated dot when stale", () => {
  /* … */
});
```

- [ ] **Step 2: Run** the test file. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test:run`, then `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -m "feat: show design reasoning, API and data model in the panel"`

---

### Task 15: Node inspector additions

**Files:**

- Modify:
  - `src/components/panels/NodePropertiesPanel.tsx` (Decision tab)
  - `src/components/panels/PropertiesPanel.tsx` (group Decision tab)
- Test: `src/components/panels/NodePropertiesPanel.ai.test.tsx`

**Interfaces:**

- Adds "Regenerate reasoning", which calls `regenerateDecision(node.id)`.
- When `brief` exists, each "Revisit when" item gets a "Require this" button that calls
  `updateBrief((b) => (b ? requireCondition(b, text, newId) : b))`.

- [ ] **Step 1: Write the failing tests**

```ts
it("shows Require this on revisit-when items only when a brief exists", () => {
  /* … */
});
it("Require this adds the condition as a requirement line", () => {
  /* brief.inputs.requirements gains it */
});
it("Regenerate reasoning calls the pipeline for this node", () => {
  /* … */
});
```

- [ ] **Step 2: Run** the test file. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test:run`, then `pnpm check`. Expected: PASS.
- [ ] **Step 5: Commit**: `git commit -m "feat: require revisit conditions and regenerate reasoning from the inspector"`

---

### Task 16: Prompt evaluation harness and measured limits

**Files:**

- Create:
  - `server/ai/eval/fixtures.ts`
  - `server/ai/eval/checks.ts`
  - `scripts/ai-eval.ts`
- Modify:
  - `package.json` (script `"eval:ai": "node --env-file=.env.local --experimental-strip-types scripts/ai-eval.ts"`)
  - `server/routes/ai.ts` (`AI_MAX_BODY_BYTES`)
  - `src/hooks/useDesignPipeline.ts` (default `decisionConcurrency`)
  - `vercel.json` (`functions["api/[...path].ts"].maxDuration`)
- Test: `server/ai/eval/checks.test.ts`

**Interfaces:**

- Produces:

```ts
export interface EvalCase { id: string; scope: Scope; kind: "vague" | "partial" | "complete" | "conflicting"; input: RequirementsInput;
  expect: { asks: boolean; mustInclude?: { types?: ArchitectureNodeType[]; protocols?: EdgeProtocol[] } } }
export const evalCases: EvalCase[];   // ≥ 2 per kind across all three scopes, drawn from docs/system-design-capability-audit.md
export function checkRequirements(c: EvalCase, out: RequirementsOutput): string[];   // failures: asks/doesn't, re-asks answered, missing recommended
export function checkComponents(c: EvalCase, out: ComponentsOutput): string[];       // mustInclude types/protocols present
export function checkDecisions(nodeKeys: string[], outs: Record<string, DecisionsOutput>): string[];   // a decision for every node
```

- `scripts/ai-eval.ts` runs each case through `createGatewayRunner()`, for stage 1 and then (when
  it doesn't ask) stages 2–4. It prints each case's failures, output bytes, input bytes and latency,
  and exits non-zero on any failure.

- [ ] **Step 1: Write the failing tests** for each check function, using hand-written outputs (one
      passing and one failing per rule).
- [ ] **Step 2: Run** `pnpm test:run server/ai/eval`. Expected: FAIL.
- [ ] **Step 3: Implement** the checks, the fixtures and the script.
- [ ] **Step 4: Stand-in run.**
  - For each case, build the stage prompts with `stagePrompts` and send them to a small, fast
    subagent model.
  - Validate the reply with the stage output schema and the check functions.
  - Record the results (pass/fail per case, sizes) in `server/ai/eval/RESULTS.md`.
- [ ] **Step 5: Set measured values.**
  - `AI_MAX_BODY_BYTES` = largest measured stage input × 4, rounded up to the next 64 KB.
  - `maxDuration` = slowest measured stage × 3, rounded up to 10 s. Raise it after gateway
    measurements if needed.
  - `decisionConcurrency` stays `Infinity` unless the gateway run shows rate limiting.
  - Add a one-line comment on each value giving its source measurement.
- [ ] **Step 6: Run** `pnpm test:run`, then `pnpm check`. Expected: PASS.
- [ ] **Step 7: Commit**: `git commit -m "test: add AI prompt evaluation harness and measured limits"`

Iterative prompt tuning (system, stage and user prompts) follows this task as its own activity.
It uses `pnpm eval:ai` once a gateway key is available, and the stand-in runs until then.

---

### Task 17: Documentation

**Files:**

- Modify:
  - `docs/api.md`: the `/api/ai/:stage` row, status codes, and the Vercel setup (AI Gateway team
    budget, default per-user budget, optional Firewall rule on `/api/ai/*`)
  - `README.md`: replace the "AI Integration (OpenAI)" section and the client-side-key statements
  - `AGENTS.md`: replace the AI hard rule with the text in §11

- [ ] **Step 1:** Make the edits.
- [ ] **Step 2: Run** `pnpm check` (the formatter covers Markdown). Expected: PASS.
- [ ] **Step 3:** Run `grep -rn "client-side only\|OpenAI SDK\|AIProvider" README.md AGENTS.md`.
      Expected: no matches.
- [ ] **Step 4: Commit**: `git commit -m "docs: document the AI design pipeline and its Vercel setup"`
