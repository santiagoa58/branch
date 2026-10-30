import { queryOptions } from "@tanstack/react-query";
import { projectsApi, versionsApi, type ApiReadOptions } from "@/services/api";

const freshFor = 30_000;

export const workspaceQuery = {
  root: () =>
    queryOptions({
      queryKey: ["projects", "workspace"] as const,
      queryFn: ({ signal }) => projectsApi.workspace(signalOptions(signal)),
      staleTime: 0,
    }),
  project: (projectId: string) =>
    queryOptions({
      queryKey: ["projects", projectId] as const,
      queryFn: ({ signal }) => projectsApi.get(projectId, signalOptions(signal)),
      staleTime: freshFor,
    }),
  diagrams: (projectId: string) =>
    queryOptions({
      queryKey: ["projects", projectId, "diagrams"] as const,
      queryFn: ({ signal }) => projectsApi.diagrams(projectId, signalOptions(signal)),
      staleTime: freshFor,
    }),
  versions: (diagramId: string) =>
    queryOptions({
      queryKey: ["versions", diagramId] as const,
      queryFn: ({ signal }) => versionsApi.list(diagramId, signalOptions(signal)),
      staleTime: freshFor,
    }),
  version: (diagramId: string, versionId: string) =>
    queryOptions({
      queryKey: ["version-full", diagramId, versionId] as const,
      queryFn: ({ signal }) => versionsApi.get(diagramId, versionId, signalOptions(signal)),
      staleTime: freshFor,
    }),
};

function signalOptions(signal: AbortSignal): ApiReadOptions {
  return { signal };
}
