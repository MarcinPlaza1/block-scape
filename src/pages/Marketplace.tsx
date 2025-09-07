import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';

const Marketplace = () => {
  const [query, setQuery] = useState('');

  return (
    <div className="min-h-screen w-full bg-gradient-bg p-6">
      {/* SEO meta */}
      {(() => { 
        document.title = 'Rynek — Block‑Scape Studio'; 
        let m = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
        if (!m) { m = document.createElement('meta'); m.setAttribute('name', 'description'); document.head.appendChild(m); }
        m.setAttribute('content', 'Rynek zasobów: avatary i modele dla Twoich światów 3D.');
        return null; 
      })()}
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">
            <span className="align-middle">Rynek</span>
            <span className="ml-3 inline-block h-2 w-2 rounded-full align-middle" style={{ backgroundColor: 'hsl(var(--brand-market))' }} />
          </h1>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex-1 sm:flex-none">
              <Input placeholder="Szukaj zasobów…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
        </div>

        <Card className="bg-card/95 backdrop-blur-sm border-border shadow-xl">
          <CardHeader>
            <CardTitle className="text-lg">Przeglądaj zasoby</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="avatars">
              <TabsList className="mb-4 bg-secondary/60">
                <TabsTrigger value="avatars" className="data-[state=active]:text-[hsl(var(--brand-market))]">Avatary</TabsTrigger>
                <TabsTrigger value="models" className="data-[state=active]:text-[hsl(var(--brand-market))]">Modele</TabsTrigger>
              </TabsList>
              <TabsContent value="avatars">
                <div className="text-sm text-muted-foreground">Wkrótce: galerie avatarów od społeczności.</div>
              </TabsContent>
              <TabsContent value="models">
                <div className="text-sm text-muted-foreground">Wkrótce: modele 3D obiektów i środowisk.</div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Marketplace;


