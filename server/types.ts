import type { AiStageRunner } from "./ai/runner";
import type { WorkspaceRepository } from "./repository";

export interface HandlerDependencies {
  authenticate(request: Request): Promise<string | null>;
  repository: WorkspaceRepository;
  ai: AiStageRunner;
}

export interface WorkspaceEnv {
  Variables: { owner: string };
}
