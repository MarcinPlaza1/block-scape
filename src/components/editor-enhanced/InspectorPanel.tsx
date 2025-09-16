import { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Hierarchy, BlockProperties } from '@/components/editor-enhanced';
import MiniPreview from '../game/MiniPreview';
import { useProjectStore } from '@/lib/projectStore';

const InspectorPanel = () => {
  const { blocks } = useProjectStore();
  // Header info moved to left Sidebar to avoid duplication

  const safeBlocks = useMemo(() => Array.isArray(blocks) ? blocks : [], [blocks]);

  return (
    <aside className="w-full h-full overflow-y-auto bg-sidebar border-l border-sidebar-border flex flex-col">

      <div className="p-3 border-b border-sidebar-border">
        <Card className="w-full h-40 overflow-hidden">
          <MiniPreview blocks={safeBlocks as any} className="w-full h-full" />
        </Card>
        <div className="mt-2 text-xs text-sidebar-foreground/70">Objects: <Badge variant="outline" className="ml-2 text-[10px]">{safeBlocks.length}</Badge></div>
      </div>

      <div className="p-3">
        <Tabs defaultValue="properties" className="w-full">
          <TabsList className="w-full grid grid-cols-3 bg-secondary/60">
            <TabsTrigger value="properties" className="data-[state=active]:text-[hsl(var(--brand-build))]">Properties</TabsTrigger>
            <TabsTrigger value="scene" className="data-[state=active]:text-[hsl(var(--brand-build))]">Scene</TabsTrigger>
            <TabsTrigger value="preview" className="data-[state=active]:text-[hsl(var(--brand-build))]">Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="properties" className="mt-3">
            <BlockProperties />
          </TabsContent>

          <TabsContent value="scene" className="mt-3">
            <Hierarchy />
          </TabsContent>

          <TabsContent value="preview" className="mt-3">
            <Card className="w-full h-64 overflow-hidden">
              <div className="h-full w-full bg-gradient-to-br from-primary/10 to-accent/10">
                <MiniPreview blocks={safeBlocks as any} className="w-full h-full" />
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </aside>
  );
};

export default InspectorPanel;


