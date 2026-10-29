import { z } from "zod";

export const aiProviderTypeSchema = z.enum(["openai", "anthropic"]);
export const aiModelSchema = z.enum([
  "gpt-4",
  "gpt-4-turbo",
  "gpt-3.5-turbo",
  "claude-3-opus",
  "claude-3-sonnet",
]);

export const aiSettingsSchema = z
  .object({
    provider: aiProviderTypeSchema,
    apiKey: z.string().nullable(),
    model: aiModelSchema,
  })
  .strict();

const analysisIssueSchema = z
  .object({
    id: z.string(),
    severity: z.enum(["critical", "warning", "info"]),
    category: z.enum(["security", "performance", "reliability", "scalability"]),
    title: z.string(),
    description: z.string(),
    affectedNodes: z.array(z.string()),
    suggestedFix: z.string().optional(),
  })
  .strict()
  .transform(({ suggestedFix, ...issue }) =>
    suggestedFix === undefined ? issue : { ...issue, suggestedFix },
  );

const recommendationSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    priority: z.enum(["high", "medium", "low"]),
    effort: z.enum(["low", "medium", "high"]),
  })
  .strict();

export const persistedArchitectureAnalysisSchema = z
  .object({
    summary: z.string(),
    score: z.number().min(0).max(100),
    issues: z.array(analysisIssueSchema),
    recommendations: z.array(recommendationSchema),
    analyzedAt: z.union([z.date(), z.iso.datetime().transform((value) => new Date(value))]),
  })
  .strict();

export const analysisCacheSchema = z
  .object({
    diagramHash: z.string(),
    analysis: persistedArchitectureAnalysisSchema,
    expiresAt: z.number(),
  })
  .strict();

export const themeSchema = z.enum(["light", "dark", "system"]);

export const themeStateSchema = z.strictObject({ theme: themeSchema });

export const persistedThemeStoreSchema = z
  .object({
    state: themeStateSchema,
    version: z.number().optional(),
  })
  .strict();

export const onboardingStateSchema = z
  .object({
    completedSteps: z
      .object({
        "add-node": z.boolean(),
        "connect-nodes": z.boolean(),
        "set-contract": z.boolean(),
        "run-flow-sim": z.boolean(),
      })
      .strict(),
    dismissed: z.boolean(),
    initialized: z.boolean(),
  })
  .strict();

export type Theme = z.infer<typeof themeSchema>;
