import { useCanvasStore } from '@/stores/canvasStore';
import { useEffect, useState } from 'react';

export const CanvasConnections = () => {
  const nodes = useCanvasStore((s) => s.nodes);
  const [renderedHeights, setRenderedHeights] = useState<Record<string, number>>({});

  // Observe actual rendered heights of node cards
  useEffect(() => {
    const measure = () => {
      const heights: Record<string, number> = {};
      nodes.forEach((node) => {
        const el = document.querySelector(`[data-node-id="${node.id}"]`);
        if (el) {
          heights[node.id] = el.getBoundingClientRect().height;
        }
      });
      setRenderedHeights(heights);
    };
    measure();
    const timer = setInterval(measure, 500);
    return () => clearInterval(timer);
  }, [nodes]);

  const connections: { x1: number; y1: number; x2: number; y2: number; key: string }[] = [];

  const hasPickedNodes = nodes.some((n) => n.picked);

  nodes.forEach((node) => {
    node.connectedTo.forEach((targetId) => {
      const target = nodes.find((n) => n.id === targetId);
      if (!target) return;

      if (hasPickedNodes && !node.picked && !target.picked) return;

      const sourceH = renderedHeights[node.id] || node.height || 300;
      const targetH = renderedHeights[target.id] || target.height || 300;

      // Right edge center of source → left edge center of target
      const x1 = node.x + node.width;
      const y1 = node.y + sourceH / 2;
      const x2 = target.x;
      const y2 = target.y + targetH / 2;

      connections.push({ x1, y1, x2, y2, key: `${node.id}-${targetId}` });
    });
  });

  if (connections.length === 0) return null;

  return (
    <svg className="absolute pointer-events-none" style={{ left: 0, top: 0, width: 9999, height: 9999, overflow: 'visible' }}>
      <defs>
        <linearGradient id="conn-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(239 84% 67% / 0.5)" />
          <stop offset="100%" stopColor="hsl(270 80% 65% / 0.4)" />
        </linearGradient>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <path d="M 0 0 L 8 3 L 0 6 Z" fill="hsl(270 80% 65% / 0.5)" />
        </marker>
        <filter id="conn-glow">
          <feGaussianBlur stdDeviation="4" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {connections.map((c) => {
        const dx = c.x2 - c.x1;
        const cp = Math.max(80, Math.abs(dx) * 0.4);
        const path = `M ${c.x1} ${c.y1} C ${c.x1 + cp} ${c.y1}, ${c.x2 - cp} ${c.y2}, ${c.x2} ${c.y2}`;
        const pathLen = Math.sqrt(dx * dx + (c.y2 - c.y1) ** 2) * 1.3;
        const dur = `${Math.max(2.5, pathLen / 140)}s`;
        return (
          <g key={c.key}>
            <path d={path} fill="none" stroke="hsl(239 84% 67% / 0.04)" strokeWidth={8} filter="url(#conn-glow)" />
            <path d={path} fill="none" stroke="url(#conn-gradient)" strokeWidth={1} markerEnd="url(#arrowhead)" strokeLinecap="round" />
            <circle r="2.5" fill="hsl(239 84% 67% / 0.7)">
              <animateMotion dur={dur} repeatCount="indefinite" path={path} />
            </circle>
          </g>
        );
      })}
    </svg>
  );
};
