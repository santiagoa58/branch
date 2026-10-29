import { collaboratorNameSchema } from "@/schemas/collaboration";

export const COLLABORATOR_NAME_STORAGE_KEY = "archdiagram-collab-name";

export function loadCollaboratorName(): string | null {
  try {
    const result = collaboratorNameSchema.safeParse(
      localStorage.getItem(COLLABORATOR_NAME_STORAGE_KEY),
    );
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
