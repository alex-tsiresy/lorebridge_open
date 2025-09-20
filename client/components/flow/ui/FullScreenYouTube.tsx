"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { Youtube, ExternalLink, RefreshCw, Copy, Check, X } from 'lucide-react';
import { YouTubeNodeData } from '../types';
import { useApiClient } from '../../../lib/useApiClient';
import { useFullScreen } from '../context/FullScreenContext';
import { logger } from '@/lib/logger';

interface FullScreenYouTubeProps {
  nodeData: YouTubeNodeData;
  nodeId: string;
}

export function FullScreenYouTube({ nodeData, nodeId }: FullScreenYouTubeProps) {
  const { setFullScreenNodeId } = useFullScreen();
  const apiClient = useApiClient();
  const graphId = (nodeData as any).graph_id as string | undefined;
  
  const [url, setUrl] = useState(nodeData.url || '');
  const [inputUrl, setInputUrl] = useState(url);
  const [transcript, setTranscript] = useState(nodeData.transcript || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'video' | 'transcript'>('video');
  
  // Poll for transcript updates when processing
  useEffect(() => {
    if (!(nodeData as any).content_id || !graphId || !isLoading) return;
    
    const pollForTranscript = async () => {
      try {
        if (!(nodeData as any).content_id) {
          logger.error('No content_id found');
          return;
        }
        
        const assetData = await apiClient.getAssetWithTranscript(graphId as string, (nodeData as any).content_id as string) as any;
        
        if (assetData.status === 'completed') {
          setTranscript(assetData.transcript || '');
          setIsLoading(false);
          setError(null);
        } else if (assetData.status === 'failed') {
          setError('Failed to extract transcript');
          setIsLoading(false);
        }
        // If still processing, keep polling
      } catch (err) {
        logger.error('Error polling for transcript:', err);
        setError('Failed to check transcript status');
        setIsLoading(false);
      }
    };
    
    const pollInterval = setInterval(pollForTranscript, 2000); // Poll every 2 seconds
    
    return () => clearInterval(pollInterval);
  }, [(nodeData as any).content_id, isLoading, apiClient, graphId]);

  // Listen for real-time content updates from YouTubeNode
  useEffect(() => {
    const handleContentUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { nodeId: eventNodeId, url: nodeUrl, transcript: nodeTranscript, isLoading: nodeIsLoading, error: nodeError, viewMode: nodeViewMode } = customEvent.detail;
      
      if (eventNodeId === nodeId) {
        logger.log('[FullScreenYouTube] Received content update', {
          nodeId: eventNodeId,
          hasUrl: !!nodeUrl,
          transcriptLength: nodeTranscript?.length || 0,
          isLoading: nodeIsLoading,
          hasError: !!nodeError,
          viewMode: nodeViewMode
        });
        
        setUrl(nodeUrl || '');
        setInputUrl(nodeUrl || '');
        setTranscript(nodeTranscript || '');
        setIsLoading(nodeIsLoading || false);
        setError(nodeError || null);
        if (nodeViewMode) {
          setViewMode(nodeViewMode);
        }
      }
    };

    window.addEventListener('youtube-content-update', handleContentUpdate);
    return () => {
      window.removeEventListener('youtube-content-update', handleContentUpdate);
    };
  }, [nodeId]);
  
  const validateYouTubeUrl = (url: string): boolean => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/)[\w-]+/;
    return youtubeRegex.test(url);
  };

  const getYouTubeVideoId = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
  };

  const getYouTubeEmbedUrl = (url: string): string | null => {
    const videoId = getYouTubeVideoId(url);
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  };

  const getYouTubeThumbnailUrl = (url: string): string | null => {
    const videoId = getYouTubeVideoId(url);
    return videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null;
  };

  const handleUrlSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    
    setError(null);
    
    // Add https:// if no protocol is specified
    let newUrl = inputUrl.trim();
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
      newUrl = 'https://' + newUrl;
    }
    
    if (!validateYouTubeUrl(newUrl)) {
      setError('Please enter a valid YouTube URL');
      return;
    }
    
    setUrl(newUrl);
    setInputUrl(newUrl);
    
    // Fetch transcript
    setIsLoading(true);
    try {
      // This would need to be implemented based on your API
      // For now, we'll just simulate the process
      setError('Transcript extraction not implemented in full screen mode');
      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract transcript');
      setTranscript('');
      setIsLoading(false);
    }
  }, [inputUrl]);

  const openInNewTab = useCallback(() => {
    if (url) {
      window.open(url, '_blank');
    }
  }, [url]);

  const copyTranscript = useCallback(async () => {
    if (transcript) {
      try {
        await navigator.clipboard.writeText(transcript);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        logger.error('Failed to copy transcript:', err);
      }
    }
  }, [transcript]);

  const handleClose = () => {
    setFullScreenNodeId(null);
  };

  return (
    <div className="h-full w-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-red-50">
        <div className="text-lg font-medium text-gray-900 flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Youtube className="h-5 w-5 text-red-600" />
            {nodeData.label}
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
            title="Close full screen"
          >
            <X className="h-6 w-6 text-gray-600" />
          </button>
        </div>
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setViewMode(viewMode === 'video' ? 'transcript' : 'video')}
              disabled={!transcript}
              className="px-3 py-1.5 text-xs font-medium border-2 border-red-300 rounded-md transition-all duration-200 disabled:opacity-50 hover:bg-red-100"
              style={{
                backgroundColor: viewMode === 'video' ? 'white' : 'rgb(254 226 226)',
                color: 'rgb(220 38 38)'
              }}
              title={transcript ? (viewMode === 'video' ? 'Show transcript' : 'Show video') : 'Transcript not available'}
            >
              {viewMode === 'video' ? 'Show Transcript' : 'Show Video'}
            </button>
            {url && (
              <button
                type="button"
                onClick={openInNewTab}
                className="p-2 rounded hover:bg-red-100 text-red-600 transition-colors"
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
          </div>
          <form onSubmit={handleUrlSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Enter YouTube URL..."
              className="flex-1 px-3 py-2 text-sm text-black border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="p-2 rounded hover:bg-red-100 text-red-600 transition-colors disabled:opacity-50"
              title="Update URL"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </form>
        </div>
        {error && (
          <div className="text-sm text-red-600">{error}</div>
        )}
      </div>
      
      {/* Content display area - Video or Transcript */}
      <div className="flex-1 overflow-hidden bg-white flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-2 text-gray-500">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="text-lg">Extracting transcript...</span>
            </div>
          </div>
        ) : viewMode === 'video' && url ? (
          <div className="flex-1 flex flex-col">
            {getYouTubeEmbedUrl(url) ? (
              <div className="flex-1">
                <iframe
                  src={getYouTubeEmbedUrl(url) || ''}
                  className="w-full h-full border-0"
                  title="YouTube video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                  {getYouTubeThumbnailUrl(url) ? (
                    <div className="mb-6">
                      <img
                        src={getYouTubeThumbnailUrl(url) || ''}
                        alt="YouTube thumbnail"
                        className="max-w-md max-h-80 rounded-lg shadow-lg"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  ) : null}
                  <Youtube className="h-16 w-16 mx-auto mb-4 text-red-400" />
                  <p className="text-lg text-gray-600">Video preview not available</p>
                </div>
              </div>
            )}
          </div>
        ) : viewMode === 'transcript' && transcript ? (
          <div className="flex-1 flex flex-col">
            <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Video Transcript</span>
              <button
                onClick={copyTranscript}
                className="p-2 rounded hover:bg-gray-100 text-gray-600 transition-colors"
                title="Copy transcript"
              >
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex-1 p-6 overflow-y-auto">
              <div className="fullscreen-prose">
                <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {transcript}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <Youtube className="h-16 w-16 mx-auto mb-4 text-red-400" />
              <p className="text-lg">
                {!url ? 'Enter a YouTube URL to get started' : 
                 viewMode === 'transcript' && !transcript ? 'No transcript available' :
                 'Video content loading...'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 