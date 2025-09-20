"use client";

import { useState, useEffect, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';

/**
 * Hook to synchronize node content with full screen components
 * Ensures content is available immediately when entering full screen mode
 */
export function useNodeContentSync(nodeId: string) {
  const { getNode } = useReactFlow();
  const [syncedData, setSyncedData] = useState<any>(null);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    // Get initial node data immediately
    const node = getNode(nodeId);
    if (node) {
      setSyncedData(node.data);
      lastUpdateRef.current = Date.now();
    }

    // Listen for node updates
    const handleNodeUpdate = () => {
      const updatedNode = getNode(nodeId);
      if (updatedNode && Date.now() - lastUpdateRef.current > 50) { // Throttle updates
        setSyncedData(updatedNode.data);
        lastUpdateRef.current = Date.now();
      }
    };

    // Set up polling for node changes (fallback)
    const interval = setInterval(handleNodeUpdate, 100);

    // Listen for custom events for immediate updates
    window.addEventListener('node-content-updated', handleNodeUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('node-content-updated', handleNodeUpdate);
    };
  }, [nodeId, getNode]);

  return syncedData;
}

/**
 * Utility to broadcast node updates to full screen components
 */
export function broadcastNodeUpdate(nodeId: string) {
  const event = new CustomEvent('node-content-updated', {
    detail: { nodeId }
  });
  window.dispatchEvent(event);
}