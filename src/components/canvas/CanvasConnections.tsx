import { useCanvasStore } from '@/stores/canvasStore';

export const CanvasConnections = () => {
  const nodes = useCanvasStore((s) => s.nodes);

  const connections: { x1: number; y1: number; x2: number; y2: number; key: string }[] = [];

  nodes.forEach((node) => {
    node.connectedTo.forEach((targetId) => {
      const target = nodes.find((n) => n.id === targetId);
      if (!target) return;

      // From right edge center of source
      const x1 = node.x + node.width;
      const y1 = node.y + (node.height || 150) / 2;
      // To left edge center of target
      const x2 = target.x;
      const y2 = target.y + (target.height || 150) / 2;

      connections.push({ x1, y1, x2, y2, key: `${node.id}-${targetId}` });
    });
  });

  if (connections.length === 0) return null;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="conn-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(239 84% 67% / 0.7)" />
          <stop offset="100%" stopColor="hsl(160 84% 50% / 0.5)" />
        </linearGradient>
        <marker id="arrowhead" markerWidth="12" markerHeight="8" refX="11" refY="4" orient="auto">
          <path d="M 0 0 L 12 4 L 0 8 L 3 4 Z" fill="hsl(239 84% 67% / 0.6)" />
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
        const pathLen = Math.sqrt(dx * dx + (c.y2 - c.y1) ** 2) * 1.4; // approx
        return (
          <g key={c.key}>
            {/* Soft glow */}
            <path d={path} fill="none" stroke="hsl(239 84% 67% / 0.08)" strokeWidth={10} filter="url(#conn-glow)" />
            {/* Main bezier */}
            <path d={path} fill="none" stroke="url(#conn-gradient)" strokeWidth={2} markerEnd="url(#arrowhead)" />
            {/* Animated dot along path */}
            <circle r="3.5" fill="hsl(239 84% 67% / 0.9)">
              <animateMotion dur={`${Math.max(2, pathLen / 200)}s`} repeatCount="indefinite" path={path} />
            </circle>
            <circle r="6" fill="hsl(239 84% 67% / 0.15)">
              <animateMotion dur={`${Math.max(2, pathLen / 200)}s`} repeatCount="indefinite" path={path} />
            </circle>
            {/* Source & target connection dots */}
            <circle cx={c.x1} cy={c.y1} r="4" fill="hsl(var(--canvas-node-bg))" stroke="hsl(239 84% 67% / 0.5)" strokeWidth={2} />
            <circle cx={c.x2} cy={c.y2} r="4" fill="hsl(var(--canvas-node-bg))" stroke="hsl(160 84% 50% / 0.5)" strokeWidth={2} />
          </g>
        );
      })}
    </svg>
  );
};
