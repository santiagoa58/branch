import { z } from "zod";
import {
  architectureNodeTypeSchema,
  edgeProtocolSchema,
  groupNodeTypeSchema,
  httpMethodSchema,
} from "./catalogEnums";

// Contracts for the staged AI design pipeline (spec section 4) and the persisted brief (section 5).
// Schemas enforce only invariants that code or the feature's purpose depends on; length and count
// guidance lives in the prompts.

export const aiStageSchema = z.enum([
  "requirements",
  "components",
  "decisions",
  "api",
  "data-model",
]);

// Node keys double as React Flow node ids, so they must be stable, URL-safe slugs.
const keySchema = z.string().regex(/^[a-z][a-z0-9-]*$/);

// --- 4.1 Shared types ---

const scopeSchema = z.enum(["frontend", "backend", "fullstack"]);
const requirementKindSchema = z.enum(["functional", "nonFunctional", "constraint"]);
const nfrCategorySchema = z.enum([
  "scale",
  "latency",
  "availability",
  "consistency",
  "durability",
  "security",
  "cost",
  "other",
]);

export const designContextSchema = z.strictObject({
  prompt: z.string(),
  scope: scopeSchema,
  requirements: z.array(
    z.strictObject({
      kind: requirementKindSchema,
      text: z.string(),
      assumed: z.boolean(),
      category: nfrCategorySchema.exactOptional(),
    }),
  ),
  outOfScope: z.array(z.string()),
});

// --- 4.2 Stage 1: requirements ---

const requirementsInputSchema = z.strictObject({
  prompt: z.string(),
  scope: scopeSchema,
  requirements: z.array(z.strictObject({ kind: requirementKindSchema, text: z.string() })),
  outOfScope: z.array(z.string()),
  answers: z.array(
    z.strictObject({ question: z.string(), answer: z.string(), assumed: z.boolean() }),
  ),
});

const questionSchema = z
  .strictObject({
    id: z.string(),
    topic: z.string(),
    question: z.string(),
    why: z.string(),
    options: z.array(z.strictObject({ label: z.string(), impact: z.string() })),
    // Required: "Assume for me" answers the question with it.
    recommended: z.string(),
    allowsCustom: z.boolean(),
  })
  // An empty list is a free-text question; one option is not a choice.
  .refine((question) => question.options.length !== 1, {
    path: ["options"],
    message: "Give no options for a free-text answer, or at least two.",
  });

export const requirementsOutputSchema = z.strictObject({
  questions: z.array(questionSchema),
  requirements: z.array(
    z.strictObject({
      kind: requirementKindSchema,
      text: z.string(),
      category: nfrCategorySchema.exactOptional(),
    }),
  ),
  assumptions: z.array(z.strictObject({ kind: requirementKindSchema, text: z.string() })),
  outOfScope: z.array(z.string()),
});

// --- 4.3 Stage 2: components ---

const componentsInputSchema = z.strictObject({
  context: designContextSchema,
  previousKeys: z.array(z.string()),
});

export const componentsOutputSchema = z.strictObject({
  summary: z.string(),
  groups: z.array(
    z.strictObject({
      key: keySchema,
      type: groupNodeTypeSchema,
      label: z.string(),
      parent: z.string().exactOptional(),
    }),
  ),
  components: z.array(
    z.strictObject({
      key: keySchema,
      type: architectureNodeTypeSchema,
      label: z.string(),
      responsibility: z.string(),
      group: z.string().exactOptional(),
    }),
  ),
  connections: z.array(
    z.strictObject({
      from: z.string(),
      to: z.string(),
      protocol: edgeProtocolSchema,
      purpose: z.string(),
      async: z.boolean(),
    }),
  ),
  mainFlow: z.strictObject({ name: z.string(), description: z.string(), entry: z.string() }),
});

// --- 4.4 Stage 3: decisions (one call per node) ---

const decisionsInputSchema = z.strictObject({
  context: designContextSchema,
  summary: z.string(),
  node: z.strictObject({
    key: z.string(),
    type: z.union([architectureNodeTypeSchema, groupNodeTypeSchema]),
    label: z.string(),
    responsibility: z.string().exactOptional(),
  }),
  neighbours: z.array(
    z.strictObject({
      key: z.string(),
      type: z.string(),
      label: z.string(),
      protocol: edgeProtocolSchema,
      direction: z.enum(["in", "out"]),
    }),
  ),
});

export const decisionsOutputSchema = z.strictObject({
  choice: z.string(),
  reason: z.string(),
  // Without at least one gain and one cost there is no tradeoff to show.
  gains: z.array(z.string()).min(1),
  costs: z.array(z.string()).min(1),
  // A justification needs an alternative that was rejected.
  considered: z.array(z.strictObject({ option: z.string(), whyNot: z.string() })).min(1),
  revisitWhen: z.array(z.string()),
});

// --- 4.5 Stage 4: API ---

const graphSummarySchema = z.strictObject({
  nodes: z.array(z.strictObject({ key: z.string(), type: z.string(), label: z.string() })),
  edges: z.array(
    z.strictObject({
      from: z.string(),
      to: z.string(),
      protocol: edgeProtocolSchema,
      async: z.boolean(),
    }),
  ),
});

const apiInputSchema = z.strictObject({
  context: designContextSchema,
  summary: z.string(),
  graph: graphSummarySchema,
});

// Field name to type, as in template contracts.
const fieldMapSchema = z.record(z.string(), z.string());

const endpointSchema = z.strictObject({
  key: z.string(),
  service: z.string(),
  calledBy: z.array(z.string()),
  method: httpMethodSchema,
  path: z.string(),
  summary: z.string(),
  auth: z.enum(["none", "user", "service", "admin"]),
  style: z.enum(["request", "stream", "realtime"]),
  request: fieldMapSchema.exactOptional(),
  response: fieldMapSchema.exactOptional(),
  errors: z.array(z.strictObject({ status: z.number().int(), when: z.string() })),
});

const apiEventSchema = z.strictObject({
  name: z.string(),
  producer: z.string(),
  consumers: z.array(z.string()),
  payload: fieldMapSchema,
});

export const apiOutputSchema = z.strictObject({
  endpoints: z.array(endpointSchema),
  events: z.array(apiEventSchema),
});

// --- 4.6 Stage 5: data model ---

const dataModelInputSchema = z.strictObject({
  context: designContextSchema,
  graph: graphSummarySchema,
  endpoints: z.array(
    z.strictObject({ service: z.string(), method: httpMethodSchema, path: z.string() }),
  ),
});

const entitySchema = z.strictObject({
  name: z.string(),
  // Key of the component that owns the entity.
  store: z.string(),
  fields: z.array(
    z.strictObject({
      name: z.string(),
      type: z.string(),
      key: z.enum(["primary", "foreign", "index"]).exactOptional(),
    }),
  ),
  relations: z.array(
    z.strictObject({
      to: z.string(),
      kind: z.enum(["one-to-one", "one-to-many", "many-to-many"]),
    }),
  ),
});

const dataModelOutputSchema = z.strictObject({
  entities: z.array(entitySchema),
});

// --- Stage lookup ---

export const stageSchemas = {
  requirements: { input: requirementsInputSchema, output: requirementsOutputSchema },
  components: { input: componentsInputSchema, output: componentsOutputSchema },
  decisions: { input: decisionsInputSchema, output: decisionsOutputSchema },
  api: { input: apiInputSchema, output: apiOutputSchema },
  "data-model": { input: dataModelInputSchema, output: dataModelOutputSchema },
} as const satisfies Record<AiStage, { input: z.ZodType; output: z.ZodType }>;

// Pairs each stage with its contract. Indexing this mapped type by a generic stage keeps the
// correlation between the stage, its input and its output, so no type assertion is needed.
export const stageContracts: {
  [S in AiStage]: { input: z.ZodType<StageInput<S>>; output: z.ZodType<StageOutput<S>> };
} = {
  requirements: stageSchemas.requirements,
  components: stageSchemas.components,
  decisions: stageSchemas.decisions,
  api: stageSchemas.api,
  "data-model": stageSchemas["data-model"],
};

// --- 5. Persisted brief ---

export const designBriefSchema = z.strictObject({
  inputs: z.strictObject({
    prompt: z.string(),
    scope: scopeSchema,
    requirements: z.array(
      z.strictObject({ id: z.string(), kind: requirementKindSchema, text: z.string() }),
    ),
    outOfScope: z.array(z.strictObject({ id: z.string(), text: z.string() })),
    answers: z.array(
      z.strictObject({
        id: z.string(),
        question: z.string(),
        answer: z.string(),
        assumed: z.boolean(),
      }),
    ),
  }),
  // Stage 1 output (latest run)
  questions: z.array(questionSchema),
  requirements: requirementsOutputSchema.shape.requirements,
  assumptions: requirementsOutputSchema.shape.assumptions,
  outOfScope: z.array(z.string()),
  // Stage 2-5 output not stored on nodes and edges
  summary: z.string().exactOptional(),
  api: z
    .strictObject({ endpoints: z.array(endpointSchema), events: z.array(apiEventSchema) })
    .exactOptional(),
  dataModel: z.strictObject({ entities: z.array(entitySchema) }).exactOptional(),
  // Fingerprints each stage last ran from
  ranFrom: z.strictObject({
    requirements: z.string().exactOptional(),
    components: z.string().exactOptional(),
    decisions: z.string().exactOptional(),
    api: z.string().exactOptional(),
    dataModel: z.string().exactOptional(),
  }),
});

export type AiStage = z.infer<typeof aiStageSchema>;
export type StageInput<S extends AiStage> = z.infer<(typeof stageSchemas)[S]["input"]>;
export type StageOutput<S extends AiStage> = z.infer<(typeof stageSchemas)[S]["output"]>;
export type Scope = z.infer<typeof scopeSchema>;
export type RequirementKind = z.infer<typeof requirementKindSchema>;
export type DesignContext = z.infer<typeof designContextSchema>;
export type RequirementsInput = z.infer<typeof requirementsInputSchema>;
export type RequirementsOutput = z.infer<typeof requirementsOutputSchema>;
export type ComponentsInput = z.infer<typeof componentsInputSchema>;
export type ComponentsOutput = z.infer<typeof componentsOutputSchema>;
export type DecisionsInput = z.infer<typeof decisionsInputSchema>;
export type DecisionsOutput = z.infer<typeof decisionsOutputSchema>;
export type ApiInput = z.infer<typeof apiInputSchema>;
export type ApiOutput = z.infer<typeof apiOutputSchema>;
export type DataModelInput = z.infer<typeof dataModelInputSchema>;
export type DataModelOutput = z.infer<typeof dataModelOutputSchema>;
export type Endpoint = z.infer<typeof endpointSchema>;
export type DesignBrief = z.infer<typeof designBriefSchema>;
