"use client";

import React, { createContext, useContext } from 'react';

interface GraphContextType {
  graphId: string;
}

const GraphContext = createContext<GraphContextType | undefined>(undefined);

export function GraphProvider({ children, graphId }: { children: React.ReactNode; graphId: string }) {
  return (
    <GraphContext.Provider value={{ graphId }}>
      {children}
    </GraphContext.Provider>
  );
}

export function useGraphContext() {
  const context = useContext(GraphContext);
  if (context === undefined) {
    throw new Error('useGraphContext must be used within a GraphProvider');
  }
  return context;
} 