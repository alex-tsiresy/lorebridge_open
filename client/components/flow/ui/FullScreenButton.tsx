"use client";

import React from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useFullScreen } from '../context/FullScreenContext';
import { logger } from '@/lib/logger';

interface FullScreenButtonProps {
  nodeId: string;
  className?: string;
  isLoading?: boolean; // Optional prop for chat nodes
}

export function FullScreenButton({ nodeId, className = '', isLoading = false }: FullScreenButtonProps) {
  const { fullScreenNodeId, setFullScreenNodeId } = useFullScreen();
  const isCurrentlyFullScreen = fullScreenNodeId === nodeId;

  const handleToggleFullScreen = () => {
    logger.log('🔄 VIEW SWITCH:', {
      from: isCurrentlyFullScreen ? 'fullscreen' : 'node',
      to: isCurrentlyFullScreen ? 'node' : 'fullscreen',
      nodeId,
      isLoading
    });
    
    // Dispatch transition event
    const transitionEvent = new CustomEvent('fullscreen-transition', {
      detail: {
        from: isCurrentlyFullScreen ? 'fullscreen' : 'node',
        to: isCurrentlyFullScreen ? 'node' : 'fullscreen',
        nodeId,
        isLoading
      }
    });
    window.dispatchEvent(transitionEvent);
    
    if (isCurrentlyFullScreen) {
      setFullScreenNodeId(null);
    } else {
      setFullScreenNodeId(nodeId);
    }
  };

  const getTitle = () => {
    if (isCurrentlyFullScreen) {
      return isLoading ? 'Exit full screen (streaming in progress)' : 'Exit full screen';
    } else {
      return isLoading ? 'Enter full screen (streaming in progress)' : 'Enter full screen';
    }
  };

  return (
    <button
      onClick={handleToggleFullScreen}
      className={`p-1.5 rounded-md hover:bg-gray-100 transition-colors duration-200 ${className} ${
        isLoading ? 'animate-pulse' : ''
      }`}
      title={getTitle()}
      disabled={false} // Always enabled, even during streaming
    >
      {isCurrentlyFullScreen ? (
        <Minimize2 className={`h-4 w-4 ${isLoading ? 'text-blue-600' : 'text-gray-600'}`} />
      ) : (
        <Maximize2 className={`h-4 w-4 ${isLoading ? 'text-blue-600' : 'text-gray-600'}`} />
      )}
    </button>
  );
} 