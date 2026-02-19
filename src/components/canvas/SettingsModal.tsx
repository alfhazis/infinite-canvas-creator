import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Key, Shield, Globe, AlertCircle, Check, Loader2, LogOut } from 'lucide-react';
import { useCanvasStore } from '@/stores/canvasStore';
import { useAuthStore } from '@/stores/authStore';
import { fetchOpenRouterModels } from '@/lib/openrouter';
import { saveOpenRouterKey, loadOpenRouterKey, deleteOpenRouterKey } from '@/lib/projectsApi';
import { ModelSelector } from './ModelSelector';

export const SettingsModal = ({ onClose }: { onClose: () => void }) => {
  const { openRouterKey, setOpenRouterKey, availableModels, setAvailableModels } = useCanvasStore();
  const { user, signOut } = useAuthStore();
  const [key, setKey] = useState(openRouterKey || '');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOpenRouterKey()
      .then((k) => {
        if (k) {
          setKey(k);
          setOpenRouterKey(k);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (availableModels.length === 0) handleFetchModels();
  }, []);

  const handleSaveKey = async () => {
    setSaving(true);
    setError(null);
    try {
      const trimmed = key.trim();
      if (trimmed) {
        await saveOpenRouterKey(trimmed);
        setOpenRouterKey(trimmed);
      } else {
        await deleteOpenRouterKey();
        setOpenRouterKey(null);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError('Failed to save key. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleFetchModels = async () => {
    setLoading(true);
    setError(null);
    try {
      const models = await fetchOpenRouterModels();
      setAvailableModels(models);
    } catch {
      setError('Failed to fetch models. Check your connection.');
    } finally {
      setLoading(false);
    }
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
          {user && (
            <div className="flex items-center justify-between p-4 rounded-2xl bg-secondary border border-border">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Signed in as</p>
                <p className="text-xs font-bold text-foreground mt-0.5">{user.email}</p>
              </div>
              <button
                onClick={async () => { await signOut(); onClose(); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-destructive transition-colors"
              >
                <LogOut className="w-3 h-3" /> Sign Out
              </button>
            </div>
          )}

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
                disabled={saving}
                className="px-4 rounded-xl bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-primary/20 disabled:opacity-60 flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? <Check className="w-3 h-3" /> : null}
                {saved ? 'Saved' : 'Save'}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed italic">
              Your API key is stored securely in your account.
            </p>
          </div>

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
            <ModelSelector className="!h-12 !text-xs" />
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-3">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
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
