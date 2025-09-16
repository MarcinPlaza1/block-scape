import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Grid, List, Star, Clock, X, Info, Layers } from 'lucide-react';
import { Block } from '../scene/types';
import { 
  blockCategories, 
  dynamicCategories,
  getBlocksByCategory,
  getBlockMetadata,
  searchBlocks,
  BlockCategory,
  blockMetadata
} from '../scene/blocks/blockCategories';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface CreativeInventoryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBlock: (type: Block['type']) => void;
  selectedBlock?: Block['type'];
  recentBlocks?: Block['type'][];
  favoriteBlocks?: Block['type'][];
}

export const CreativeInventory: React.FC<CreativeInventoryProps> = ({
  isOpen,
  onClose,
  onSelectBlock,
  selectedBlock,
  recentBlocks = [],
  favoriteBlocks: propFavorites = []
}) => {
  const [selectedCategory, setSelectedCategory] = useState<BlockCategory>('basic');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [favorites, setFavorites] = useLocalStorage<Block['type'][]>('block-favorites', propFavorites);
  const [showInfo, setShowInfo] = useState<Block['type'] | null>(null);
  
  // Get blocks for current view
  const getDisplayBlocks = (): Block['type'][] => {
    if (searchQuery) {
      return searchBlocks(searchQuery);
    }
    
    switch (selectedCategory) {
      case 'recent':
        return recentBlocks;
      case 'favorites':
        return favorites;
      default:
        return getBlocksByCategory(selectedCategory);
    }
  };
  
  const displayBlocks = getDisplayBlocks();
  
  const toggleFavorite = (blockType: Block['type']) => {
    setFavorites(prev => {
      if (prev.includes(blockType)) {
        return prev.filter(b => b !== blockType);
      } else {
        return [...prev, blockType];
      }
    });
  };
  
  const BlockItem: React.FC<{ blockType: Block['type'] }> = ({ blockType }) => {
    const metadata = getBlockMetadata(blockType);
    if (!metadata) return null;
    
    const Icon = metadata.icon;
    const isFavorite = favorites.includes(blockType);
    const isSelected = selectedBlock === blockType;
    
    const rarityColors = {
      common: 'border-gray-400',
      uncommon: 'border-green-400',
      rare: 'border-blue-400',
      epic: 'border-purple-400',
      legendary: 'border-orange-400'
    };
    
    if (viewMode === 'grid') {
      return (
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`
            relative aspect-square rounded-lg p-4 cursor-pointer
            border-2 transition-all duration-200
            ${isSelected ? 'bg-blue-100 border-blue-500' : 'bg-gray-100 hover:bg-gray-200'}
            ${rarityColors[metadata.rarity || 'common']}
          `}
          onClick={() => onSelectBlock(blockType)}
        >
          {/* Block preview */}
          <div className="w-full h-full flex items-center justify-center">
            {Icon ? (
              <Icon size={32} style={{ color: metadata.previewColor }} />
            ) : (
              <div 
                className="w-12 h-12 rounded"
                style={{ backgroundColor: metadata.previewColor }}
              />
            )}
          </div>
          
          {/* Block name */}
          <div className="absolute bottom-1 left-1 right-1 text-xs text-center truncate">
            {metadata.name}
          </div>
          
          {/* Favorite star */}
          <button
            className="absolute top-1 right-1 p-1"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(blockType);
            }}
          >
            <Star 
              size={16} 
              className={isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}
            />
          </button>
          
          {/* Info button */}
          <button
            className="absolute top-1 left-1 p-1"
            onClick={(e) => {
              e.stopPropagation();
              setShowInfo(blockType);
            }}
          >
            <Info size={16} className="text-gray-400 hover:text-gray-600" />
          </button>
          
          {/* Stack size indicator (Minecraft-style) */}
          {metadata.stackSize && metadata.stackSize < 64 && (
            <div className="absolute bottom-1 right-1 text-xs font-bold text-gray-600">
              {metadata.stackSize}
            </div>
          )}
        </motion.div>
      );
    } else {
      // List view
      return (
        <motion.div
          whileHover={{ x: 4 }}
          className={`
            flex items-center gap-3 p-3 rounded-lg cursor-pointer
            border transition-all duration-200
            ${isSelected ? 'bg-blue-100 border-blue-500' : 'bg-gray-50 hover:bg-gray-100 border-gray-200'}
          `}
          onClick={() => onSelectBlock(blockType)}
        >
          {Icon ? (
            <Icon size={24} style={{ color: metadata.previewColor }} />
          ) : (
            <div 
              className="w-6 h-6 rounded"
              style={{ backgroundColor: metadata.previewColor }}
            />
          )}
          
          <div className="flex-1">
            <div className="font-medium">{metadata.name}</div>
            <div className="text-xs text-gray-500">{metadata.description}</div>
          </div>
          
          <div className="flex items-center gap-2">
            {metadata.price && (
              <div className="text-sm text-gray-600">💰 {metadata.price}</div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(blockType);
              }}
            >
              <Star 
                size={16} 
                className={isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}
              />
            </button>
          </div>
        </motion.div>
      );
    }
  };
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={onClose}
          />
          
          {/* Inventory panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 20 }}
            className="fixed bottom-0 left-0 right-0 bg-white rounded-t-xl shadow-2xl z-50"
            style={{ height: '70vh' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Layers /> Creative Inventory
              </h2>
              
              <div className="flex items-center gap-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search blocks..."
                    className="pl-10 pr-4 py-2 border rounded-lg w-64"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                {/* View mode toggle */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                  <button
                    className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white shadow' : ''}`}
                    onClick={() => setViewMode('grid')}
                  >
                    <Grid size={20} />
                  </button>
                  <button
                    className={`p-2 rounded ${viewMode === 'list' ? 'bg-white shadow' : ''}`}
                    onClick={() => setViewMode('list')}
                  >
                    <List size={20} />
                  </button>
                </div>
                
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="flex h-full">
              {/* Categories sidebar */}
              <div className="w-48 border-r bg-gray-50 p-4">
                <div className="space-y-1">
                  {/* Dynamic categories */}
                  {dynamicCategories.map(category => {
                    const Icon = category.icon;
                    const count = category.id === 'recent' ? recentBlocks.length : favorites.length;
                    
                    return (
                      <button
                        key={category.id}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2 rounded-lg
                          transition-colors duration-200 text-left
                          ${selectedCategory === category.id ? 'bg-white shadow text-blue-600' : 'hover:bg-gray-100'}
                        `}
                        onClick={() => setSelectedCategory(category.id)}
                      >
                        <Icon size={20} style={{ color: category.color }} />
                        <span className="flex-1">{category.name}</span>
                        <span className="text-xs text-gray-500">{count}</span>
                      </button>
                    );
                  })}
                  
                  <div className="h-px bg-gray-200 my-2" />
                  
                  {/* Static categories */}
                  {blockCategories.map(category => {
                    const Icon = category.icon;
                    
                    return (
                      <button
                        key={category.id}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2 rounded-lg
                          transition-colors duration-200 text-left
                          ${selectedCategory === category.id ? 'bg-white shadow text-blue-600' : 'hover:bg-gray-100'}
                        `}
                        onClick={() => setSelectedCategory(category.id)}
                      >
                        <Icon size={20} style={{ color: category.color }} />
                        <span className="flex-1">{category.name}</span>
                        <span className="text-xs text-gray-500">{category.blocks.length}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              {/* Blocks grid/list */}
              <div className="flex-1 p-4 overflow-y-auto">
                {displayBlocks.length > 0 ? (
                  <div className={
                    viewMode === 'grid' 
                      ? 'grid grid-cols-6 gap-3' 
                      : 'space-y-2'
                  }>
                    {displayBlocks.map(blockType => (
                      <BlockItem key={blockType} blockType={blockType} />
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <div className="text-center">
                      <Search size={48} className="mx-auto mb-4 opacity-50" />
                      <p>No blocks found</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
          
          {/* Block info modal */}
          <AnimatePresence>
            {showInfo && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="fixed inset-0 flex items-center justify-center z-[60] p-4"
                onClick={() => setShowInfo(null)}
              >
                <div 
                  className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  {(() => {
                    const metadata = getBlockMetadata(showInfo);
                    if (!metadata) return null;
                    const Icon = metadata.icon;
                    
                    return (
                      <>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            {Icon ? (
                              <Icon size={32} style={{ color: metadata.previewColor }} />
                            ) : (
                              <div 
                                className="w-8 h-8 rounded"
                                style={{ backgroundColor: metadata.previewColor }}
                              />
                            )}
                            <div>
                              <h3 className="text-lg font-bold">{metadata.name}</h3>
                              <p className="text-sm text-gray-500">{metadata.type}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setShowInfo(null)}
                            className="p-1 hover:bg-gray-100 rounded"
                          >
                            <X size={20} />
                          </button>
                        </div>
                        
                        <p className="text-gray-600 mb-4">{metadata.description}</p>
                        
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Category:</span>
                            <span className="font-medium">{metadata.category}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Rarity:</span>
                            <span className={`font-medium capitalize`}>{metadata.rarity}</span>
                          </div>
                          {metadata.price && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Price:</span>
                              <span className="font-medium">💰 {metadata.price}</span>
                            </div>
                          )}
                          {metadata.stackSize && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Stack Size:</span>
                              <span className="font-medium">{metadata.stackSize}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-gray-500">Can Rotate:</span>
                            <span className="font-medium">{metadata.canRotate ? '✓' : '✗'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Can Paint:</span>
                            <span className="font-medium">{metadata.canPaint ? '✓' : '✗'}</span>
                          </div>
                        </div>
                        
                        <div className="mt-4 flex gap-2">
                          <button
                            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                            onClick={() => {
                              onSelectBlock(showInfo);
                              setShowInfo(null);
                              onClose();
                            }}
                          >
                            Select Block
                          </button>
                          <button
                            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                            onClick={() => toggleFavorite(showInfo)}
                          >
                            <Star 
                              size={20} 
                              className={favorites.includes(showInfo) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}
                            />
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
};
