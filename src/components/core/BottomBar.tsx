import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const BottomBar: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full mt-16 border-t border-border/50 bg-background/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Card className="voxel-surface voxel-bevel voxel-pixel-bevel bg-card/50">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {/* Studio name and author */}
              <div className="text-center md:text-left space-y-2">
                <h3 className="font-bold text-lg text-foreground voxel-title">
                  Block‑Scape Studio
                </h3>
                <p className="text-sm text-muted-foreground">
                  Autor: <span className="font-medium text-foreground">Marcin Płaza</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  © {currentYear} Wszystkie prawa zastrzeżone
                </p>
              </div>

              <Separator className="md:hidden" />

              {/* Legal links */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground text-xs"
                  onClick={() => {
                    // TODO: Navigate to Terms of Service when implemented
                    console.log('Navigate to Terms of Service');
                  }}
                >
                  Regulamin
                </Button>
                
                <div className="hidden sm:block w-px h-4 bg-border" />
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground text-xs"
                  onClick={() => {
                    // TODO: Navigate to Privacy Policy when implemented
                    console.log('Navigate to Privacy Policy');
                  }}
                >
                  Polityka Prywatności
                </Button>
                
                <div className="hidden sm:block w-px h-4 bg-border" />
                
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground text-xs"
                  onClick={() => {
                    // TODO: Navigate to Legal Notice when implemented
                    console.log('Navigate to Legal Notice');
                  }}
                >
                  Informacje Prawne
                </Button>
              </div>

              <Separator className="md:hidden" />

              {/* Platform info */}
              <div className="text-center md:text-right space-y-1">
                <p className="text-xs text-muted-foreground">
                  Platforma do tworzenia i publikowania światów 3D
                </p>
                <p className="text-xs text-muted-foreground">
                  Wersja 1.2.0 • Buduj w przeglądarce
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </footer>
  );
};

export default BottomBar;
