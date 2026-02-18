import { useCallback, type MouseEvent } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Code, FileCode, Upload, Play, Trash2, Link } from 'lucide-react';
import { useCanvasStore, type CanvasNode } from '@/stores/canvasStore';

const typeConfig: Record<CanvasNode['type'], { icon: typeof Sparkles; gradient: string }> = {
  idea: { icon: Sparkles, gradient: 'from-indigo-500/20 to-violet-500/20' },
  design: { icon: Code, gradient: 'from-emerald-500/20 to-teal-500/20' },
  code: { icon: FileCode, gradient: 'from-amber-500/20 to-orange-500/20' },
  import: { icon: Upload, gradient: 'from-sky-500/20 to-blue-500/20' },
};

const statusColors: Record<CanvasNode['status'], string> = {
  idle: 'bg-muted-foreground/30',
  generating: 'bg-amber-500 animate-pulse',
  ready: 'bg-emerald-500',
  running: 'bg-indigo-500 animate-pulse',
};

interface Props {
  node: CanvasNode;
}

export const CanvasNodeCard = ({ node }: Props) => {
  const { selectedNodeId, selectNode, startDrag, updateNode, removeNode } = useCanvasStore();
  const isSelected = selectedNodeId === node.id;
  const { icon: Icon, gradient } = typeConfig[node.type];

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      selectNode(node.id);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      startDrag(node.id, e.clientX - rect.left, e.clientY - rect.top);
    },
    [node.id, selectNode, startDrag]
  );

  const handleGenerate = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      updateNode(node.id, { status: 'generating' });
      // Simulate generation
      setTimeout(() => {
        const designs = [
          'A sleek dashboard with analytics cards, charts, and a sidebar navigation.',
          'A modern e-commerce product grid with filters and cart functionality.',
          'A social media feed with infinite scroll, reactions, and comments.',
          'A project management board with kanban columns and drag-and-drop.',
          'A real-time chat interface with message bubbles and typing indicators.',
        ];
        updateNode(node.id, {
          status: 'ready',
          generatedCode: `// Generated from: "${node.title}"\n// ${designs[Math.floor(Math.random() * designs.length)]}\n\nexport default function GeneratedComponent() {\n  return (\n    <div className="p-8 rounded-[2.5rem] bg-card border border-border">\n      <h2 className="brand-heading">${node.title}</h2>\n      <p className="brand-description mt-4">${node.description}</p>\n    </div>\n  );\n}`,
        });
      }, 2000);
    },
    [node.id, node.title, node.description, updateNode]
  );

  const handleRun = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      updateNode(node.id, { status: 'running' });
      setTimeout(() => updateNode(node.id, { status: 'ready' }), 3000);
    },
    [node.id, updateNode]
  );

  const handleDelete = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      removeNode(node.id);
    },
    [node.id, removeNode]
  );

  return (
    <motion.div
      className={`absolute cursor-grab active:cursor-grabbing select-none`}
      style={{ left: node.x, top: node.y, width: node.width }}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      onMouseDown={handleMouseDown}
    >
      <div
        className={`node-card p-6 ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
      >
        {/* Status indicator */}
        <div className="flex items-center justify-between mb-4">
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center`}>
            <Icon className="w-6 h-6 text-foreground" />
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${statusColors[node.status]}`} />
            <span className="brand-label">{node.status}</span>
          </div>
        </div>

        {/* Content */}
        <h3 className="text-lg font-black tracking-tight uppercase text-foreground mb-2 line-clamp-2">
          {node.title}
        </h3>
        <p className="brand-description mb-4 line-clamp-3">{node.description}</p>

        {/* Generated code preview */}
        {node.generatedCode && (
          <div className="mb-4 rounded-xl bg-secondary/50 border border-border p-3 max-h-32 overflow-hidden">
            <pre className="text-[10px] text-muted-foreground font-mono whitespace-pre-wrap">
              {node.generatedCode.slice(0, 200)}...
            </pre>
          </div>
        )}

        {/* File name for imports */}
        {node.fileName && (
          <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/50 border border-border">
            <FileCode className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-mono text-muted-foreground truncate">{node.fileName}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {node.status === 'idle' && node.type === 'idea' && (
            <button onClick={handleGenerate} className="brand-button flex-1 flex items-center justify-center gap-2">
              <Sparkles className="w-3 h-3" />
              Generate
            </button>
          )}
          {node.status === 'ready' && (
            <button onClick={handleRun} className="brand-button flex-1 flex items-center justify-center gap-2">
              <Play className="w-3 h-3" />
              Run
            </button>
          )}
          {node.status === 'generating' && (
            <div className="brand-button flex-1 flex items-center justify-center gap-2 opacity-60 pointer-events-none">
              <div className="w-3 h-3 border-2 border-background border-t-transparent rounded-full animate-spin" />
              Generating
            </div>
          )}
          {node.status === 'running' && (
            <div className="brand-button flex-1 flex items-center justify-center gap-2 animate-pulse-glow">
              <div className="w-3 h-3 border-2 border-background border-t-transparent rounded-full animate-spin" />
              Running
            </div>
          )}
          <button
            onClick={handleDelete}
            className="p-3.5 rounded-xl border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
