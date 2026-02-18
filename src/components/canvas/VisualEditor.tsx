import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MousePointer2, Type, Move, ZoomIn, ZoomOut, Undo2, Redo2, Save, Layers, Link2, Search } from 'lucide-react';
import { useCanvasStore, type CanvasNode, type ElementLink } from '@/stores/canvasStore';

type Tool = 'select' | 'text' | 'move' | 'link';

interface Props {
  node: CanvasNode;
  onClose: () => void;
}

export const VisualEditor = ({ node, onClose }: Props) => {
  const { updateNode, nodes } = useCanvasStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [zoom, setZoom] = useState(1);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [selectedElementSelector, setSelectedElementSelector] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([node.content || node.generatedCode || '']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [elementLinks, setElementLinks] = useState<ElementLink[]>(node.elementLinks || []);
  const [showNodePicker, setShowNodePicker] = useState(false);
  const [nodeSearch, setNodeSearch] = useState('');

  const currentContent = history[historyIndex];

  // Other nodes available for linking (exclude self)
  const linkableNodes = nodes.filter(n => n.id !== node.id);
  const filteredNodes = linkableNodes.filter(n =>
    n.title.toLowerCase().includes(nodeSearch.toLowerCase()) ||
    n.type.toLowerCase().includes(nodeSearch.toLowerCase())
  );

  // Inject editor styles and interaction scripts into the iframe
  const editorHtml = useCallback((html: string) => {
    // Build link highlight CSS for existing element links
    const linkHighlightCSS = elementLinks.map(link =>
      `[data-ve-linked="${link.targetNodeId}"] { outline: 2px dashed hsl(150 60% 50% / 0.6) !important; outline-offset: 2px; }`
    ).join('\n');

    return html.replace('</head>', `
      <style>
        .ve-hover { outline: 2px solid hsl(239 84% 67% / 0.5) !important; outline-offset: 2px; cursor: pointer; }
        .ve-selected { outline: 2px solid hsl(239 84% 67%) !important; outline-offset: 2px; }
        .ve-link-mode .ve-hover { outline-color: hsl(150 60% 50% / 0.5) !important; cursor: crosshair; }
        .ve-link-mode .ve-selected { outline-color: hsl(150 60% 50%) !important; }
        .ve-selected::after {
          content: attr(data-ve-tag);
          position: absolute;
          top: -22px; left: -2px;
          background: hsl(239 84% 67%);
          color: white;
          font-size: 9px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          padding: 2px 8px;
          border-radius: 4px;
          pointer-events: none;
        }
        .ve-link-mode .ve-selected::after { background: hsl(150 60% 50%); content: '🔗 ' attr(data-ve-tag); }
        ${linkHighlightCSS}
        * { position: relative; }
      </style>
    </head>`).replace('</body>', `
      <script>
        let selected = null;
        let tool = 'select';

        window.addEventListener('message', (e) => {
          if (e.data.type === 'setTool') {
            tool = e.data.tool;
            if (tool === 'link') document.body.classList.add('ve-link-mode');
            else document.body.classList.remove('ve-link-mode');
          }
          if (e.data.type === 'getContent') {
            window.parent.postMessage({ type: 'content', html: document.documentElement.outerHTML }, '*');
          }
        });

        function buildSelector(el) {
          if (el.id) return '#' + el.id;
          const tag = el.tagName.toLowerCase();
          const parent = el.parentElement;
          if (!parent) return tag;
          const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
          if (siblings.length === 1) return buildSelector(parent) + ' > ' + tag;
          const idx = siblings.indexOf(el) + 1;
          return buildSelector(parent) + ' > ' + tag + ':nth-child(' + idx + ')';
        }

        document.addEventListener('mouseover', (e) => {
          if (tool !== 'select' && tool !== 'text' && tool !== 'link') return;
          const el = e.target;
          if (el === document.body || el === document.documentElement) return;
          el.classList.add('ve-hover');
        });

        document.addEventListener('mouseout', (e) => {
          e.target.classList.remove('ve-hover');
        });

        document.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const el = e.target;
          if (el === document.body || el === document.documentElement) return;

          if (selected) {
            selected.classList.remove('ve-selected');
            selected.contentEditable = 'false';
          }

          selected = el;
          el.classList.add('ve-selected');
          el.setAttribute('data-ve-tag', el.tagName.toLowerCase());

          if (tool === 'text') {
            el.contentEditable = 'true';
            el.focus();
          }

          const selector = buildSelector(el);

          window.parent.postMessage({
            type: 'elementSelected',
            tag: el.tagName.toLowerCase(),
            text: el.textContent?.slice(0, 100),
            selector: selector,
            isLinkable: (el.tagName === 'A' || el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || el.onclick),
            styles: {
              color: getComputedStyle(el).color,
              fontSize: getComputedStyle(el).fontSize,
              fontWeight: getComputedStyle(el).fontWeight,
              backgroundColor: getComputedStyle(el).backgroundColor,
            }
          }, '*');
        }, true);

        document.addEventListener('input', (e) => {
          window.parent.postMessage({ type: 'contentChanged' }, '*');
        });
      </script>
    </body>`);
  }, [elementLinks]);

  // Listen for messages from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'elementSelected') {
        setSelectedElement(`<${e.data.tag}> ${e.data.text || ''}`);
        setSelectedElementSelector(e.data.selector);
        if (activeTool === 'link') {
          setShowNodePicker(true);
        }
      }
      if (e.data.type === 'contentChanged') {
        setIsDirty(true);
      }
      if (e.data.type === 'content') {
        const newContent = e.data.html;
        setHistory(prev => [...prev.slice(0, historyIndex + 1), newContent]);
        setHistoryIndex(prev => prev + 1);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [historyIndex, activeTool]);

  // Send tool changes to iframe
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'setTool', tool: activeTool }, '*');
  }, [activeTool]);

  const handleLinkToNode = useCallback((targetNodeId: string) => {
    if (!selectedElementSelector) return;
    const targetNode = nodes.find(n => n.id === targetNodeId);
    const newLink: ElementLink = {
      selector: selectedElementSelector,
      label: selectedElement || 'Element',
      targetNodeId,
    };
    setElementLinks(prev => {
      // Replace if same selector already linked
      const filtered = prev.filter(l => l.selector !== selectedElementSelector);
      return [...filtered, newLink];
    });
    setIsDirty(true);
    setShowNodePicker(false);
    setNodeSearch('');
    // Also auto-connect the nodes
    useCanvasStore.getState().connectNodes(node.id, targetNodeId);
  }, [selectedElementSelector, selectedElement, node.id, nodes]);

  const handleRemoveLink = useCallback((selector: string) => {
    setElementLinks(prev => prev.filter(l => l.selector !== selector));
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'getContent' }, '*');
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'content') {
        updateNode(node.id, {
          content: e.data.html,
          generatedCode: e.data.html,
          elementLinks,
        });
        setIsDirty(false);
        window.removeEventListener('message', handler);
      }
    };
    window.addEventListener('message', handler);
  }, [node.id, updateNode, elementLinks]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) setHistoryIndex(prev => prev - 1);
  }, [historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) setHistoryIndex(prev => prev + 1);
  }, [historyIndex, history.length]);

  const tools: { id: Tool; icon: typeof MousePointer2; label: string }[] = [
    { id: 'select', icon: MousePointer2, label: 'Select' },
    { id: 'text', icon: Type, label: 'Edit Text' },
    { id: 'link', icon: Link2, label: 'Link to Node' },
    { id: 'move', icon: Move, label: 'Move' },
  ];

  const typeIcons: Record<string, string> = {
    idea: '✦',
    design: '◆',
    code: '⟨/⟩',
    import: '↑',
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex flex-col"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card/80 backdrop-blur">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Visual Editor</span>
          </div>
          <div className="h-5 w-px bg-border" />
          <span className="text-xs font-bold text-muted-foreground truncate max-w-[200px]">{node.title}</span>
        </div>

        <div className="flex items-center gap-1">
          {tools.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id)}
              className={`group relative flex items-center justify-center w-9 h-9 rounded-xl transition-all ${
                activeTool === t.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'
              }`}
              title={t.label}
            >
              <t.icon className="w-4 h-4" />
            </button>
          ))}

          <div className="h-5 w-px bg-border mx-2" />

          <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-black text-muted-foreground w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all">
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="h-5 w-px bg-border mx-2" />

          <button onClick={handleUndo} disabled={historyIndex === 0} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all disabled:opacity-30">
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all disabled:opacity-30">
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="h-5 w-px bg-border mx-2" />

          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              isDirty
                ? 'bg-primary text-primary-foreground hover:opacity-90'
                : 'border border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            <Save className="w-3.5 h-3.5" /> Save
          </button>
          <button onClick={onClose} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all ml-1">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 overflow-auto bg-secondary/30 flex items-center justify-center p-8">
          <div
            className="bg-card rounded-2xl border border-border shadow-2xl overflow-hidden transition-transform"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
              width: node.platform === 'mobile' ? 390 : 1280,
              height: node.platform === 'mobile' ? 844 : 800,
            }}
          >
            <iframe
              ref={iframeRef}
              srcDoc={editorHtml(currentContent)}
              title="Visual Editor"
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>

        {/* Right panel: Element Links */}
        <AnimatePresence>
          {(activeTool === 'link' || elementLinks.length > 0) && (
            <motion.div
              className="w-72 border-l border-border bg-card/80 backdrop-blur flex flex-col"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 288, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Element Links</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {activeTool === 'link' ? 'Click an element to link it to a node' : 'Linked elements in this view'}
                </p>
              </div>

              <div className="flex-1 overflow-auto p-3 space-y-2">
                {elementLinks.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Link2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-[10px] font-bold">No links yet</p>
                    <p className="text-[9px] mt-1">Select the Link tool and click elements</p>
                  </div>
                )}
                {elementLinks.map((link) => {
                  const targetNode = nodes.find(n => n.id === link.targetNodeId);
                  return (
                    <div key={link.selector} className="p-3 rounded-xl bg-secondary/50 border border-border space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-primary truncate max-w-[160px]">{link.label}</span>
                        <button onClick={() => handleRemoveLink(link.selector)} className="p-1 rounded-lg text-muted-foreground hover:text-destructive transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px]">{typeIcons[targetNode?.type || 'design']}</span>
                        <span className="text-[10px] font-bold text-foreground truncate">{targetNode?.title || 'Unknown'}</span>
                      </div>
                      <div className="text-[8px] font-mono text-muted-foreground truncate">{link.selector}</div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Node picker modal */}
      <AnimatePresence>
        {showNodePicker && (
          <motion.div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-background/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShowNodePicker(false); setNodeSearch(''); }}
          >
            <motion.div
              className="w-96 max-h-[60vh] rounded-2xl bg-card border border-border shadow-2xl flex flex-col overflow-hidden"
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Link2 className="w-4 h-4 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Link to Node</span>
                </div>
                <p className="text-[10px] text-muted-foreground mb-3">
                  Select a node to link <span className="text-primary font-bold">{selectedElement}</span> to:
                </p>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={nodeSearch}
                    onChange={(e) => setNodeSearch(e.target.value)}
                    placeholder="Search nodes..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-secondary/50 border border-border text-xs font-bold text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                </div>
              </div>
              <div className="flex-1 overflow-auto p-2 space-y-1">
                {filteredNodes.length === 0 && (
                  <p className="text-center py-6 text-[10px] text-muted-foreground">No matching nodes found</p>
                )}
                {filteredNodes.map((n) => {
                  const existingLink = elementLinks.find(l => l.selector === selectedElementSelector && l.targetNodeId === n.id);
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleLinkToNode(n.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                        existingLink ? 'bg-primary/10 border border-primary/20' : 'hover:bg-secondary/80 border border-transparent'
                      }`}
                    >
                      <span className="text-sm">{typeIcons[n.type]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-foreground truncate">{n.title}</div>
                        <div className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">
                          {n.type}{n.pageRole ? ` • ${n.pageRole}` : ''}{n.platform ? ` • ${n.platform}` : ''}
                        </div>
                      </div>
                      {existingLink && <span className="text-[8px] font-black text-primary uppercase">Linked</span>}
                    </button>
                  );
                })}
              </div>
              <div className="px-4 py-3 border-t border-border">
                <button
                  onClick={() => { setShowNodePicker(false); setNodeSearch(''); }}
                  className="w-full py-2 rounded-xl border border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom status bar */}
      <div className="flex items-center justify-between px-6 py-2 border-t border-border bg-card/80 backdrop-blur text-[10px] font-bold text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>
            {activeTool === 'select' ? 'Click to select elements' :
             activeTool === 'text' ? 'Click element to edit text' :
             activeTool === 'link' ? 'Click element to link to a node' :
             'Drag to reposition'}
          </span>
          {selectedElement && (
            <>
              <div className="h-3 w-px bg-border" />
              <span className="text-primary truncate max-w-[300px]">{selectedElement}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          {elementLinks.length > 0 && <span className="text-primary">{elementLinks.length} link{elementLinks.length > 1 ? 's' : ''}</span>}
          <span>{node.platform === 'mobile' ? '390 × 844' : '1280 × 800'}</span>
          {isDirty && <span className="text-amber-500">• Unsaved changes</span>}
        </div>
      </div>
    </motion.div>
  );
};
