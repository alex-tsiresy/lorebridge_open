"use client";

import React, { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useStore, useReactFlow } from '@xyflow/react';
import { Node } from '@xyflow/react';

interface HandleProximity {
  handleId: string;
  distance: number;
  isNear: boolean;
}

interface ConnectionContextType {
  isConnecting: boolean;
  isHandleNearCursor: (nodeId: string, handleId: string, threshold?: number) => boolean;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export const useConnection = () => {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return context;
};

interface ConnectionProviderProps {
  children: React.ReactNode;
}

export const ConnectionProvider: React.FC<ConnectionProviderProps> = ({ children }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const { screenToFlowPosition } = useReactFlow();
  
  // Track connection state from React Flow store
  const connectionState = useStore((state) => state.connection);
  const nodes = useStore((state) => state.nodes);
  const edges = useStore((state) => state.edges);
  
  // Always track mouse position (simpler approach)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Always update position during connection
      if (connectionState.inProgress) {
        try {
          const flowPosition = screenToFlowPosition({ x: e.clientX, y: e.clientY });
          setCursorPosition(flowPosition);
        } catch {
          // Fallback to screen coordinates
          setCursorPosition({ x: e.clientX, y: e.clientY });
        }
      }
    };
    
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [screenToFlowPosition, connectionState.inProgress]);
  
  // Update connection state - simpler detection
  useEffect(() => {
    const nowConnecting = connectionState.inProgress;
    setIsConnecting(nowConnecting);
    
    if (!nowConnecting) {
      setCursorPosition(null);
    }
  }, [connectionState.inProgress]);
  

  // Simple function: is cursor near this specific handle during connection?
  const isHandleNearCursor = useCallback((nodeId: string, handleId: string, threshold: number = 120): boolean => {
    // Always show handles during connection creation
    if (connectionState.inProgress) {
      return true;
    }
    
    return false;
  }, [connectionState.inProgress]);
  
  const value: ConnectionContextType = {
    isConnecting,
    isHandleNearCursor,
  };
  
  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
};