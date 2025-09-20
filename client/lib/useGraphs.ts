"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
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
  is_favorite?: boolean;
}

export interface Node {
  id: string;
  graph_id: string;
  type: 'chat' | 'artefact' | 'asset';
  content_id?: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  title: string;
}

export interface Edge {
  id: string;
  graph_id: string;
  source_node_id: string;
  target_node_id: string;
  type: 'DERIVED_FROM';
}

export interface NodeContent {
  [nodeId: string]: any; // Chat messages, artefact data, or asset data
}

export interface FullGraph {
  graph: Graph;
  nodes: Node[];
  edges: Edge[];
  nodeContent: NodeContent;
}

export function useGraphs() {
  const [graphs, setGraphs] = useState<Graph[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false); // Add creation state
  const apiClient = useApiClient();
  const { isLoaded, isSignedIn } = useAuth();

  const loadGraphs = async () => {
    setLoading(true);
    setError(null);
    try {
      const graphsData = await apiClient.listGraphs();
      setGraphs(graphsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load graphs');
    } finally {
      setLoading(false);
    }
  };

  const createGraph = async (name: string, userId: string, emoji?: string, description?: string, colors?: string) => {
    // Prevent duplicate calls
    if (isCreating) {
      throw new Error('Graph creation already in progress');
    }
    
    setIsCreating(true);
    try {
      const newGraph = await apiClient.createGraph({ 
        user_id: userId, 
        name, 
        emoji, 
        description,
        colors  // Pass the extracted color from emoji
      });
      setGraphs(prev => [...prev, newGraph]);
      return newGraph;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create graph');
      throw err;
    } finally {
      setIsCreating(false);
    }
  };

  const deleteGraph = async (graphId: string) => {
    try {
      await apiClient.deleteGraph(graphId);
      setGraphs(prev => prev.filter(g => g.id !== graphId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete graph');
      throw err;
    }
  };

  const toggleFavorite = async (graphId: string) => {
    try {
      const updatedGraph = await apiClient.toggleGraphFavorite(graphId);
      setGraphs(prev => prev.map(g => g.id === graphId ? updatedGraph : g));
      return updatedGraph;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle favorite');
      throw err;
    }
  };

  const duplicateGraph = async (graphId: string) => {
    try {
      const duplicatedGraph = await apiClient.duplicateGraph(graphId);
      setGraphs(prev => [...prev, duplicatedGraph]);
      return duplicatedGraph;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate graph');
      throw err;
    }
  };

  const updateGraph = async (graphId: string, updates: { name?: string; emoji?: string; description?: string; colors?: string }) => {
    try {
      const updatedGraph = await apiClient.updateGraph(graphId, updates);
      setGraphs(prev => prev.map(g => g.id === graphId ? updatedGraph : g));
      return updatedGraph;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update graph');
      throw err;
    }
  };

  const loadFullGraph = async (graphId: string): Promise<FullGraph> => {
    setLoading(true);
    setError(null);
    
    try {
      // Load graph metadata
      const graph = await apiClient.getGraph(graphId);
      
      // Load all nodes
      const nodes = await apiClient.listNodes(graphId);
      
      // Load all edges
      const edges = await apiClient.listEdges(graphId);
      
      // Load content for each node
      const nodeContent: NodeContent = {};
      
      for (const node of nodes) {
        try {
          switch (node.type) {
            case 'chat':
              if (node.content_id) {
                nodeContent[node.id] = await apiClient.getChatMessages(node.content_id);
              }
              break;
            case 'artefact':
              if (node.content_id) {
                nodeContent[node.id] = await apiClient.getArtefact(node.content_id);
              }
              break;
            case 'asset':
              if (node.content_id) {
                nodeContent[node.id] = await apiClient.getAsset(graphId, node.content_id);
              }
              break;
          }
        } catch (err) {
          logger.warn(`Failed to load content for node ${node.id}:`, err);
        }
      }
      
      return { graph, nodes, edges, nodeContent };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load graph');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      loadGraphs();
    }
  }, [isLoaded, isSignedIn]);

  const refreshGraphs = () => {
    loadGraphs();
  };

  return {
    graphs,
    loading,
    error,
    loadGraphs,
    createGraph,
    deleteGraph,
    toggleFavorite,
    duplicateGraph,
    updateGraph,
    loadFullGraph,
    refreshGraphs,
  };
} 