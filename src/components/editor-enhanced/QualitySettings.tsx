import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Settings2, Sparkles, Gauge, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';

export type QualityMode = 'performance' | 'balanced' | 'quality';

interface QualitySettingsProps {
  onQualityChange: (quality: QualityMode) => void;
  defaultQuality?: QualityMode;
}

export function QualitySettings({ onQualityChange, defaultQuality = 'balanced' }: QualitySettingsProps) {
  const [quality, setQuality] = useState<QualityMode>(defaultQuality);

  const handleQualityChange = (newQuality: QualityMode) => {
    setQuality(newQuality);
    onQualityChange(newQuality);
  };

  const getQualityIcon = () => {
    switch (quality) {
      case 'performance':
        return <Zap className="h-4 w-4" />;
      case 'balanced':
        return <Gauge className="h-4 w-4" />;
      case 'quality':
        return <Sparkles className="h-4 w-4" />;
    }
  };

  const getQualityLabel = () => {
    switch (quality) {
      case 'performance':
        return 'Performance';
      case 'balanced':
        return 'Balanced';
      case 'quality':
        return 'Quality';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          {getQualityIcon()}
          <span className="hidden sm:inline">{getQualityLabel()}</span>
          <Settings2 className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem 
          onClick={() => handleQualityChange('performance')}
          className="gap-2"
        >
          <Zap className="h-4 w-4 text-yellow-500" />
          <div className="flex-1">
            <div className="font-medium">Performance</div>
            <div className="text-xs text-muted-foreground">Fast rendering, no effects</div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleQualityChange('balanced')}
          className="gap-2"
        >
          <Gauge className="h-4 w-4 text-blue-500" />
          <div className="flex-1">
            <div className="font-medium">Balanced</div>
            <div className="text-xs text-muted-foreground">Good visuals & performance</div>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => handleQualityChange('quality')}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4 text-purple-500" />
          <div className="flex-1">
            <div className="font-medium">Quality</div>
            <div className="text-xs text-muted-foreground">Best visuals, slower FPS</div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default QualitySettings;