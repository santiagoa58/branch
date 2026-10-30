// Stable facade for the same-origin, authenticated cloud API.
export { setApiTokenProvider } from "./api/auth";
export { projectsApi } from "./api/projects";
export { diagramsApi } from "./api/diagrams";
export { versionsApi } from "./api/versions";
export { ApiError, ApiRequestValidationError, ApiResponseValidationError } from "./api/errors";
export type { ApiReadOptions } from "./api/types";
export type {
  ApiDiagram,
  ApiDiagramSummary,
  ApiDiagramVersion,
  ApiDiagramVersionFull,
  ApiErrorBody,
  ApiProject,
  ApiProjectSummary,
  ApiWorkspaceProject,
  CreateDiagramRequest,
  CreateDiagramVersionRequest,
  CreateProjectRequest,
  UpdateDiagramRequest,
  UpdateProjectRequest,
  UpdateThumbnailRequest,
} from "@/schemas/api";
