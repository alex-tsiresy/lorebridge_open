"use client";

// Fixed: Added missing getRecentGraphs and recordGraphAccess methods to ApiClient
// Added corresponding backend endpoints and updated Graph model with last_accessed_at field

import { useState, useEffect } from 'react';
import { useApiClient } from './useApiClient';
import { logger } from '@/lib/logger';

export interface Graph {
  id: string;
  user_id: string;
  name: string;
  emoji?: string;
  description?: string;
  colors?: string;  // Store the extracted color from emoji
  created_at?: string;
  last_accessed_at?: string;
  is_favorite?: boolean;
}

export function useRecentGraphs(limit: number = 10) {
  const [recentGraphs, setRecentGraphs] = useState<Graph[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();

  const loadRecentGraphs = async () => {
    setLoading(true);
    setError(null);
    try {
      const graphsData = await apiClient.getRecentGraphs(limit);
      setRecentGraphs(graphsData as Graph[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recent graphs');
    } finally {
      setLoading(false);
    }
  };

  const recordGraphAccess = async (graphId: string) => {
    try {
      await apiClient.recordGraphAccess(graphId);
      // Refresh recent graphs after recording access
      await loadRecentGraphs();
    } catch (err) {
      logger.error('Failed to record graph access:', err);
      // Don't throw error for access recording - it's not critical
    }
  };

  const refreshRecentGraphs = () => {
    loadRecentGraphs();
  };

  const toggleFavorite = async (graphId: string) => {
    try {
      const updatedGraph = await apiClient.toggleGraphFavorite(graphId);
      setRecentGraphs(prev => prev.map(g => g.id === graphId ? updatedGraph : g));
      return updatedGraph;
    } catch (err) {
      logger.error('Failed to toggle favorite:', err);
      throw err;
    }
  };

  const duplicateGraph = async (graphId: string) => {
    try {
      const duplicatedGraph = await apiClient.duplicateGraph(graphId);
      // Refresh the recent graphs list to include the new graph
      await loadRecentGraphs();
      return duplicatedGraph;
    } catch (err) {
      logger.error('Failed to duplicate graph:', err);
      throw err;
    }
  };

  const updateGraph = async (graphId: string, updates: { name?: string; emoji?: string; description?: string; colors?: string }) => {
    try {
      const updatedGraph = await apiClient.updateGraph(graphId, updates);
      setRecentGraphs(prev => prev.map(g => g.id === graphId ? updatedGraph : g));
      return updatedGraph;
    } catch (err) {
      logger.error('Failed to update graph:', err);
      throw err;
    }
  };

  const deleteGraph = async (graphId: string) => {
    try {
      await apiClient.deleteGraph(graphId);
      setRecentGraphs(prev => prev.filter(g => g.id !== graphId));
    } catch (err) {
      logger.error('Failed to delete graph:', err);
      throw err;
    }
  };

  useEffect(() => {
    loadRecentGraphs();
  }, [limit]);

  return {
    recentGraphs,
    loading,
    error,
    loadRecentGraphs,
    recordGraphAccess,
    refreshRecentGraphs,
    toggleFavorite,
    duplicateGraph,
    updateGraph,
    deleteGraph,
  };
} 