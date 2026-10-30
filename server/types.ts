import type { WorkspaceRepository } from "./repository";

export interface HandlerDependencies {
  authenticate(request: Request): Promise<string | null>;
  repository: WorkspaceRepository;
}

export type WorkspaceEnv = {
  Variables: { owner: string };
};
