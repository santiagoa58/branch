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
export const migrationEnvSchema = z.object({ DATABASE_URL_UNPOOLED: z.url() });
export const routeIdSchema = z.uuid();
export const migrationRowsSchema = z.array(
  z.strictObject({ name: z.string(), checksum: z.string() }),
);
