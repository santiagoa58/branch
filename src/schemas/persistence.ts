import { z } from "zod";

const themeSchema = z.enum(["light", "dark", "system"]);

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
