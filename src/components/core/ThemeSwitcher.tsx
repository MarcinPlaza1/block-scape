import { useEffect, useState } from 'react';
import { applyReduceMotion, applyTheme, getSavedReduceMotion, getSavedTheme, type ThemeVariant } from '@/lib/theme';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Sparkles, Sun, Contrast } from 'lucide-react';

export default function ThemeSwitcher() {
  const [variant, setVariant] = useState<ThemeVariant>('default');
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);

  useEffect(() => {
    setVariant(getSavedTheme());
    setReduceMotion(getSavedReduceMotion());
  }, []);

  const changeTheme = (v: ThemeVariant) => {
    setVariant(v);
    applyTheme(v);
  };

  const toggleReduceMotion = (enabled: boolean) => {
    setReduceMotion(enabled);
    applyReduceMotion(enabled);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="pointer-events-auto">
          {variant === 'kids' ? <Sparkles className="mr-2 h-4 w-4" /> : variant === 'contrast' ? <Contrast className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}<span className="hidden sm:inline">Motyw</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Motyw</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => changeTheme('default')} className={variant === 'default' ? 'text-primary' : ''}>Domyślny</DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeTheme('kids')} className={variant === 'kids' ? 'text-primary' : ''}>Dla dzieci</DropdownMenuItem>
        <DropdownMenuItem onClick={() => changeTheme('contrast')} className={variant === 'contrast' ? 'text-primary' : ''}>Wysoki kontrast</DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 flex items-center justify-between text-sm">
          <span>Ogranicz animacje</span>
          <Switch checked={reduceMotion} onCheckedChange={toggleReduceMotion} />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


