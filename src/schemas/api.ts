import { z } from "zod";
import { diagramDataSchema } from "./diagram";

export const apiProjectSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const apiProjectSummarySchema = apiProjectSchema;

export const apiDiagramSchema = z.strictObject({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  data: diagramDataSchema,
  thumbnail: z.string().nullable(),
  version: z.number().int().nonnegative(),
  revision: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const apiDiagramSummarySchema = apiDiagramSchema.omit({ data: true });

export const apiDiagramVersionSchema = z.strictObject({
  id: z.string(),
  diagramId: z.string(),
  versionNumber: z.number().int(),
  label: z.string().nullable(),
  thumbnail: z.string().nullable(),
  createdAt: z.string(),
});

export const apiDiagramVersionFullSchema = apiDiagramVersionSchema.extend({
  data: diagramDataSchema,
});

export const createProjectRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(10000).optional(),
  color: z.string().max(100).optional(),
});

export const updateProjectRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(10000).optional(),
  color: z.string().max(100).optional(),
});

export const createDiagramRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(10000).optional(),
  data: diagramDataSchema.optional(),
});

export const revisionRequestSchema = z.strictObject({
  expectedRevision: z.number().int().positive(),
});

export const updateDiagramRequestSchema = revisionRequestSchema.extend({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(10000).optional(),
  data: diagramDataSchema.optional(),
});

export const updateThumbnailRequestSchema = revisionRequestSchema.extend({
  thumbnail: z.string().max(500000),
});

export const createDiagramVersionRequestSchema = revisionRequestSchema.extend({
  label: z.string().max(200).optional(),
});

export const apiErrorBodySchema = z.strictObject({
  message: z.string(),
});

export const apiProjectListSchema = z.array(apiProjectSummarySchema);
export const apiDiagramSummaryListSchema = z.array(apiDiagramSummarySchema);
export const apiDiagramVersionListSchema = z.array(apiDiagramVersionSchema);
export const voidResponseSchema = z.void();

export type ApiProject = z.infer<typeof apiProjectSchema>;
export type ApiProjectSummary = z.infer<typeof apiProjectSummarySchema>;
export type ApiDiagram = z.infer<typeof apiDiagramSchema>;
export type ApiDiagramSummary = z.infer<typeof apiDiagramSummarySchema>;
export type ApiDiagramVersion = z.infer<typeof apiDiagramVersionSchema>;
export type ApiDiagramVersionFull = z.infer<typeof apiDiagramVersionFullSchema>;
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;
export type CreateDiagramRequest = z.infer<typeof createDiagramRequestSchema>;
export type UpdateDiagramRequest = z.infer<typeof updateDiagramRequestSchema>;
export type UpdateThumbnailRequest = z.infer<typeof updateThumbnailRequestSchema>;
export type CreateDiagramVersionRequest = z.infer<typeof createDiagramVersionRequestSchema>;
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
