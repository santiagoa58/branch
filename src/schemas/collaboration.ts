import { z } from "zod";
import * as Y from "yjs";
import { diagramStructureSchema, positionSchema, refineDiagramReferences } from "./diagram";

export const collaboratorNameSchema = z.string().trim().min(1).max(30);
const colorSchema = z.string().min(1);

export const collaboratorUserSchema = z.strictObject({
  name: collaboratorNameSchema,
  color: colorSchema,
});

export const usersChangedSchema = z.strictObject({ users: z.array(collaboratorUserSchema) });

export const remoteCursorSchema = z.strictObject({
  socketId: z.string().min(1),
  cursor: positionSchema.nullable(),
  userName: collaboratorNameSchema,
  color: colorSchema,
});

const yjsBytesSchema = z.array(z.number().int().min(0).max(255)).superRefine((bytes, ctx) => {
  try {
    Y.decodeUpdate(new Uint8Array(bytes));
  } catch {
    ctx.addIssue({ code: "custom", message: "Invalid Yjs update encoding" });
  }
});

export const yjsSyncSchema = z.strictObject({
  type: z.enum(["sync-step-1", "sync-step-2"]),
  data: yjsBytesSchema,
});

export const yjsUpdateSchema = z.strictObject({ update: yjsBytesSchema });
export const collaborativeDiagramSchema = diagramStructureSchema
  .pick({ nodes: true, edges: true })
  .superRefine(refineDiagramReferences);

export const leaveRoomSchema = z.strictObject({ diagramId: z.string().min(1) });
export const joinRoomSchema = leaveRoomSchema.extend({ userName: collaboratorNameSchema });
export const outgoingCursorSchema = remoteCursorSchema
  .omit({ socketId: true })
  .extend(leaveRoomSchema.shape);
export const outgoingYjsUpdateSchema = yjsUpdateSchema.extend(leaveRoomSchema.shape);
export const outgoingDiagramSchema = collaborativeDiagramSchema.safeExtend(leaveRoomSchema.shape);

export type CollaboratorUser = z.infer<typeof collaboratorUserSchema>;
export type RemoteCursor = z.infer<typeof remoteCursorSchema>;
