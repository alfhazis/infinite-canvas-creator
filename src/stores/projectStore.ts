import { create } from 'zustand';
import {
  listProjects,
  createProject,
  deleteProject,
  loadCanvas,
  saveCanvas,
  type Project,
} from '@/lib/projectsApi';
import { useCanvasStore } from './canvasStore';

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  loading: boolean;
  saving: boolean;
  lastSavedAt: Date | null;

  fetchProjects: () => Promise<void>;
  createAndActivate: (name: string, description?: string) => Promise<Project>;
  activateProject: (id: string) => Promise<void>;
  saveCurrentCanvas: () => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  clearActive: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  loading: false,
  saving: false,
  lastSavedAt: null,

  fetchProjects: async () => {
    set({ loading: true });
    try {
      const projects = await listProjects();
      set({ projects });
    } finally {
      set({ loading: false });
    }
  },

  createAndActivate: async (name, description = '') => {
    const project = await createProject(name, description);
    set((s) => ({ projects: [project, ...s.projects], activeProjectId: project.id }));
    useCanvasStore.getState().clearAll();
    useCanvasStore.getState().setZoom(1);
    useCanvasStore.getState().setPan(0, 0);
    return project;
  },

  activateProject: async (id) => {
    set({ loading: true });
    try {
      const canvasState = await loadCanvas(id);
      const store = useCanvasStore.getState();
      store.clearAll();
      store.setZoom(canvasState.zoom);
      store.setPan(canvasState.panX, canvasState.panY);
      if (canvasState.aiModel !== 'auto') {
        store.setAiModel(canvasState.aiModel);
      }
      for (const node of canvasState.nodes) {
        useCanvasStore.setState((s) => ({
          nodes: [...s.nodes, node],
        }));
      }
      set({ activeProjectId: id });
    } finally {
      set({ loading: false });
    }
  },

  saveCurrentCanvas: async () => {
    const { activeProjectId } = get();
    if (!activeProjectId) return;

    set({ saving: true });
    try {
      const { nodes, zoom, panX, panY } = useCanvasStore.getState();
      await saveCanvas(activeProjectId, nodes, { zoom, panX, panY });
      set({ lastSavedAt: new Date() });
    } finally {
      set({ saving: false });
    }
  },

  removeProject: async (id) => {
    await deleteProject(id);
    set((s) => {
      const projects = s.projects.filter((p) => p.id !== id);
      const activeProjectId = s.activeProjectId === id ? null : s.activeProjectId;
      if (activeProjectId === null) {
        useCanvasStore.getState().clearAll();
      }
      return { projects, activeProjectId };
    });
  },

  clearActive: () => {
    set({ activeProjectId: null });
    useCanvasStore.getState().clearAll();
  },
}));
