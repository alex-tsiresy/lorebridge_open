"use client";

import React, { useState, useEffect } from "react";
import { Heart, Star, LayoutGrid, FileText, Trash2, Copy, Edit, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EditGraphModal } from "./EditGraphModal";
import { DeleteConfirmationModal } from "./DeleteConfirmationModal";
import { NODE_COLORS, STICKY_NOTE_CONFIG } from "./flow/constants";
import { logger } from '@/lib/logger';

interface GraphCardProps {
  id: string;
  title: string;
  description: string;
  lastUpdated: string;
  isFavorite: boolean;
  icon?: React.ReactNode;
  iconBgColor?: string;
  storedColor?: string;  // Add stored color prop
  onFavoriteToggle?: (id: string) => void;
  onDelete?: (id: string) => void;
  onClick?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onEdit?: (id: string) => void;
  onUpdate?: (graphId: string, updates: { name?: string; emoji?: string; description?: string; colors?: string }) => Promise<any>;
  showDelete?: boolean;
  showArrow?: boolean;
}

export function GraphCard({
  id,
  title,
  description,
  lastUpdated,
  isFavorite,
  icon = <LayoutGrid className="h-6 w-6 text-white" />,
  iconBgColor = "from-blue-500 to-purple-600",
  storedColor,  // Add stored color prop
  onFavoriteToggle,
  onDelete,
  onClick,
  onDuplicate,
  onEdit,
  onUpdate,
  showDelete = false,
  showArrow = true,
}: GraphCardProps) {
  const [dynamicBgColor, setDynamicBgColor] = useState(iconBgColor);
  const [isEmoji, setIsEmoji] = useState(false);
  const [customGradient, setCustomGradient] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isOneColumn, setIsOneColumn] = useState(false);

  // Function to calculate brightness and adjust very bright colors
  const adjustBrightness = (rgbColor: string): string => {
    if (!rgbColor.startsWith('rgb(')) return rgbColor;
    
    // Extract RGB values
    const match = rgbColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return rgbColor;
    
    const [, r, g, b] = match;
    const red = parseInt(r);
    const green = parseInt(g);
    const blue = parseInt(b);
    
    // Calculate brightness (0-255)
    const brightness = (red * 299 + green * 587 + blue * 114) / 1000;
    
    // If brightness is very high (>200), darken the color slightly
    if (brightness > 200) {
      const darkenFactor = 0.7; // Darken by 30%
      const newRed = Math.round(red * darkenFactor);
      const newGreen = Math.round(green * darkenFactor);
      const newBlue = Math.round(blue * darkenFactor);
      return `rgb(${newRed}, ${newGreen}, ${newBlue})`;
    }
    
    return rgbColor;
  };

  // Check for mobile device and column layout
  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                           'ontouchstart' in window || 
                           window.innerWidth <= 768;
      setIsMobile(isMobileDevice);
      
      // Check if we're in single column layout (below 680px)
      setIsOneColumn(window.innerWidth < 680);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Calculate intelligent text color based on background brightness
  const getTextColor = (backgroundColor?: string) => {
    if (!backgroundColor) {
      return NODE_COLORS.GRAPH.textColor; // Default fallback
    }
    
    let r = 0, g = 0, b = 0;
    
    if (backgroundColor.startsWith('rgb(')) {
      // Parse RGB color
      const match = backgroundColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        r = parseInt(match[1]);
        g = parseInt(match[2]);
        b = parseInt(match[3]);
      }
    } else if (backgroundColor.startsWith('#')) {
      // Parse hex color
      const hex = backgroundColor.replace('#', '');
      r = parseInt(hex.substr(0, 2), 16);
      g = parseInt(hex.substr(2, 2), 16);
      b = parseInt(hex.substr(4, 2), 16);
    }
    
    // Calculate brightness using relative luminance formula
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    // Return dark text for light backgrounds, light text for dark backgrounds
    return brightness > 186 ? '#1f2937' : '#374151'; // Always use readable dark colors since we lighten backgrounds
  };

  // GraphCard colors - vibrant but balanced for sticky note style
  const STICKY_NOTE_COLORS = [
    '#a5c9ff', // Balanced vibrant blue - toned down slightly
    '#96f2b5', // Balanced vibrant green - toned down slightly  
    '#d1c4fd', // Balanced vibrant purple - toned down slightly
    '#fb8a8a', // Balanced vibrant coral - toned down slightly
    '#fdd75b', // Balanced vibrant yellow - toned down slightly
    '#7fecbd', // Balanced vibrant emerald - toned down slightly
  ];

  // Get a consistent color based on the graph ID (deterministic randomness)
  const getAssignedStickyNoteColor = (graphId: string): string => {
    // Create a simple hash from the ID to ensure consistency
    let hash = 0;
    for (let i = 0; i < graphId.length; i++) {
      const char = graphId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    // Use absolute value to ensure positive index
    const index = Math.abs(hash) % STICKY_NOTE_COLORS.length;
    return STICKY_NOTE_COLORS[index];
  };

  // Get sticky note styling function with assigned color selection
  const getStickyNoteStyle = (selected: boolean = false) => {
    // Use a consistent color based on the graph ID
    const baseColor = getAssignedStickyNoteColor(id);
    
    return {
      backgroundColor: baseColor,
      borderRadius: STICKY_NOTE_CONFIG.BORDER_RADIUS,
      boxShadow: selected 
        ? '12px 12px 35px rgba(0, 0, 0, 0.6), 6px 6px 20px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)' 
        : '8px 8px 25px rgba(0, 0, 0, 0.5), 4px 4px 15px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
      position: 'relative' as const,
      width: '100%',
      height: '100%',
      minWidth: '400px',
      minHeight: '400px',
      transition: 'all 0.3s ease-in-out',
      transform: 'scale(1)',
      // Very subtle paper texture with minimal blending (no dots)
      backgroundImage: `
        linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.03) 50%, transparent 50%, transparent 75%, rgba(255,255,255,0.03) 75%),
        linear-gradient(135deg, transparent 25%, rgba(0,0,0,0.015) 25%, rgba(0,0,0,0.015) 50%, transparent 50%, transparent 75%, rgba(0,0,0,0.015) 75%)
      `,
      backgroundSize: '16px 16px, 12px 12px',
      backgroundBlendMode: 'overlay',
    };
  };

  // Check if icon is an emoji (string)
  useEffect(() => {
    if (typeof icon === 'string' && icon.length > 0) {
      setIsEmoji(true);
      // If we have a stored color, use it directly
      if (storedColor) {
        // Handle RGB color format from database
        if (storedColor.startsWith('rgb(')) {
          // Adjust brightness for very bright colors
          const adjustedColor = adjustBrightness(storedColor);
          setDynamicBgColor(''); // No Tailwind class needed
          setCustomGradient(`linear-gradient(to bottom right, ${adjustedColor}, ${adjustedColor})`);
        } else {
          // Handle hex colors if they exist
          setDynamicBgColor(`from-[${storedColor}] to-[${storedColor}]`);
          setCustomGradient(`linear-gradient(to bottom right, ${storedColor}, ${storedColor})`);
        }
      } else {
        // Use a proper fallback gradient for emojis without stored color
        setDynamicBgColor("from-blue-500 to-purple-600");
        setCustomGradient("linear-gradient(to bottom right, rgb(59, 130, 246), rgb(147, 51, 234))");
      }
    } else {
      setIsEmoji(false);
      setDynamicBgColor(iconBgColor);
      setCustomGradient(null);
    }
  }, [icon, iconBgColor, storedColor]);

  const handleFavoriteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFavoriteToggle?.(id);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    await onDelete?.(id);
  };

  const handleDuplicate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Prevent multiple rapid clicks
    if (isDuplicating) return;
    
    setIsDuplicating(true);
    try {
      await onDuplicate?.(id);
    } catch (error) {
      logger.error('Failed to duplicate graph:', error);
    } finally {
      // Add a small delay to prevent rapid successive clicks
      setTimeout(() => {
        setIsDuplicating(false);
      }, 1000);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    setShowEditModal(true);
  };

  const handleClick = () => {
    onClick?.(id);
  };

  return (
    <>
      <div
        className={`sticky-note-container p-6 transition-all duration-300 cursor-pointer ${isOneColumn ? 'aspect-square' : 'h-80'} flex flex-col group relative overflow-hidden hover:-translate-y-3 hover:scale-[1.03]`}
        style={{
          ...getStickyNoteStyle(false),
          // Override specific properties for card sizing and behavior - make responsive
          minWidth: '280px', // Slightly smaller minimum for better mobile fit
          minHeight: isOneColumn ? 'auto' : '320px', // Let aspect-square handle height in single column
          // Enhanced shadow on hover
          boxShadow: '8px 8px 25px rgba(0, 0, 0, 0.5), 4px 4px 15px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
          // Ensure all positioning is preserved
          position: 'relative' as const,
          width: '100%',
          height: isOneColumn ? 'auto' : '100%',
        }}
        onMouseEnter={(e) => {
          const target = e.currentTarget;
          target.style.boxShadow = '12px 12px 35px rgba(0, 0, 0, 0.6), 6px 6px 20px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)';
        }}
        onMouseLeave={(e) => {
          const target = e.currentTarget;
          target.style.boxShadow = '8px 8px 25px rgba(0, 0, 0, 0.5), 4px 4px 15px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
        }}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {/* Header with icon and favorite button */}
        <div className="flex items-start justify-between mb-4">
          <div 
            className={`h-12 w-12 flex items-center justify-center rounded-lg ${
              isEmoji ? 'shadow-md backdrop-blur-md' : `shadow-[0_10px_25px_-5px_rgba(0,0,0,0.3)] backdrop-blur-md bg-gradient-to-br ${dynamicBgColor}`
            }`}
            style={isEmoji ? {
              backgroundColor: getAssignedStickyNoteColor(id).replace('rgb(', 'rgba(').replace(')', ', 0.1)') || 'rgba(255, 255, 255, 0.4)',
              backdropFilter: 'blur(20px) saturate(180%)',
              border: `1px solid ${getAssignedStickyNoteColor(id).replace('rgb(', 'rgba(').replace(')', ', 0.03)') || 'rgba(255, 255, 255, 0.15)'}`,
              WebkitBackdropFilter: 'blur(20px) saturate(180%)'
            } : undefined}
          >
            {isEmoji ? (
              <span className="text-2xl">{icon}</span>
            ) : (
              icon
            )}
          </div>
          
          {/* Favorite button - positioned on the right */}
          <button
            onClick={handleFavoriteToggle}
            className="p-1.5 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 hover:bg-white/20 backdrop-blur-sm"
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart 
              className={`h-5 w-5 ${isFavorite ? 'text-red-500 fill-red-500' : 'text-red-400 hover:text-red-500'}`} 
            />
          </button>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold mb-2 line-clamp-1" style={{ color: '#1f2937' }}>
          {title}
        </h3>

        {/* Description */}
        <p className="text-sm mb-4 flex-1 line-clamp-3" style={{ color: '#374151' }}>
          {description}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between text-sm mt-auto" style={{ color: '#374151' }}>
          <span>{lastUpdated}</span>
          
          {/* Action buttons - edit, duplicate and delete */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleEdit}
              className={`${
                isMobile 
                  ? 'opacity-100 transition-all duration-200' 
                  : 'opacity-0 group-hover:opacity-100 transition-all duration-200'
              } p-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 hover:bg-white/20 backdrop-blur-sm`}
              title="Edit graph"
              aria-label="Edit graph"
            >
              <Edit className="h-4 w-4 text-green-500" />
            </button>
            <button
              onClick={handleDuplicate}
              disabled={isDuplicating}
              className={`${
                isMobile 
                  ? 'opacity-100 transition-all duration-200' 
                  : 'opacity-0 group-hover:opacity-100 transition-all duration-200'
              } p-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 hover:bg-white/20 backdrop-blur-sm ${isDuplicating ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={isDuplicating ? "Duplicating..." : "Duplicate graph"}
              aria-label={isDuplicating ? "Duplicating..." : "Duplicate graph"}
            >
              {isDuplicating ? (
                <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
              ) : (
                <Copy className="h-4 w-4 text-blue-500" />
              )}
            </button>
            {showDelete && (
              <button
                onClick={handleDelete}
                className={`${
                  isMobile 
                    ? 'opacity-100 transition-all duration-200' 
                    : 'opacity-0 group-hover:opacity-100 transition-all duration-200'
                } p-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 hover:bg-white/20 backdrop-blur-sm`}
                title="Delete graph"
                aria-label="Delete graph"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Edit Graph Modal */}
      <EditGraphModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        graph={{
          id,
          name: title,
          emoji: typeof icon === 'string' ? icon : undefined,
          description,
          colors: storedColor,
        }}
        updateGraph={onUpdate}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Board"
        message="Are you sure you want to delete this board? This will permanently remove the board and all its content."
        itemName={title}
      />
    </>
  );
} 