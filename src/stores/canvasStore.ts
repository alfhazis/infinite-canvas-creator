import { create } from 'zustand';

export interface CanvasNode {
  id: string;
  type: 'idea' | 'design' | 'code' | 'import';
  title: string;
  description: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status: 'idle' | 'generating' | 'ready' | 'running';
  content?: string;
  fileName?: string;
  generatedCode?: string;
  connectedTo: string[];
}

interface CanvasState {
  nodes: CanvasNode[];
  zoom: number;
  panX: number;
  panY: number;
  selectedNodeId: string | null;
  isDragging: boolean;
  dragNodeId: string | null;
  dragOffset: { x: number; y: number };

  addNode: (node: Omit<CanvasNode, 'id' | 'connectedTo'>) => string;
  updateNode: (id: string, updates: Partial<CanvasNode>) => void;
  removeNode: (id: string) => void;
  selectNode: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  startDrag: (nodeId: string, offsetX: number, offsetY: number) => void;
  drag: (x: number, y: number) => void;
  endDrag: () => void;
  connectNodes: (fromId: string, toId: string) => void;
}

let nodeCounter = 0;

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  zoom: 1,
  panX: 0,
  panY: 0,
  selectedNodeId: null,
  isDragging: false,
  dragNodeId: null,
  dragOffset: { x: 0, y: 0 },

  addNode: (node) => {
    const id = `node-${++nodeCounter}-${Date.now()}`;
    set((state) => ({
      nodes: [...state.nodes, { ...node, id, connectedTo: [] }],
    }));
    return id;
  },

  updateNode: (id, updates) =>
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),

  removeNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id).map((n) => ({
        ...n,
        connectedTo: n.connectedTo.filter((c) => c !== id),
      })),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
    })),

  selectNode: (id) => set({ selectedNodeId: id }),

  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(3, zoom)) }),

  setPan: (x, y) => set({ panX: x, panY: y }),

  startDrag: (nodeId, offsetX, offsetY) =>
    set({ isDragging: true, dragNodeId: nodeId, dragOffset: { x: offsetX, y: offsetY } }),

  drag: (x, y) => {
    const { dragNodeId, dragOffset, zoom } = get();
    if (!dragNodeId) return;
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === dragNodeId
          ? { ...n, x: (x - dragOffset.x) / zoom - state.panX / zoom, y: (y - dragOffset.y) / zoom - state.panY / zoom }
          : n
      ),
    }));
  },

  endDrag: () => set({ isDragging: false, dragNodeId: null }),

  connectNodes: (fromId, toId) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === fromId && !n.connectedTo.includes(toId)
          ? { ...n, connectedTo: [...n.connectedTo, toId] }
          : n
      ),
    })),
}));
