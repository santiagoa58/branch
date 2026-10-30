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
export const routeIdSchema = z.uuid();

export const projectRouteParamsSchema = z.strictObject({ projectId: routeIdSchema });
export const diagramRouteParamsSchema = z.strictObject({ diagramId: routeIdSchema });
export const versionRouteParamsSchema = diagramRouteParamsSchema.extend({
  versionId: routeIdSchema,
});
