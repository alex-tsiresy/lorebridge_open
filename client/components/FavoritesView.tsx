"use client";

import React, { useState, useEffect } from "react";
import { Heart, Star } from "lucide-react";
import { GraphCard } from "./GraphCard";
import * as Separator from '@radix-ui/react-separator';
import { cn } from "@/lib/utils";
import { useApiClient } from "@/lib/useApiClient";
import { logger } from '@/lib/logger';

interface SpacingConfig {
  padding: string;
  maxWidth: string;
  gap: string;
}

interface FavoritesViewProps {
  onSelect?: (graphId: string) => void;
  spacing?: SpacingConfig;
}

export function FavoritesView({ onSelect, spacing }: FavoritesViewProps) {
  const [favoriteGraphs, setFavoriteGraphs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();

  // Default spacing configuration if none provided
  const defaultSpacing = {
    padding: 'p-4',
    maxWidth: 'max-w-7xl',
    gap: 'gap-4'
  };

  const currentSpacing = spacing || defaultSpacing;

  // Generate responsive grid classes optimized for sticky note cards with no overlap
  const getGridClasses = () => {
    // Grid carefully optimized to prevent overlap at all screen sizes
    const baseGrid = `grid grid-cols-1 min-[680px]:grid-cols-2 min-[1100px]:grid-cols-3 2xl:grid-cols-4 auto-rows-fr`;
    
    // Use much larger gaps for 4-column layout and increase row gap too
    return `${baseGrid} ${currentSpacing.gap} 2xl:gap-x-12 2xl:gap-y-8`;
  };

  const loadFavoriteGraphs = async () => {
    setLoading(true);
    setError(null);
    try {
      const allGraphs = await apiClient.listGraphs();
      const favorites = allGraphs.filter((graph: any) => graph.is_favorite);
      setFavoriteGraphs(favorites);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load favorite graphs');
    } finally {
      setLoading(false);
    }
  };

  const handleFavoriteToggle = async (id: string) => {
    try {
      await apiClient.toggleGraphFavorite(id);
      // Refresh the favorites list
      await loadFavoriteGraphs();
    } catch (err) {
      logger.error('Failed to toggle favorite:', err);
    }
  };

  const handleCardClick = (id: string) => {
    if (onSelect) {
      onSelect(id);
    } else {
      logger.log("Navigate to graph:", id);
    }
  };

  const handleDuplicateGraph = async (graphId: string) => {
    try {
      const duplicatedGraph = await apiClient.duplicateGraph(graphId);
      // Refresh the favorites list to include the new graph
      await loadFavoriteGraphs();
      // Don't automatically open the duplicated graph
      logger.log('Graph duplicated successfully:', duplicatedGraph.name);
    } catch (err) {
      logger.error('Failed to duplicate graph:', err);
    }
  };

  const handleDeleteGraph = async (graphId: string) => {
    try {
      await apiClient.deleteGraph(graphId);
      // Refresh the favorites list
      await loadFavoriteGraphs();
    } catch (err) {
      logger.error('Failed to delete graph:', err);
    }
  };

  const handleUpdateGraph = async (graphId: string, updates: { name?: string; emoji?: string; description?: string; colors?: string }) => {
    try {
      const updatedGraph = await apiClient.updateGraph(graphId, updates);
      // Refresh the favorites list to show updated data
      await loadFavoriteGraphs();
      return updatedGraph;
    } catch (err) {
      logger.error('Failed to update graph:', err);
      throw err;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${Math.floor(diffInHours)} hours ago`;
    if (diffInHours < 48) return "Yesterday";
    return date.toLocaleDateString();
  };

  useEffect(() => {
    loadFavoriteGraphs();
  }, []);

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex-1 p-6 md:p-10 min-h-0">
        <div className="max-w-7xl 2xl:max-w-screen-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Heart className="h-8 w-8 text-red-500" />
              <h1 className="text-3xl font-bold text-gray-900">Favorites</h1>
            </div>
            <p className="text-gray-600">Your Favorite Graphs, Nodes, and Edges</p>
          </div>

          {error && (
            <div className="w-full p-4 mb-6 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-red-600 text-sm font-medium">Error</div>
              <div className="text-red-600 text-sm">{error}</div>
            </div>
          )}

          {/* Content Grid */}
          <div className={getGridClasses()}>
            {loading ? (
              // Loading placeholders
              Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="bg-gray-50 rounded-lg border border-gray-200 p-6 animate-pulse h-80"
                >
                  <div className="h-12 w-12 bg-gray-200 rounded-lg mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded mb-4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))
            ) : favoriteGraphs.length === 0 ? (
              // Empty state
              <div className="col-span-full">
                <div className="text-center py-12">
                  <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No favorites yet</h3>
                  <p className="text-gray-600">
                    Start building your knowledge graphs and mark your favorites to see them here.
                  </p>
                </div>
              </div>
            ) : (
              // Actual favorite graphs
              favoriteGraphs.map(graph => (
                <GraphCard
                  key={graph.id}
                  id={graph.id}
                  title={graph.name}
                  description={graph.description || "No description provided"}
                  lastUpdated={formatDate(graph.created_at || '')}
                  isFavorite={graph.is_favorite || false}
                  icon={graph.emoji || <Star className="h-6 w-6 text-white" />}
                  iconBgColor={graph.emoji ? "from-gray-100 to-gray-200" : "from-red-500 to-pink-600"}
                  storedColor={graph.colors}  // Pass the stored color from the graph
                  onFavoriteToggle={handleFavoriteToggle}
                  onDuplicate={handleDuplicateGraph}
                  onDelete={handleDeleteGraph}
                  onUpdate={handleUpdateGraph}
                  onClick={handleCardClick}
                  showDelete={true}
                />
              ))
            )}
          </div>


        </div>
      </div>
    </div>
  );
} 