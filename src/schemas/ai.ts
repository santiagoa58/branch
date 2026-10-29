import { z } from "zod";
import { edgeProtocolSchema } from "./diagram";

const completionChoiceSchema = z.object({
  message: z.object({ content: z.string().trim().min(1) }),
});

export const completionTextResponseSchema = z
  .object({ choices: z.tuple([completionChoiceSchema]).rest(completionChoiceSchema) })
  .transform(({ choices: [choice] }) => choice.message.content);

const issueSchema = z
  .strictObject({
    id: z.string().min(1),
    severity: z.enum(["critical", "warning", "info"]),
    category: z.enum(["security", "performance", "reliability", "scalability"]),
    title: z.string().min(1),
    description: z.string(),
    affectedNodes: z.array(z.string()),
    suggestedFix: z.string().optional(),
  })
  .transform(({ suggestedFix, ...issue }) =>
    suggestedFix === undefined ? issue : { ...issue, suggestedFix },
  );

const recommendationSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  effort: z.enum(["low", "medium", "high"]),
});

export const architectureAnalysisResponseSchema = z
  .strictObject({
    summary: z.string().min(1),
    score: z.number().min(0).max(100),
    issues: z.array(issueSchema),
    recommendations: z.array(recommendationSchema),
  })
  .transform((analysis) => ({
    ...analysis,
    analyzedAt: new Date(),
  }));

const suggestedProtocolSchema = z
  .union([edgeProtocolSchema, z.literal("https")])
  .transform((protocol) => (protocol === "https" ? "http" : protocol));

const connectionSuggestionSchema = z.strictObject({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  protocol: suggestedProtocolSchema,
  reason: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export const connectionSuggestionsResponseSchema = z.strictObject({
  suggestions: z.array(connectionSuggestionSchema),
});

export type ArchitectureAnalysisResponse = z.infer<typeof architectureAnalysisResponseSchema>;
export type ConnectionSuggestionsResponse = z.infer<typeof connectionSuggestionsResponseSchema>;
