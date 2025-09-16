import PageTransition from "@/components/ui/PageTransition";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EditorPanel from "./components/EditorPanel";
import LibraryPanel from "./components/LibraryPanel";
import MarketplacePanel from "./components/MarketplacePanel";
import { useSkinStudioController } from "./hooks/useSkinStudioController";

const SkinStudioPage = () => {
  const controller = useSkinStudioController();
  const {
    canvasRef,
    layout,
    editor,
    library,
    marketplace,
    currentUser,
    isActionBusy,
  } = controller;

  return (
    <PageTransition>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-12">
        <header className="space-y-2 pt-6 text-white">
          <h1 className="text-3xl font-semibold">Skin Studio</h1>
          <p className="text-sm text-white/70">
            Create, customize, and publish skins for your projects or marketplace.
          </p>
        </header>
        <Tabs value={layout.activeTab} onValueChange={layout.setActiveTab} className="space-y-6">
          <TabsList className="border border-white/10 bg-white/5">
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="library">My Library</TabsTrigger>
            <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          </TabsList>
          <TabsContent value="editor">
            <EditorPanel
              canvasRef={canvasRef}
              editor={editor}
              onOpenLibrary={() => layout.setActiveTab("library")}
              onOpenMarketplace={() => layout.setActiveTab("marketplace")}
            />
          </TabsContent>
          <TabsContent value="library">
            <LibraryPanel library={library} isActionBusy={isActionBusy} />
          </TabsContent>
          <TabsContent value="marketplace">
            <MarketplacePanel
              marketplace={marketplace}
              currentUserId={currentUser?.id}
              isActionBusy={isActionBusy}
            />
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
};

export default SkinStudioPage;
