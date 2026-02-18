import { useCanvasStore } from '@/stores/canvasStore';

export const CanvasConnections = () => {
  const nodes = useCanvasStore((s) => s.nodes);

  const lines: { x1: number; y1: number; x2: number; y2: number; key: string }[] = [];

  nodes.forEach((node) => {
    node.connectedTo.forEach((targetId) => {
      const target = nodes.find((n) => n.id === targetId);
      if (!target) return;
      lines.push({
        x1: node.x + node.width / 2,
        y1: node.y + node.height / 2,
        x2: target.x + target.width / 2,
        y2: target.y + target.height / 2,
        key: `${node.id}-${targetId}`,
      });
    });
  });

  if (lines.length === 0) return null;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="connection-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(239 84% 67% / 0.6)" />
          <stop offset="100%" stopColor="hsl(239 84% 67% / 0.2)" />
        </linearGradient>
      </defs>
      {lines.map((line) => (
        <line
          key={line.key}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="url(#connection-gradient)"
          strokeWidth={2}
          strokeDasharray="8 4"
        />
      ))}
    </svg>
  );
};
