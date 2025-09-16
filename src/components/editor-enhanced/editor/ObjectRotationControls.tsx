import React, { useState, useCallback, useEffect } from 'react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Slider } from '../../ui/slider';
import { Badge } from '../../ui/badge';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/features/projects/stores';
import {
  RotateCcw,
  RotateCw,
  RefreshCcw,
  RefreshCw,
  Move3D,
  X,
  Lock,
  Unlock,
  Copy,
  Trash2,
  Palette,
  Maximize,
  Minimize
} from 'lucide-react';

interface ObjectRotationControlsProps {
  selectedBlockId?: string | null;
  visible: boolean;
  position: { x: number; y: number };
  onClose?: () => void;
  className?: string;
}

const ObjectRotationControls: React.FC<ObjectRotationControlsProps> = ({
  selectedBlockId,
  visible,
  position,
  onClose,
  className
}) => {
  const [activeAxis, setActiveAxis] = useState<'x' | 'y' | 'z'>('y');
  const [rotationStep, setRotationStep] = useState(45); // degrees

  const {
    blocks,
    setBlockRotationX,
    setBlockRotationY,
    setBlockRotationZ,
    setBlockScale,
    setBlockColor,
    setBlockLocked,
    removeBlock,
    duplicateBlock,
  } = useProjectStore();

  const selectedBlock = blocks?.find(b => b.id === selectedBlockId);

  const getAxisRotation = (axis: 'x' | 'y' | 'z'): number => {
    if (!selectedBlock) return 0;
    if (selectedBlock.rotation) {
      return selectedBlock.rotation[axis] ?? 0;
    }
    // Fallback to legacy per-axis numeric fields
    if (axis === 'x') return selectedBlock.rotationX || 0;
    if (axis === 'y') return selectedBlock.rotationY || 0;
    return selectedBlock.rotationZ || 0;
  };

  const rotateBlock = useCallback((axis: 'x' | 'y' | 'z', delta: number) => {
    if (!selectedBlockId) return;

    const currentRotation = getAxisRotation(axis);
    const newRotation = (currentRotation + delta) % 360;

    // Use legacy per-axis setters for now
    switch (axis) {
      case 'x':
        setBlockRotationX(selectedBlockId, newRotation);
        break;
      case 'y':
        setBlockRotationY(selectedBlockId, newRotation);
        break;
      case 'z':
        setBlockRotationZ(selectedBlockId, newRotation);
        break;
    }
  }, [selectedBlockId, getAxisRotation, setBlockRotationX, setBlockRotationY, setBlockRotationZ]);

  const resetRotation = useCallback((axis?: 'x' | 'y' | 'z') => {
    if (!selectedBlockId) return;

    if (axis) {
      switch (axis) {
        case 'x':
          setBlockRotationX(selectedBlockId, 0);
          break;
        case 'y':
          setBlockRotationY(selectedBlockId, 0);
          break;
        case 'z':
          setBlockRotationZ(selectedBlockId, 0);
          break;
      }
    } else {
      // Reset all axes
      setBlockRotationX(selectedBlockId, 0);
      setBlockRotationY(selectedBlockId, 0);
      setBlockRotationZ(selectedBlockId, 0);
    }
  }, [selectedBlockId, setBlockRotationX, setBlockRotationY, setBlockRotationZ]);

  const getUniformScale = (): number => {
    if (!selectedBlock) return 1;
    if (typeof selectedBlock.scale === 'number') return selectedBlock.scale;
    if (selectedBlock.scale && typeof selectedBlock.scale === 'object') {
      // Approximate to X component
      return selectedBlock.scale.x ?? 1;
    }
    return 1;
  };

  const handleScaleChange = useCallback((newScale: number[]) => {
    if (!selectedBlockId) return;
    setBlockScale(selectedBlockId, newScale[0]);
  }, [selectedBlockId, setBlockScale]);

  const handleColorChange = useCallback(() => {
    if (!selectedBlockId || !selectedBlock) return;
    
    const currentColor = selectedBlock.color || 0x6b7280;
    const hex = window.prompt(
      'Enter hex color (e.g., #4f46e5):', 
      `#${currentColor.toString(16).padStart(6, '0')}`
    );
    
    if (hex && /^#?[0-9a-fA-F]{6}$/.test(hex.trim())) {
      const color = parseInt(hex.replace('#', ''), 16);
      setBlockColor(selectedBlockId, color);
    }
  }, [selectedBlockId, selectedBlock, setBlockColor]);

  const handleDuplicate = useCallback(() => {
    if (!selectedBlockId) return;
    duplicateBlock(selectedBlockId);
  }, [selectedBlockId, duplicateBlock]);

  const handleDelete = useCallback(() => {
    if (!selectedBlockId) return;
    if (window.confirm('Are you sure you want to delete this block?')) {
      removeBlock(selectedBlockId);
      onClose?.();
    }
  }, [selectedBlockId, removeBlock, onClose]);

  const toggleLock = useCallback(() => {
    if (!selectedBlockId || !selectedBlock) return;
    setBlockLocked(selectedBlockId, !selectedBlock.locked);
  }, [selectedBlockId, selectedBlock, setBlockLocked]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!visible || !selectedBlockId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case 'r':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            resetRotation();
          } else {
            rotateBlock(activeAxis, e.shiftKey ? -rotationStep : rotationStep);
          }
          break;
        case 'q':
          rotateBlock('y', -rotationStep);
          break;
        case 'e':
          rotateBlock('y', rotationStep);
          break;
        case 'delete':
        case 'backspace':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            handleDelete();
          }
          break;
        case 'd':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleDuplicate();
          }
          break;
        case 'escape':
          onClose?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, selectedBlockId, activeAxis, rotationStep, rotateBlock, resetRotation, handleDelete, handleDuplicate, onClose]);

  if (!visible || !selectedBlockId || !selectedBlock) return null;

  const rotationX = getAxisRotation('x');
  const rotationY = getAxisRotation('y'); 
  const rotationZ = getAxisRotation('z');
  const scale = getUniformScale();
  const isLocked = selectedBlock.locked || false;

  return (
    <div
      className={cn(
        "fixed z-50 pointer-events-auto",
        className
      )}
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%)'
      }}
    >
      <Card className="bg-black/90 border-gray-600 shadow-2xl backdrop-blur-sm">
        <div className="p-4 space-y-4 min-w-72">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Move3D className="w-4 h-4 text-blue-400" />
              <span className="font-semibold text-white text-sm">Object Controls</span>
              {isLocked && (
                <Badge variant="outline" className="text-xs border-red-500 text-red-400">
                  <Lock className="w-2.5 h-2.5 mr-1" />
                  Locked
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleLock}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300"
            >
              {isLocked ? <Unlock className="w-3 h-3 mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
              {isLocked ? 'Unlock' : 'Lock'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDuplicate}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300"
              disabled={isLocked}
            >
              <Copy className="w-3 h-3 mr-1" />
              Duplicate
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              className="px-3"
              disabled={isLocked}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>

          {/* Rotation Controls */}
          {!isLocked && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">Rotation</span>
                <div className="flex gap-1">
                  {(['x', 'y', 'z'] as const).map(axis => (
                    <Button
                      key={axis}
                      variant={activeAxis === axis ? "default" : "secondary"}
                      size="sm"
                      onClick={() => setActiveAxis(axis)}
                      className={cn(
                        "w-8 h-8 p-0 text-xs",
                        activeAxis === axis 
                          ? "bg-blue-500 text-white" 
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      )}
                    >
                      {axis.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Current rotation values */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <div className="text-gray-400">X</div>
                  <div className="text-white font-mono">{rotationX.toFixed(0)}°</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-400">Y</div>
                  <div className="text-white font-mono">{rotationY.toFixed(0)}°</div>
                </div>
                <div className="text-center">
                  <div className="text-gray-400">Z</div>
                  <div className="text-white font-mono">{rotationZ.toFixed(0)}°</div>
                </div>
              </div>

              {/* Rotation buttons */}
              <div className="flex justify-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => rotateBlock(activeAxis, -rotationStep)}
                  className="bg-gray-700 hover:bg-gray-600 text-gray-300"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => resetRotation(activeAxis)}
                  className="bg-gray-700 hover:bg-gray-600 text-gray-300"
                  title="Reset rotation"
                >
                  <RefreshCcw className="w-4 h-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => rotateBlock(activeAxis, rotationStep)}
                  className="bg-gray-700 hover:bg-gray-600 text-gray-300"
                >
                  <RotateCw className="w-4 h-4" />
                </Button>
              </div>

              {/* Rotation step selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Step:</span>
                <div className="flex gap-1">
                  {[15, 45, 90].map(step => (
                    <Button
                      key={step}
                      variant={rotationStep === step ? "default" : "secondary"}
                      size="sm"
                      onClick={() => setRotationStep(step)}
                      className={cn(
                        "px-2 py-1 text-xs h-6",
                        rotationStep === step 
                          ? "bg-blue-500 text-white" 
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      )}
                    >
                      {step}°
                    </Button>
                  ))}
                </div>
              </div>

              {/* Scale Control */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-300">Scale</span>
                  <span className="text-xs text-gray-400">{(scale * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[scale]}
                  onValueChange={handleScaleChange}
                  min={0.1}
                  max={3.0}
                  step={0.1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>10%</span>
                  <span>300%</span>
                </div>
              </div>

              {/* Color Control */}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleColorChange}
                className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 justify-center"
              >
                <Palette className="w-3 h-3 mr-2" />
                Change Color
              </Button>
            </div>
          )}

          {/* Keyboard shortcuts help */}
          <div className="text-xs text-gray-500 space-y-0.5 pt-2 border-t border-gray-700">
            <div className="font-medium text-gray-400">Shortcuts:</div>
            <div>R - Rotate • Q/E - Y-axis • Ctrl+R - Reset</div>
            <div>Ctrl+D - Duplicate • Del - Delete • Esc - Close</div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ObjectRotationControls;
