"use client";

import React, { useState, useEffect, useRef } from "react";
import * as Dialog from '@radix-ui/react-dialog';
import { Edit, X } from "lucide-react";
import EmojiPicker from 'emoji-picker-react';
import EmojiColorExtractor from "./EmojiColorExtractor";
import { logger } from '@/lib/logger';

interface EditGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  graph: {
    id: string;
    name: string;
    emoji?: string;
    description?: string;
    colors?: string;
  };
  updateGraph?: (graphId: string, updates: { name?: string; emoji?: string; description?: string; colors?: string }) => Promise<any>;
}

export function EditGraphModal({ isOpen, onClose, graph, updateGraph }: EditGraphModalProps) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📋");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  
  // Initialize form with current graph data
  useEffect(() => {
    if (graph) {
      setName(graph.name || "");
      setEmoji(graph.emoji || "📋");
      setDescription(graph.description || "");
      setColor(graph.colors || null);
    }
  }, [graph]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUpdating || !name.trim()) return;
    
    setIsUpdating(true);
    try {
      const result = await updateGraph?.(graph.id, {
        name: name.trim(),
        emoji,
        description: description.trim() || undefined,
        colors: color || undefined,
      });
      onClose();
    } catch (err) {
      logger.error('Failed to update graph:', err);
      // Don't close the modal on error, let user try again
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    setName(graph.name || "");
    setEmoji(graph.emoji || "📋");
    setDescription(graph.description || "");
    setColor(graph.colors || null);
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
        <Dialog.Content 
          className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl z-50 w-full max-w-md mx-4"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Edit className="h-5 w-5 text-white" />
                </div>
                <div>
                  <Dialog.Title className="text-xl font-semibold text-gray-900">
                    Edit Board
                  </Dialog.Title>
                  <Dialog.Description className="text-sm text-gray-600">
                    Update your board details
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close asChild>
                <button className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </Dialog.Close>
            </div>
            
            <form onSubmit={handleSubmit}>
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
                    {emoji}
                  </button>
                  
                  {showEmojiPicker && (
                    <div className="absolute top-20 left-0 z-50 bg-white border border-gray-200 rounded-lg shadow-xl">
                      <EmojiPicker
                        onEmojiClick={(emojiObject) => {
                          setEmoji(emojiObject.emoji);
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
                {emoji && (
                  <div className="hidden">
                    <EmojiColorExtractor 
                      emoji={emoji} 
                      onColorsExtracted={(colors) => {
                        if (colors.length > 0) {
                          setColor(colors[0]); // Store the first color
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
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
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
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
                <p className="text-xs text-gray-600 mt-2">Optional: Add a description to help you remember what this board is for</p>
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                  disabled={!name.trim() || isUpdating}
                >
                  {isUpdating ? "Updating..." : "Update Board"}
                </button>
              </div>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
} 