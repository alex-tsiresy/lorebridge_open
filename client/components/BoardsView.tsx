"use client";

import React, { useState, useRef, useEffect } from "react";
import { WhiteBoardView } from "./WhiteBoardView";
import { LayoutGrid, Plus, Search, X } from "lucide-react";
import { useGraphs } from "@/lib/useGraphs";
import { useUser } from "@clerk/nextjs";
import { useUserLimits } from "@/lib/useUserLimits";
import { GraphCard } from "./GraphCard";
import * as Dialog from '@radix-ui/react-dialog';
import * as Separator from '@radix-ui/react-separator';
import { Slot } from '@radix-ui/react-slot';
import { cn } from "@/lib/utils";
import EmojiPicker from 'emoji-picker-react';
import EmojiColorExtractor from "./EmojiColorExtractor";
import { rgbToTailwindGradient } from "@/lib/emojiColors";
import { logger } from '@/lib/logger';

interface SpacingConfig {
  padding: string;
  maxWidth: string;
  gap: string;
}

interface BoardsViewProps {
  onSelect?: (graphId: string) => void;
  spacing?: SpacingConfig;
}

export default function BoardsView({ onSelect, spacing }: BoardsViewProps) {
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGraphName, setNewGraphName] = useState("");
  const [newGraphEmoji, setNewGraphEmoji] = useState("📋");
  const [newGraphDescription, setNewGraphDescription] = useState("");
  const [newGraphColor, setNewGraphColor] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isCreatingGraph, setIsCreatingGraph] = useState(false); // Add loading state
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  
  const { graphs, loading, error, createGraph, deleteGraph, toggleFavorite, duplicateGraph, updateGraph } = useGraphs();
  const { user } = useUser();
  const { canCreateBoard, getBoardLimitMessage, isAtBoardLimit, currentBoardCount, maxBoards, isProUser } = useUserLimits();

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

  // If no onSelect is provided, use internal state for demo/standalone usage
  const handleSelect = onSelect || ((graphId: string) => setSelectedGraphId(graphId));

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  const handleCreateGraph = async () => {
    // Prevent duplicate calls
    if (isCreatingGraph || !newGraphName.trim() || !user) return;
    
    // Check board limits before attempting to create
    if (!canCreateBoard) {
      alert(getBoardLimitMessage() + " Upgrade to Pro for unlimited boards.");
      return;
    }
    
    setIsCreatingGraph(true);
    try {
      // Add a small delay to prevent rapid clicks
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const newGraph = await createGraph(newGraphName, user.id, newGraphEmoji, newGraphDescription, newGraphColor || undefined);
      setNewGraphName("");
      setNewGraphEmoji("📋");
      setNewGraphDescription("");
      setNewGraphColor(null);
      setShowCreateForm(false);
      // If newGraph is unknown, cast to any and access id
      handleSelect((newGraph as any).id);
    } catch (err) {
      logger.error('Failed to create graph:', err);
      // Don't close the form on error, let user try again
    } finally {
      setIsCreatingGraph(false);
    }
  };

  const handleDeleteGraph = async (graphId: string) => {
    try {
      await deleteGraph(graphId);
    } catch (err) {
      logger.error('Failed to delete graph:', err);
    }
  };

  const handleFavoriteToggle = async (id: string) => {
    try {
      await toggleFavorite(id);
    } catch (err) {
      logger.error('Failed to toggle favorite:', err);
    }
  };

  const handleDuplicateGraph = async (graphId: string) => {
    try {
      const duplicatedGraph = await duplicateGraph(graphId);
      // Don't automatically open the duplicated graph - just refresh the list
      logger.log('Graph duplicated successfully:', duplicatedGraph.name);
    } catch (err) {
      logger.error('Failed to duplicate graph:', err);
    }
  };

  if (!onSelect && selectedGraphId) {
    // Add a back button above the WhiteBoardView
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50">
        <button
          className="absolute top-6 left-6 bg-zinc-200 text-zinc-700 px-4 py-1 rounded hover:bg-zinc-300 transition-colors"
          onClick={() => setSelectedGraphId(null)}
        >
          ← Back to Boards
        </button>
        <WhiteBoardView graphId={selectedGraphId} onBack={() => setSelectedGraphId(null)} />
      </div>
    );
  }

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
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <LayoutGrid className="h-8 w-8 text-blue-600" />
                <h1 className="text-3xl font-bold text-gray-900">Boards</h1>
              </div>
              <button
                className={`inline-flex items-center justify-center gap-2 px-4 py-2 font-medium rounded-none focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-200 ${
                  canCreateBoard 
                    ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500' 
                    : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                }`}
                onClick={() => canCreateBoard ? setShowCreateForm(true) : alert(getBoardLimitMessage() + " Upgrade to Pro for unlimited boards.")}
                title={canCreateBoard ? "Create new board" : getBoardLimitMessage()}
                disabled={!canCreateBoard}
              >
                <Plus className="h-4 w-4" />
                <span>Create Board</span>
                {!isProUser && (
                  <span className="text-xs opacity-75">
                    ({currentBoardCount}/{maxBoards === Infinity ? '∞' : maxBoards})
                  </span>
                )}
              </button>
            </div>
            <p className="text-gray-600">Your Graphs, Nodes, and Edges</p>
            {!isProUser && (
              <div className={`mt-3 p-3 rounded-lg border text-sm ${
                isAtBoardLimit 
                  ? 'bg-red-50 border-red-200 text-red-700' 
                  : 'bg-blue-50 border-blue-200 text-blue-700'
              }`}>
                {getBoardLimitMessage()} {isAtBoardLimit && 'Upgrade to Pro for unlimited boards.'}
              </div>
            )}
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
            ) : graphs.length === 0 ? (
              // Empty state
              <div className="col-span-full flex justify-center">
                <div 
                  className="bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 border-2 border-dashed border-gray-300 p-6 text-center hover:shadow-xl hover:shadow-blue-300/20 transition-all duration-500 cursor-pointer h-80 w-80 flex flex-col justify-center hover:border-blue-400 hover:-translate-y-2 hover:scale-105 group"
                  onClick={() => setShowCreateForm(true)}
                  style={{
                    background: 'linear-gradient(-45deg, #f9fafb, #eff6ff, #f3e8ff, #f9fafb)',
                    backgroundSize: '400% 400%',
                    animation: 'gradientShift 4s ease-in-out infinite'
                  }}
                >
                  <Plus className="h-12 w-12 text-gray-400 mx-auto my-auto transition-all duration-500 group-hover:rotate-180 group-hover:text-blue-600 group-hover:scale-125 group-hover:drop-shadow-lg" 
                    style={{ animation: 'float 3s ease-in-out infinite' }} />
                </div>
              </div>
            ) : (
              // Actual graphs
              graphs.map(graph => (
                <GraphCard
                  key={graph.id}
                  id={graph.id}
                  title={graph.name}
                  description={graph.description || "No description provided"}
                  lastUpdated={formatDate(graph.created_at || '')}
                  isFavorite={graph.is_favorite || false}
                  icon={graph.emoji || <LayoutGrid className="h-6 w-6 text-white" />}
                  iconBgColor={graph.emoji ? "from-gray-100 to-gray-200" : "from-blue-500 to-purple-600"}
                  storedColor={graph.colors}  // Pass the stored color from the graph
                  onFavoriteToggle={handleFavoriteToggle}
                  onDelete={handleDeleteGraph}
                  onDuplicate={handleDuplicateGraph}
                  onUpdate={updateGraph}
                  onClick={handleSelect}
                  showDelete={true}
                />
              ))
            )}

          </div>
        </div>
      </div>

      {/* Create Board Modal */}
      <Dialog.Root open={showCreateForm} onOpenChange={setShowCreateForm}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl z-50 w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <Plus className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <Dialog.Title className="text-xl font-semibold text-gray-900">
                      Create New Board
                    </Dialog.Title>
                    <Dialog.Description className="text-sm text-gray-600">
                      Set up your new knowledge graph
                    </Dialog.Description>
                  </div>
                </div>
                <Dialog.Close asChild>
                  <button className="text-gray-400 hover:text-gray-600 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Close>
              </div>
              
              {/* Emoji Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Emoji
                </label>
                <div className="relative" ref={emojiPickerRef}>
                  <button
                    type="button"
                    className="w-16 h-16 rounded-xl border-2 border-gray-200 flex items-center justify-center text-3xl hover:border-blue-300 hover:bg-blue-50 transition-all duration-200"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  >
                    {newGraphEmoji}
                  </button>
                  
                  {showEmojiPicker && (
                    <div className="absolute top-20 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-xl">
                      <EmojiPicker
                        onEmojiClick={(emojiObject) => {
                          setNewGraphEmoji(emojiObject.emoji);
                          setShowEmojiPicker(false);
                        }}
                        searchPlaceholder="Search emojis..."
                        width={320}
                        height={400}
                        lazyLoadEmojis={true}
                        searchDisabled={false}
                      />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-2">Click to choose an emoji for your board</p>
                
                {/* Color extraction from emoji - hidden but functional */}
                {newGraphEmoji && (
                  <div className="hidden">
                    <EmojiColorExtractor 
                      emoji={newGraphEmoji} 
                      onColorsExtracted={(colors) => {
                        if (colors.length > 0) {
                          setNewGraphColor(colors[0]); // Store the first color
                        }
                      }} 
                    />
                  </div>
                )}
              </div>

              {/* Name Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Board Name
                </label>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                  placeholder="Enter board name..."
                  value={newGraphName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewGraphName(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Description Input */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Description
                </label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-gray-900"
                  placeholder="Describe what this board is for..."
                  value={newGraphDescription}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewGraphDescription(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-gray-600 mt-2">Optional: Add a description to help you remember what this board is for</p>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleCreateGraph(); }}>
                <div className="flex gap-3 justify-end">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                      onClick={() => { 
                        setNewGraphName(""); 
                        setNewGraphEmoji("📋");
                        setNewGraphDescription("");
                        setNewGraphColor(null);
                      }}
                    >
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    disabled={!newGraphName.trim() || isCreatingGraph}
                  >
                    {isCreatingGraph ? "Creating..." : "Create Board"}
                  </button>
                </div>
              </form>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
} 