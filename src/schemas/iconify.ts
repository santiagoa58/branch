import { z } from "zod";

const iconifyAuthorSchema = z.object({
  name: z.string(),
  url: z.string().optional(),
});

const iconifyLicenseSchema = z.object({
  title: z.string(),
  spdx: z.string().optional(),
  url: z.string().optional(),
});

export const iconifySearchResponseSchema = z.object({
  icons: z.array(z.string()),
  total: z.number().int().nonnegative(),
});

export const iconifyCollectionSchema = z.object({
  prefix: z.string(),
  name: z.string(),
  total: z.number().int().nonnegative(),
  author: iconifyAuthorSchema.optional(),
  license: iconifyLicenseSchema.optional(),
  samples: z.array(z.string()).optional(),
  height: z.union([z.number(), z.array(z.number())]).optional(),
  displayHeight: z.number().optional(),
  category: z.string().optional(),
  palette: z.boolean().optional(),
});

const iconifyCollectionResponseSchema = iconifyCollectionSchema.omit({ prefix: true });

export const iconifyCollectionsResponseSchema = z.record(
  z.string(),
  iconifyCollectionResponseSchema,
);

export type IconifySearchResponse = z.infer<typeof iconifySearchResponseSchema>;
export type IconifyCollection = z.infer<typeof iconifyCollectionSchema>;
export type IconifyCollectionsResponse = z.infer<typeof iconifyCollectionsResponseSchema>;
