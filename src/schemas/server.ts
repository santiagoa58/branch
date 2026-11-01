import { z } from "zod";

export const serverEnvSchema = z.object({
  DATABASE_URL: z.url(),
  CLERK_SECRET_KEY: z.string().min(1),
  VITE_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_AUTHORIZED_PARTIES: z
    .string()
    .min(1)
    .transform((value) => value.split(",").map((origin) => origin.trim()))
    .pipe(z.array(z.url()).min(1)),
});

// Kept apart from serverEnvSchema so auth and the database never depend on AI settings.
export const aiEnvSchema = z.object({
  AI_GATEWAY_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().min(1),
  AI_MODEL_REQUIREMENTS: z.string().min(1).optional(),
  AI_MODEL_COMPONENTS: z.string().min(1).optional(),
  AI_MODEL_DECISIONS: z.string().min(1).optional(),
  AI_MODEL_API: z.string().min(1).optional(),
  AI_MODEL_DATA_MODEL: z.string().min(1).optional(),
});
export type AiEnv = z.infer<typeof aiEnvSchema>;
export const routeIdSchema = z.uuid();

export const projectRouteParamsSchema = z.strictObject({ projectId: routeIdSchema });
export const diagramRouteParamsSchema = z.strictObject({ diagramId: routeIdSchema });
export const versionRouteParamsSchema = diagramRouteParamsSchema.extend({
  versionId: routeIdSchema,
});
