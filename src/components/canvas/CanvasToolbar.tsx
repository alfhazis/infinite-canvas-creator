import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Upload, ZoomIn, ZoomOut, Maximize2,
  Search, Plus, X, FileCode, Layers
} from 'lucide-react';
import { useCanvasStore } from '@/stores/canvasStore';

export const CanvasToolbar = () => {
  const { addNode, zoom, setZoom, setPan, nodes } = useCanvasStore();
  const [showIdeaInput, setShowIdeaInput] = useState(false);
  const [ideaText, setIdeaText] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddIdea = useCallback(() => {
    if (!ideaText.trim()) return;
    const nodeCount = nodes.length;
    const col = nodeCount % 3;
    const row = Math.floor(nodeCount / 3);
    addNode({
      type: 'idea',
      title: ideaText.trim(),
      description: 'Click "Generate" to create a design from this idea. The AI will produce multiple design variations you can run and preview.',
      x: 100 + col * 420,
      y: 100 + row * 400,
      width: 360,
      height: 300,
      status: 'idle',
    });
    setIdeaText('');
    setShowIdeaInput(false);
  }, [ideaText, nodes.length, addNode]);

  const handleFileImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      Array.from(files).forEach((file, i) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = ev.target?.result as string;
          const nodeCount = nodes.length + i;
          const col = nodeCount % 3;
          const row = Math.floor(nodeCount / 3);
          addNode({
            type: 'import',
            title: file.name.replace(/\.(tsx?|css)$/, ''),
            description: `Imported ${file.name} (${(file.size / 1024).toFixed(1)}KB)`,
            x: 100 + col * 420,
            y: 100 + row * 400,
            width: 360,
            height: 300,
            status: 'ready',
            content,
            fileName: file.name,
            generatedCode: content,
          });
        };
        reader.readAsText(file);
      });
      e.target.value = '';
    },
    [nodes.length, addNode]
  );

  const filteredNodes = searchQuery
    ? nodes.filter((n) => n.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  return (
    <>
      {/* Top bar */}
      <motion.div
        className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        {/* Logo / Title */}
        <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-card border border-border">
          <Layers className="w-5 h-5 text-primary" />
          <span className="text-[10px] font-black uppercase tracking-widest text-foreground">
            Infinite Canvas
          </span>
          <span className="brand-label text-muted-foreground">
            {nodes.length} nodes
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-3 rounded-2xl bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
          >
            <Search className="w-5 h-5" />
          </button>
          <AnimatePresence>
            {showSearch && (
              <motion.div
                className="absolute top-full mt-2 left-0 w-72"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search nodes..."
                  className="brand-input"
                />
                {filteredNodes.length > 0 && (
                  <div className="mt-2 rounded-2xl bg-card border border-border p-2 max-h-48 overflow-y-auto">
                    {filteredNodes.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => {
                          useCanvasStore.getState().selectNode(n.id);
                          useCanvasStore.getState().setPan(-n.x + window.innerWidth / 2 - n.width / 2, -n.y + window.innerHeight / 2 - 150);
                          setShowSearch(false);
                          setSearchQuery('');
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-secondary transition-colors"
                      >
                        <span className="text-xs font-bold text-foreground">{n.title}</span>
                        <span className="brand-label ml-2">{n.type}</span>
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-2xl bg-card border border-border">
          <button
            onClick={() => setZoom(zoom - 0.1)}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setZoom(1); setPan(0, 0); }}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(zoom + 0.1)}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>
      </motion.div>

      {/* Bottom action bar */}
      <motion.div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <AnimatePresence>
          {showIdeaInput && (
            <motion.div
              className="flex items-center gap-2"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
            >
              <input
                autoFocus
                value={ideaText}
                onChange={(e) => setIdeaText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddIdea()}
                placeholder="Describe your idea..."
                className="brand-input w-80"
              />
              <button onClick={handleAddIdea} className="brand-button w-auto px-6">
                Create
              </button>
              <button
                onClick={() => { setShowIdeaInput(false); setIdeaText(''); }}
                className="p-3.5 rounded-xl border border-border text-muted-foreground hover:text-foreground transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {!showIdeaInput && (
          <>
            <button
              onClick={() => setShowIdeaInput(true)}
              className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all animate-pulse-glow"
            >
              <Sparkles className="w-4 h-4" />
              New Idea
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-card border border-border text-foreground text-[10px] font-black uppercase tracking-widest hover:border-primary/30 transition-all"
            >
              <Upload className="w-4 h-4" />
              Import Files
            </button>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".ts,.tsx,.css"
          multiple
          className="hidden"
          onChange={handleFileImport}
        />
      </motion.div>
    </>
  );
};
