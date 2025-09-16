import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Settings, Package } from 'lucide-react';
import { Block } from '../scene/types';
import { getBlockMetadata } from '../scene/blocks/blockCategories';
import { useLocalStorage } from '../../../hooks/useLocalStorage';

interface HotbarSlot {
  blockType: Block['type'] | null;
  count?: number;
}

interface BlockHotbarProps {
  selectedSlot: number;
  onSelectSlot: (slot: number) => void;
  onSelectBlock: (type: Block['type']) => void;
  onOpenInventory: () => void;
  className?: string;
}

export const BlockHotbar: React.FC<BlockHotbarProps> = ({
  selectedSlot,
  onSelectSlot,
  onSelectBlock,
  onOpenInventory,
  className = ''
}) => {
  const [slots, setSlots] = useLocalStorage<HotbarSlot[]>('block-hotbar', 
    Array(9).fill({ blockType: null })
  );
  const [showTooltip, setShowTooltip] = useState<number | null>(null);
  
  // Keyboard shortcuts (1-9 keys)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const key = parseInt(e.key);
      if (key >= 1 && key <= 9 && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const slotIndex = key - 1;
        onSelectSlot(slotIndex);
        
        const slot = slots[slotIndex];
        if (slot?.blockType) {
          onSelectBlock(slot.blockType);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [slots, onSelectSlot, onSelectBlock]);
  
  // Mouse wheel scrolling through slots
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // Only with Ctrl held
      
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1 : -1;
      const newSlot = (selectedSlot + delta + 9) % 9;
      onSelectSlot(newSlot);
      
      const slot = slots[newSlot];
      if (slot?.blockType) {
        onSelectBlock(slot.blockType);
      }
    };
    
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [selectedSlot, slots, onSelectSlot, onSelectBlock]);
  
  const updateSlot = (index: number, blockType: Block['type'] | null) => {
    const newSlots = [...slots];
    newSlots[index] = { blockType, count: blockType ? 64 : undefined };
    setSlots(newSlots);
  };
  
  const HotbarSlot: React.FC<{ index: number; slot: HotbarSlot }> = ({ index, slot }) => {
    const metadata = slot.blockType ? getBlockMetadata(slot.blockType) : null;
    const Icon = metadata?.icon;
    const isSelected = selectedSlot === index;
    
    return (
      <motion.div
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`
          relative w-16 h-16 rounded-lg border-2 cursor-pointer
          flex items-center justify-center transition-all duration-200
          ${isSelected 
            ? 'bg-blue-100 border-blue-500 shadow-lg' 
            : 'bg-gray-800/80 border-gray-600 hover:border-gray-400'
          }
        `}
        onClick={() => {
          onSelectSlot(index);
          if (slot.blockType) {
            onSelectBlock(slot.blockType);
          }
        }}
        onMouseEnter={() => setShowTooltip(index)}
        onMouseLeave={() => setShowTooltip(null)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const blockType = e.dataTransfer.getData('blockType') as Block['type'];
          if (blockType) {
            updateSlot(index, blockType);
          }
        }}
      >
        {/* Block icon/preview */}
        {slot.blockType && metadata && (
          <>
            {Icon ? (
              <Icon 
                size={32} 
                style={{ color: metadata.previewColor }}
                className="drop-shadow-md"
              />
            ) : (
              <div 
                className="w-10 h-10 rounded shadow-md"
                style={{ backgroundColor: metadata.previewColor }}
              />
            )}
            
            {/* Stack count (Minecraft-style) */}
            {slot.count && slot.count > 1 && (
              <div className="absolute bottom-0 right-0 text-xs font-bold text-white bg-gray-900/80 px-1 rounded">
                {slot.count > 99 ? '99+' : slot.count}
              </div>
            )}
          </>
        )}
        
        {/* Empty slot */}
        {!slot.blockType && (
          <Plus size={24} className="text-gray-500" />
        )}
        
        {/* Slot number */}
        <div className="absolute top-0 left-0 text-xs font-bold text-gray-400 bg-gray-900/60 px-1 rounded-br">
          {index + 1}
        </div>
        
        {/* Tooltip */}
        <AnimatePresence>
          {showTooltip === index && slot.blockType && metadata && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10"
            >
              <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
                <div className="font-medium">{metadata.name}</div>
                <div className="text-xs text-gray-400">{metadata.category}</div>
                {metadata.rarity !== 'common' && (
                  <div className={`text-xs mt-1 ${
                    metadata.rarity === 'uncommon' ? 'text-green-400' :
                    metadata.rarity === 'rare' ? 'text-blue-400' :
                    metadata.rarity === 'epic' ? 'text-purple-400' :
                    'text-orange-400'
                  }`}>
                    {metadata.rarity}
                  </div>
                )}
              </div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 
                border-l-[6px] border-l-transparent
                border-r-[6px] border-r-transparent
                border-t-[6px] border-t-gray-900"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };
  
  return (
    <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-30 ${className}`}>
      <div className="flex items-center gap-2">
        {/* Main hotbar */}
        <div className="flex items-center gap-1 bg-gray-900/60 backdrop-blur-md p-2 rounded-xl shadow-2xl">
          {slots.map((slot, index) => (
            <HotbarSlot key={index} index={index} slot={slot} />
          ))}
        </div>
        
        {/* Inventory button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-16 h-16 bg-gray-800/80 border-2 border-gray-600 rounded-lg
            flex items-center justify-center hover:border-gray-400 transition-colors"
          onClick={onOpenInventory}
        >
          <Package size={24} className="text-gray-400" />
        </motion.button>
      </div>
      
      {/* Instructions */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-gray-500 whitespace-nowrap">
        Press 1-9 to select • Ctrl+Scroll to cycle • Click inventory to add blocks
      </div>
    </div>
  );
};
