"use client";

import React, { createContext, useContext, useState } from 'react';

interface FullScreenContextType {
  fullScreenNodeId: string | null;
  setFullScreenNodeId: (nodeId: string | null) => void;
  isFullScreen: boolean;
}

const FullScreenContext = createContext<FullScreenContextType | undefined>(undefined);

export function FullScreenProvider({ children }: { children: React.ReactNode }) {
  const [fullScreenNodeId, setFullScreenNodeId] = useState<string | null>(null);

  const isFullScreen = fullScreenNodeId !== null;

  return (
    <FullScreenContext.Provider value={{ 
      fullScreenNodeId, 
      setFullScreenNodeId, 
      isFullScreen 
    }}>
      {children}
    </FullScreenContext.Provider>
  );
}

export function useFullScreen() {
  const context = useContext(FullScreenContext);
  if (context === undefined) {
    throw new Error('useFullScreen must be used within a FullScreenProvider');
  }
  return context;
} 