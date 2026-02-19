import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FolderOpen, Plus, Trash2, Loader2, Clock, Check, FolderPlus } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useCanvasStore } from '@/stores/canvasStore';

interface ProjectsPanelProps {
  onClose: () => void;
}

export const ProjectsPanel = ({ onClose }: ProjectsPanelProps) => {
  const { projects, activeProjectId, loading, saving, lastSavedAt, fetchProjects, createAndActivate, activateProject, removeProject } = useProjectStore();
  const { nodes } = useCanvasStore();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createAndActivate(newName.trim());
      setNewName('');
      setShowCreate(false);
      onClose();
    } finally {
      setCreating(false);
    }
  };

  const handleOpen = async (id: string) => {
    await activateProject(id);
    onClose();
  };

  const handleDelete = async (id: string) => {
    await removeProject(id);
    setConfirmDelete(null);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60_000) return 'Just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="node-card p-0 w-[520px] max-h-[85vh] flex flex-col overflow-hidden"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-primary/10 flex items-center justify-center">
              <FolderOpen className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight uppercase text-foreground">Projects</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {activeProjectId ? (
                  <span className="flex items-center gap-1">
                    {saving ? <><Loader2 className="w-2.5 h-2.5 animate-spin" /> Saving...</> : lastSavedAt ? <><Check className="w-2.5 h-2.5 text-green-500" /> Saved</> : 'Unsaved'}
                  </span>
                ) : 'No project open'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreate((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all"
            >
              <Plus className="w-3 h-3" /> New
            </button>
            <button onClick={onClose} className="p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-border"
            >
              <div className="p-4 flex gap-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="Project name..."
                  className="brand-input flex-1 !py-2.5 text-xs"
                  autoFocus
                />
                <button
                  onClick={handleCreate}
                  disabled={creating || !newName.trim()}
                  className="px-4 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <FolderPlus className="w-3 h-3" />}
                  Create
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">Loading projects...</span>
            </div>
          )}

          {!loading && projects.length === 0 && (
            <div className="text-center py-12">
              <FolderOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-medium">No projects yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Create a new project to get started</p>
            </div>
          )}

          {projects.map((project) => {
            const isActive = project.id === activeProjectId;
            const isDeleteConfirm = confirmDelete === project.id;

            return (
              <motion.div
                key={project.id}
                layout
                className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition-all group ${
                  isActive
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border hover:border-primary/30 hover:bg-secondary/50'
                }`}
                onClick={() => !isDeleteConfirm && handleOpen(project.id)}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isActive ? 'bg-primary/20' : 'bg-secondary'}`}>
                  <FolderOpen className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-foreground truncate">{project.name}</p>
                    {isActive && <span className="px-1.5 py-0.5 rounded-md bg-primary/20 text-primary text-[9px] font-black uppercase tracking-wider shrink-0">Active</span>}
                  </div>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="w-2.5 h-2.5" /> {formatDate(project.updated_at)}
                  </p>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                  {isDeleteConfirm ? (
                    <>
                      <button
                        onClick={() => handleDelete(project.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-[10px] font-black uppercase tracking-wider"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="px-2.5 py-1.5 rounded-lg bg-secondary text-muted-foreground text-[10px] font-black uppercase tracking-wider"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(project.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="p-4 border-t border-border">
          <p className="text-[10px] text-muted-foreground text-center">
            {nodes.length} node{nodes.length !== 1 ? 's' : ''} on canvas
            {activeProjectId && !saving && ' · auto-saves on changes'}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
};
