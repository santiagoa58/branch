import { z } from "zod";
import { diagramDataSchema } from "./diagram";

// The backend initializes newly created diagrams with exactly {}.
// Normalize that legacy empty value; all nonempty payloads must validate fully.
const apiDiagramDataSchema = z.union([
  diagramDataSchema,
  z.strictObject({}).transform(() => ({ nodes: [], edges: [] })),
]);

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
  data: apiDiagramDataSchema,
  thumbnail: z.string().nullable(),
  version: z.number().int(),
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
  data: apiDiagramDataSchema,
});

export const createProjectRequestSchema = z.strictObject({
  name: z.string().min(1),
  description: z.string().optional(),
  color: z.string().optional(),
});

export const updateProjectRequestSchema = z.strictObject({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  color: z.string().optional(),
});

export const createDiagramRequestSchema = z.strictObject({
  name: z.string().min(1),
  description: z.string().optional(),
  data: diagramDataSchema.optional(),
});

export const updateDiagramRequestSchema = z.strictObject({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  data: diagramDataSchema.optional(),
});

export const updateThumbnailRequestSchema = z.strictObject({
  thumbnail: z.string(),
});

export const createDiagramVersionRequestSchema = z.strictObject({
  label: z.string().optional(),
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
