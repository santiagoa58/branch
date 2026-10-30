import { AUTO_SAVE_DEBOUNCE } from "@/constants";
import { useSyncExternalStore } from "react";
import { diagramsApi, versionsApi } from "./api";
import { updateDiagramRequestSchema } from "@/schemas/api";
import { CloudPersistence } from "./cloudPersistence";
import type { DiagramData } from "@/types";

let hydrate = (_data: DiagramData): void => {};
export function setDiagramHydrator(callback: (data: DiagramData) => void) {
  hydrate = callback;
}
export const cloudWorkspace = new CloudPersistence(
  {
    get: (id) => diagramsApi.get(id),
    update: (id, input) => diagramsApi.update(id, updateDiagramRequestSchema.parse(input)),
    createVersion: (id, revision, label) => versionsApi.create(id, revision, label),
    restoreVersion: (id, versionId, revision) => versionsApi.restore(id, versionId, revision),
  },
  (data) => hydrate(data),
  AUTO_SAVE_DEBOUNCE,
);
export function useCloudWorkspace() {
  return useSyncExternalStore(cloudWorkspace.subscribe, cloudWorkspace.getState);
}
