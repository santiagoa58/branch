import type { QueryClient } from "@tanstack/react-query";
import { diagramsApi, projectsApi, type ApiDiagramSummary, type ApiWorkspaceProject } from "./api";
import { workspaceQuery } from "./workspaceQuery";

/**
 * A successful DELETE changes the canonical workspace lists immediately. Invalidating alone
 * allows stale cached cards to flash after navigation and makes confirmation look ineffective.
 * Cancel outstanding list reads first so older responses cannot restore the deleted item.
 */
export async function removeDeletedDiagramFromCache(
  client: QueryClient,
  projectId: string,
  diagramId: string,
): Promise<void> {
  const rootKey = workspaceQuery.root().queryKey;
  const diagramsKey = workspaceQuery.diagrams(projectId).queryKey;
  await Promise.all([
    client.cancelQueries({ queryKey: rootKey }),
    client.cancelQueries({ queryKey: diagramsKey }),
  ]);
  client.setQueryData<ApiWorkspaceProject[]>(rootKey, (projects) =>
    projects?.map((project) =>
      project.id === projectId
        ? { ...project, diagrams: project.diagrams.filter((diagram) => diagram.id !== diagramId) }
        : project,
    ),
  );
  client.setQueryData<ApiDiagramSummary[]>(diagramsKey, (diagrams) =>
    diagrams?.filter((diagram) => diagram.id !== diagramId),
  );
  client.removeQueries({ queryKey: ["diagrams", diagramId], exact: true });
  client.removeQueries({ queryKey: ["versions", diagramId] });
  client.removeQueries({ queryKey: ["version-full", diagramId] });
  await client.invalidateQueries({ queryKey: ["projects"], refetchType: "none" });
}

/** No list modification until the server confirms the deletion. */
export async function deleteDiagramFromWorkspace(
  client: QueryClient,
  projectId: string,
  diagramId: string,
  performDelete: () => Promise<void> = () => diagramsApi.delete(diagramId),
): Promise<void> {
  await performDelete();
  await removeDeletedDiagramFromCache(client, projectId, diagramId);
}

export async function deleteProjectFromWorkspace(
  client: QueryClient,
  projectId: string,
): Promise<void> {
  await projectsApi.delete(projectId);
  const rootKey = workspaceQuery.root().queryKey;
  await client.cancelQueries({ queryKey: rootKey });
  const removed = client
    .getQueryData<ApiWorkspaceProject[]>(rootKey)
    ?.find((project) => project.id === projectId);
  client.setQueryData<ApiWorkspaceProject[]>(rootKey, (projects) =>
    projects?.filter((project) => project.id !== projectId),
  );
  for (const diagram of removed?.diagrams ?? []) {
    client.removeQueries({ queryKey: ["diagrams", diagram.id], exact: true });
    client.removeQueries({ queryKey: ["versions", diagram.id] });
    client.removeQueries({ queryKey: ["version-full", diagram.id] });
  }
  client.removeQueries({ queryKey: workspaceQuery.project(projectId).queryKey });
  client.removeQueries({ queryKey: workspaceQuery.diagrams(projectId).queryKey });
  await client.invalidateQueries({ queryKey: ["projects"], refetchType: "none" });
}
