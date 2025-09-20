"use client";

import React from "react";
import { Clock, FileText } from "lucide-react";
import { GraphCard } from "./GraphCard";
import { useRecentGraphs } from "@/lib/useRecentGraphs";
import * as Separator from '@radix-ui/react-separator';
import { cn } from "@/lib/utils";
import { logger } from '@/lib/logger';

interface SpacingConfig {
  padding: string;
  maxWidth: string;
  gap: string;
}

interface RecentViewProps {
  onSelect?: (graphId: string) => void;
  spacing?: SpacingConfig;
}

export function RecentView({ onSelect, spacing }: RecentViewProps) {
  const { recentGraphs, loading, error, recordGraphAccess, toggleFavorite, duplicateGraph, updateGraph, deleteGraph } = useRecentGraphs(12);

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

  const handleFavoriteToggle = async (id: string) => {
    try {
      await toggleFavorite(id);
    } catch (err) {
      logger.error('Failed to toggle favorite:', err);
    }
  };

  const handleCardClick = async (id: string) => {
    try {
      // Record graph access when clicked
      await recordGraphAccess(id);
      // Navigate to graph if onSelect is provided
      if (onSelect) {
        onSelect(id);
      } else {
        logger.log("Navigate to graph:", id);
      }
    } catch (error) {
      logger.error("Failed to record graph access:", error);
      // Still navigate even if access recording fails
      if (onSelect) {
        onSelect(id);
      }
    }
  };

  const handleDuplicateGraph = async (graphId: string) => {
    try {
      const duplicatedGraph = await duplicateGraph(graphId);
      // Don't automatically open the duplicated graph
      logger.log('Graph duplicated successfully:', duplicatedGraph.name);
    } catch (err) {
      logger.error('Failed to duplicate graph:', err);
    }
  };

  const handleDeleteGraph = async (graphId: string) => {
    try {
      await deleteGraph(graphId);
    } catch (err) {
      logger.error('Failed to delete graph:', err);
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

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex-1 p-6 md:p-10 min-h-0">
        <div className="max-w-7xl 2xl:max-w-screen-2xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="h-8 w-8 text-blue-500" />
              <h1 className="text-3xl font-bold text-gray-900">Recent</h1>
            </div>
            <p className="text-gray-600">Your Recent Graphs, Nodes, and Edges</p>
          </div>

          {error && (
            <div className="w-full p-4 mb-6 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-red-600 text-sm font-medium">Error</div>
              <div className="text-red-600 text-sm">{error}</div>
            </div>
          )}

          {/* Recent Content Grid */}
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
            ) : recentGraphs.length === 0 ? (
              // Empty state
              <div className="col-span-full">
                <div className="text-center py-12">
                  <Clock className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No recent activity</h3>
                  <p className="text-gray-600">
                    Start exploring your knowledge graphs to see your recent activity here.
                  </p>
                </div>
              </div>
            ) : (
              // Actual recent graphs
              recentGraphs.map(graph => (
                <GraphCard
                  key={graph.id}
                  id={graph.id}
                  title={graph.name}
                  description={graph.description || "No description provided"}
                  lastUpdated={graph.last_accessed_at ? formatDate(graph.last_accessed_at) : "Unknown"}
                  isFavorite={graph.is_favorite || false}
                  icon={graph.emoji || <FileText className="h-6 w-6 text-white" />}
                  iconBgColor={graph.emoji ? "from-gray-100 to-gray-200" : "from-green-500 to-blue-600"}
                  storedColor={graph.colors}  // Pass the stored color from the graph
                  onFavoriteToggle={handleFavoriteToggle}
                  onDuplicate={handleDuplicateGraph}
                  onDelete={handleDeleteGraph}
                  onUpdate={updateGraph}
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