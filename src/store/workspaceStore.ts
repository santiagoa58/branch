import { create } from "zustand";

interface WorkspaceState {
  currentProjectId: string | null;
  currentDiagramId: string | null;
  setCurrentProject: (id: string | null) => void;
  setCurrentDiagram: (id: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  currentProjectId: null,
  currentDiagramId: null,
  setCurrentProject: (id) => set({ currentProjectId: id }),
  setCurrentDiagram: (id) => set({ currentDiagramId: id }),
}));
