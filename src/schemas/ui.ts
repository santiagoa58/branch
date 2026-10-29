import { z } from "zod";
import { architectureNodeTypeSchema, groupNodeTypeSchema } from "./diagram";

export const paletteNodeTypeSchema = z.union([
  architectureNodeTypeSchema,
  z.templateLiteral(["group-", groupNodeTypeSchema]),
  z.literal("comment"),
]);
export const chaosSubModeSchema = z.enum(["random-failure", "network-partition"]);
export const imageBackgroundSchema = z.enum(["transparent", "white", "dark"]);
export const imageScaleSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export const pdfOrientationSchema = z.enum(["portrait", "landscape"]);
