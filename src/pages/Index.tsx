import { InfiniteCanvas } from '@/components/canvas/InfiniteCanvas';
import { CanvasToolbar } from '@/components/canvas/CanvasToolbar';

const Index = () => {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-background">
      <InfiniteCanvas />
      <CanvasToolbar />
    </div>
  );
};

export default Index;
