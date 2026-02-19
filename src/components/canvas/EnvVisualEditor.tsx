import React, { useState } from 'react';
import { useCanvasStore } from '@/stores/canvasStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Key } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EnvVisualEditorProps {
  nodeId: string;
}

export const EnvVisualEditor: React.FC<EnvVisualEditorProps> = ({ nodeId }) => {
  const node = useCanvasStore((state) => state.nodes.find((n) => n.id === nodeId));
  const updateNode = useCanvasStore((state) => state.updateNode);
  
  if (!node || node.type !== 'env') return null;
  
  const envVars = node.envVars || {};
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleAdd = () => {
    if (!newKey.trim()) return;
    
    const updatedVars = { ...envVars, [newKey.trim()]: newValue.trim() };
    updateNode(nodeId, { envVars: updatedVars });
    setNewKey('');
    setNewValue('');
  };

  const handleRemove = (key: string) => {
    const updatedVars = { ...envVars };
    delete updatedVars[key];
    updateNode(nodeId, { envVars: updatedVars });
  };

  const handleUpdateValue = (key: string, value: string) => {
    const updatedVars = { ...envVars, [key]: value };
    updateNode(nodeId, { envVars: updatedVars });
  };

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      <div className="flex items-center gap-2 px-1">
        <Key className="w-4 h-4 text-emerald-500" />
        <h3 className="text-sm font-semibold">Environment Variables</h3>
      </div>
      
      <ScrollArea className="flex-1 -mx-2 px-2">
        <div className="space-y-3">
          {Object.entries(envVars).length === 0 ? (
            <div className="text-xs text-muted-foreground italic text-center py-4">
              No environment variables defined yet.
            </div>
          ) : (
            Object.entries(envVars).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2 bg-muted/30 p-2 rounded-md group">
                <div className="flex-1 flex flex-col gap-1">
                  <span className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-wider">{key}</span>
                  <Input 
                    value={value}
                    onChange={(e) => handleUpdateValue(key, e.target.value)}
                    placeholder="Value"
                    className="h-8 text-xs bg-background/50"
                  />
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleRemove(key)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="space-y-2 border-t pt-3">
        <div className="flex gap-2">
          <Input 
            placeholder="KEY" 
            value={newKey} 
            onChange={(e) => setNewKey(e.target.value)}
            className="h-9 text-xs font-mono uppercase"
          />
          <Input 
            placeholder="VALUE" 
            value={newValue} 
            onChange={(e) => setNewValue(e.target.value)}
            className="h-9 text-xs"
          />
        </div>
        <Button onClick={handleAdd} className="w-full h-9 gap-2 text-xs" variant="secondary">
          <Plus className="w-3.5 h-3.5" />
          Add Variable
        </Button>
      </div>
    </div>
  );
};
