import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Key, Shield, ChevronDown, Check, Globe, Zap, AlertCircle } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvasStore';
import { fetchOpenRouterModels } from '@/lib/openrouter';
import { ModelSelector } from './ModelSelector';

export const SettingsModal = ({ onClose }: { onClose: () => void }) => {
  const { openRouterKey, setOpenRouterKey, aiModel, setAiModel, availableModels, setAvailableModels } = useCanvasStore();
  const [key, setKey] = useState(openRouterKey || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSaveKey = () => {
    setOpenRouterKey(key.trim() || null);
    setError(null);
  };

  const handleFetchModels = async () => {
    setLoading(true);
    setError(null);
    try {
      const models = await fetchOpenRouterModels();
      setAvailableModels(models);
    } catch (err) {
      setError('Failed to fetch models. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (availableModels.length === 0) {
      handleFetchModels();
    }
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="node-card p-8 w-[480px] max-h-[85vh] overflow-y-auto"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Key className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight uppercase text-foreground">Settings</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">AI & Integration</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-8">
          {/* API Key Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                <Shield className="w-3 h-3 text-primary" /> OpenRouter API Key
              </label>
              <a 
                href="https://openrouter.ai/keys" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[9px] font-bold text-primary hover:underline uppercase tracking-widest"
              >
                Get Key
              </a>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="brand-input flex-1 !py-3 font-mono text-xs"
              />
              <button 
                onClick={handleSaveKey}
                className="px-4 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-primary/20"
              >
                Save
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed italic">
              Your API key is stored locally in your browser and never sent to our servers.
            </p>
          </div>

          {/* Model Selection Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                <Globe className="w-3 h-3 text-primary" /> Default AI Model
              </label>
              <button 
                onClick={handleFetchModels}
                disabled={loading}
                className="text-[9px] font-bold text-primary hover:underline uppercase tracking-widest disabled:opacity-50"
              >
                {loading ? 'Refreshing...' : 'Refresh List'}
              </button>
            </div>

            <div className="grid gap-2">
              <ModelSelector className="!h-12 !text-xs" />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-3">
                <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                <p className="text-[10px] font-bold text-destructive leading-tight">{error}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border">
          <button 
            onClick={onClose}
            className="w-full py-4 rounded-xl bg-secondary text-foreground text-[10px] font-black uppercase tracking-widest hover:bg-secondary/80 transition-all border border-border"
          >
            Close Settings
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
