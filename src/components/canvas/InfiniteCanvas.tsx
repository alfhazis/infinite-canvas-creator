import { useCallback, useRef, type MouseEvent, type WheelEvent } from 'react';
import { motion } from 'framer-motion';
import { useCanvasStore } from '@/stores/canvasStore';
import { CanvasNodeCard } from './CanvasNodeCard';
import { CanvasConnections } from './CanvasConnections';

export const InfiniteCanvas = () => {
  const { nodes, zoom, panX, panY, setZoom, setPan, isDragging, drag, endDrag, selectNode } = useCanvasStore();
  const canvasRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const delta = e.deltaY * -0.001;
        setZoom(zoom + delta);
      } else {
        setPan(panX - e.deltaX, panY - e.deltaY);
      }
    },
    [zoom, panX, panY, setZoom, setPan]
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        isPanning.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        e.preventDefault();
      } else if (e.button === 0 && e.target === canvasRef.current) {
        selectNode(null);
      }
    },
    [selectNode]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isPanning.current) {
        const dx = e.clientX - lastMouse.current.x;
        const dy = e.clientY - lastMouse.current.y;
        setPan(panX + dx, panY + dy);
        lastMouse.current = { x: e.clientX, y: e.clientY };
      }
      if (isDragging) {
        drag(e.clientX, e.clientY);
      }
    },
    [isPanning, isDragging, panX, panY, setPan, drag]
  );

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
    endDrag();
  }, [endDrag]);

  const gridSize = 40 * zoom;
  const gridOffsetX = (panX % gridSize);
  const gridOffsetY = (panY % gridSize);

  return (
    <div
      ref={canvasRef}
      className="absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing"
      style={{
        backgroundColor: 'hsl(var(--canvas-bg))',
        backgroundSize: `${gridSize}px ${gridSize}px`,
        backgroundImage: `
          linear-gradient(to right, hsl(var(--canvas-grid)) 1px, transparent 1px),
          linear-gradient(to bottom, hsl(var(--canvas-grid)) 1px, transparent 1px)
        `,
        backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`,
      }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <CanvasConnections />
        {nodes.map((node) => (
          <CanvasNodeCard key={node.id} node={node} />
        ))}
      </div>

      {/* Zoom indicator */}
      <motion.div
        className="absolute bottom-6 right-6 px-4 py-2 rounded-2xl bg-card border border-border brand-label"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {Math.round(zoom * 100)}%
      </motion.div>
    </div>
  );
};
