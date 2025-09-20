"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Youtube, ExternalLink, RefreshCw, Copy, Check } from "lucide-react";
import { NodeData } from '../types';
import { NODE_COLORS, NODE_SIZES } from '../constants';
import { getNodeHeaderStyle, getNodeContentStyle, getStickyNoteStyle, getNodeContainerStyle } from '../utils';
import { useApiClient } from '../../../lib/useApiClient';
import { FullScreenButton } from '../ui/FullScreenButton';
import { logger } from '@/lib/logger';

interface YouTubeNodeData extends NodeData {
  url?: string;
  transcript?: string;
  content_id?: string; // Asset ID for backend communication
  graph_id?: string;   // Graph ID for backend communication (optional)
}

interface YouTubeNodeContentProps {
  nodeId: string;
  nodeData: YouTubeNodeData;
  selected: boolean;
}

export function YouTubeNodeContent({ nodeId, nodeData, selected }: YouTubeNodeContentProps) {
  const apiClient = useApiClient();
  // Retrieve graphId directly from nodeData to avoid relying on GraphContext
  const graphId = (nodeData as any).graph_id as string | undefined;
  
  // State management
  const [url, setUrl] = useState(nodeData.url || '');
  const [inputUrl, setInputUrl] = useState(url);
  const [transcript, setTranscript] = useState(nodeData.transcript || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'video' | 'transcript'>('video');
  
  // Poll for transcript updates when processing
  useEffect(() => {
    if (!nodeData.content_id || !graphId || !isLoading) return;
    
    const pollForTranscript = async () => {
      try {
        if (!nodeData.content_id) {
          logger.error('No content_id found');
          return;
        }
        
        const assetData = await apiClient.getAssetWithTranscript(graphId as string, nodeData.content_id as string) as any;
        
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
  }, [nodeData.content_id, isLoading, apiClient, graphId]);

  // Broadcast YouTube content updates to full screen component
  useEffect(() => {
    const event = new CustomEvent('youtube-content-update', {
      detail: {
        nodeId: nodeId,
        url: url,
        transcript: transcript,
        isLoading: isLoading,
        error: error,
        viewMode: viewMode,
        timestamp: new Date().toISOString()
      }
    });
    window.dispatchEvent(event);
  }, [nodeId, url, transcript, isLoading, error, viewMode]);

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
    
    // Clear old transcript and start processing
    setTranscript('');
    setIsLoading(true);
    
    try {
      if (!nodeData.content_id || !graphId) {
        throw new Error('No asset ID found');
      }
      
      // Call backend to update URL and trigger transcript processing
      await apiClient.updateAssetUrl(graphId as string, nodeData.content_id as string, newUrl);
      
      // The polling effect will handle checking for completion
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process video');
      setIsLoading(false);
    }
  }, [inputUrl, nodeData.content_id, apiClient, graphId]);

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


  // Main content component similar to website node
  const youtubeContentComponent = useMemo(() => {
    if (!url) {
      return (
        <div 
          className="flex-1 p-8 flex flex-col items-center justify-center"
          style={{ backgroundColor: NODE_COLORS.YOUTUBE.background }}
        >
          <div className="text-center max-w-md w-full">
            <div 
              className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6"
              style={{ 
                backgroundColor: NODE_COLORS.YOUTUBE.headerBg,
                border: `2px solid ${NODE_COLORS.YOUTUBE.border}`
              }}
            >
              <Youtube className="h-8 w-8" style={{ color: NODE_COLORS.YOUTUBE.textColor }} />
            </div>
            <h3 
              className="text-xl font-semibold mb-3"
              style={{ color: NODE_COLORS.YOUTUBE.textColor }}
            >
              YouTube Transcript
            </h3>
            <p 
              className="text-sm mb-6 opacity-80"
              style={{ color: NODE_COLORS.YOUTUBE.textColor }}
            >
              Enter a YouTube URL to extract and view the video transcript
            </p>
            
            <form onSubmit={handleUrlSubmit} className="w-full space-y-4">
              <div 
                className="p-4 rounded-lg border-2 border-dashed"
                style={{ 
                  backgroundColor: NODE_COLORS.YOUTUBE.headerBg,
                  borderColor: NODE_COLORS.YOUTUBE.border
                }}
              >
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=... or https://youtu.be/..."
                  className="w-full px-4 py-3 text-base border-2 rounded-lg focus:outline-none transition-all duration-200"
                  style={{
                    borderColor: NODE_COLORS.YOUTUBE.border,
                    backgroundColor: 'white',
                    color: NODE_COLORS.YOUTUBE.textColor
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = NODE_COLORS.YOUTUBE.border;
                    e.target.style.boxShadow = `0 0 0 3px ${NODE_COLORS.YOUTUBE.border}20`;
                  }}
                  onBlur={(e) => {
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !inputUrl.trim()}
                className="w-full px-6 py-3 text-white text-base font-semibold rounded-lg transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: NODE_COLORS.YOUTUBE.border
                }}
                onMouseEnter={(e) => {
                  if (!isLoading && inputUrl.trim()) {
                    e.currentTarget.style.backgroundColor = NODE_COLORS.YOUTUBE.textColor;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading && inputUrl.trim()) {
                    e.currentTarget.style.backgroundColor = NODE_COLORS.YOUTUBE.border;
                  }
                }}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    Processing...
                  </div>
                ) : (
                  'Extract Transcript'
                )}
              </button>
              {error && (
                <div 
                  className="px-3 py-2 rounded-md text-xs font-medium"
                  style={{ 
                    backgroundColor: '#fee2e2',
                    color: '#dc2626',
                    border: '1px solid #fca5a5'
                  }}
                >
                  {error}
                </div>
              )}
            </form>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col min-h-0">
        {/* Single Header with Node Title and URL Controls */}
        <div 
          className="p-4 border-b-2 flex-shrink-0 relative"
          style={{ 
            backgroundColor: NODE_COLORS.YOUTUBE.headerBg,
            borderBottomColor: NODE_COLORS.YOUTUBE.border,
            zIndex: 10
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Youtube className="h-5 w-5" style={{ color: NODE_COLORS.YOUTUBE.textColor }} />
              <span 
                className="text-sm font-semibold"
                style={{ color: NODE_COLORS.YOUTUBE.textColor }}
              >
                {nodeData.label} - YouTube Video
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode(viewMode === 'video' ? 'transcript' : 'video')}
                disabled={!transcript}
                className="px-3 py-1.5 text-xs font-medium border-2 rounded-md transition-all duration-200 disabled:opacity-50"
                style={{
                  backgroundColor: 'white',
                  borderColor: NODE_COLORS.YOUTUBE.border,
                  color: NODE_COLORS.YOUTUBE.textColor
                }}
                onMouseEnter={(e) => {
                  if (transcript) {
                    e.currentTarget.style.backgroundColor = NODE_COLORS.YOUTUBE.border;
                    e.currentTarget.style.color = 'white';
                  }
                }}
                onMouseLeave={(e) => {
                  if (transcript) {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.color = NODE_COLORS.YOUTUBE.textColor;
                  }
                }}
                title={transcript ? (viewMode === 'video' ? 'Show transcript' : 'Show video') : 'Transcript not available'}
              >
                {viewMode === 'video' ? 'Show Transcript' : 'Show Video'}
              </button>
              <button
                onClick={openInNewTab}
                className="p-2 rounded-md transition-all duration-200"
                style={{ color: NODE_COLORS.YOUTUBE.textColor }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = NODE_COLORS.YOUTUBE.border;
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = NODE_COLORS.YOUTUBE.textColor;
                }}
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
              <FullScreenButton nodeId={nodeId} isLoading={isLoading} />
            </div>
          </div>
          
          <form onSubmit={handleUrlSubmit} className="flex items-center gap-3">
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              className="flex-1 px-4 py-2.5 text-sm border-2 rounded-lg focus:outline-none transition-all duration-200"
              style={{
                borderColor: NODE_COLORS.YOUTUBE.border,
                backgroundColor: 'white',
                color: NODE_COLORS.YOUTUBE.textColor
              }}
              onFocus={(e) => {
                e.target.style.borderColor = NODE_COLORS.YOUTUBE.textColor;
                e.target.style.boxShadow = `0 0 0 3px ${NODE_COLORS.YOUTUBE.border}20`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = NODE_COLORS.YOUTUBE.border;
                e.target.style.boxShadow = 'none';
              }}
              placeholder="Enter YouTube URL"
            />
            <button
              type="submit"
              disabled={isLoading || !inputUrl.trim()}
              className="px-4 py-2.5 text-white text-sm font-semibold rounded-lg transition-all duration-200 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: NODE_COLORS.YOUTUBE.border,
                minWidth: '100px'
              }}
              onMouseEnter={(e) => {
                if (!isLoading && inputUrl.trim()) {
                  e.currentTarget.style.backgroundColor = NODE_COLORS.YOUTUBE.textColor;
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading && inputUrl.trim()) {
                  e.currentTarget.style.backgroundColor = NODE_COLORS.YOUTUBE.border;
                }
              }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-1">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Processing</span>
                </div>
              ) : (
                'Update'
              )}
            </button>
          </form>
          {error && (
            <div 
              className="mt-2 px-3 py-2 rounded-md text-xs font-medium"
              style={{ 
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                border: '1px solid #fca5a5'
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Content Display - Video or Transcript */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {isLoading ? (
            <div 
              className="flex-1 flex items-center justify-center h-full"
              style={{ backgroundColor: NODE_COLORS.YOUTUBE.background }}
            >
              <div className="flex items-center gap-3">
                <RefreshCw className="h-6 w-6 animate-spin" style={{ color: NODE_COLORS.YOUTUBE.textColor }} />
                <span 
                  className="text-base font-medium"
                  style={{ color: NODE_COLORS.YOUTUBE.textColor }}
                >
                  Extracting transcript...
                </span>
              </div>
            </div>
          ) : viewMode === 'video' ? (
            <div className="relative w-full h-full" style={{ backgroundColor: NODE_COLORS.YOUTUBE.background }}>
              {getYouTubeEmbedUrl(url) ? (
                <>
                  <iframe
                    src={getYouTubeEmbedUrl(url) || ''}
                    className="w-full h-full border-0"
                    title="YouTube video"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                  {/* Transparent overlay for React Flow interaction */}
                  <div 
                    className="absolute inset-0 bg-transparent"
                    style={{ 
                      zIndex: 1,
                      pointerEvents: 'auto'
                    }}
                    onMouseDown={(e) => {
                      // Allow video interaction by temporarily making overlay non-blocking
                      const overlay = e.currentTarget;
                      overlay.style.pointerEvents = 'none';
                      setTimeout(() => {
                        overlay.style.pointerEvents = 'auto';
                      }, 100);
                    }}
                    onWheel={(e) => {
                      // Let scroll events pass through naturally
                      const overlay = e.currentTarget;
                      overlay.style.pointerEvents = 'none';
                      setTimeout(() => {
                        overlay.style.pointerEvents = 'auto';
                      }, 0);
                    }}
                  />
                </>
              ) : (
                <div className="h-full flex items-center justify-center p-8">
                  <div className="text-center">
                    {getYouTubeThumbnailUrl(url) ? (
                      <div className="mb-4">
                        <img
                          src={getYouTubeThumbnailUrl(url) || ''}
                          alt="YouTube thumbnail"
                          className="max-w-full max-h-64 rounded-lg shadow-md"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    ) : null}
                    <Youtube 
                      className="h-12 w-12 mx-auto mb-4 opacity-40"
                      style={{ color: NODE_COLORS.YOUTUBE.textColor }}
                    />
                    <p 
                      className="text-sm opacity-60"
                      style={{ color: NODE_COLORS.YOUTUBE.textColor }}
                    >
                      Video preview not available
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full overflow-hidden" style={{ backgroundColor: NODE_COLORS.YOUTUBE.background }}>
              {transcript ? (
                <div className="h-full flex flex-col min-h-0">
                  <div 
                    className="px-4 py-3 border-b-2 flex items-center justify-between flex-shrink-0"
                    style={{ 
                      backgroundColor: NODE_COLORS.YOUTUBE.headerBg,
                      borderBottomColor: NODE_COLORS.YOUTUBE.border
                    }}
                  >
                    <span 
                      className="text-sm font-semibold"
                      style={{ color: NODE_COLORS.YOUTUBE.textColor }}
                    >
                      Video Transcript
                    </span>
                    <button
                      onClick={copyTranscript}
                      className="p-2 rounded-md transition-all duration-200"
                      style={{ color: NODE_COLORS.YOUTUBE.textColor }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = NODE_COLORS.YOUTUBE.border;
                        e.currentTarget.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = NODE_COLORS.YOUTUBE.textColor;
                      }}
                      title="Copy transcript"
                    >
                      {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex-1 p-4 overflow-y-auto min-h-0">
                    <div 
                      className="text-sm whitespace-pre-wrap leading-relaxed"
                      style={{ color: NODE_COLORS.YOUTUBE.textColor }}
                    >
                      {transcript}
                    </div>
                  </div>
                </div>
              ) : (
                <div 
                  className="h-full flex items-center justify-center"
                  style={{ backgroundColor: NODE_COLORS.YOUTUBE.background }}
                >
                  <div className="text-center">
                    <Youtube 
                      className="h-12 w-12 mx-auto mb-4 opacity-40"
                      style={{ color: NODE_COLORS.YOUTUBE.textColor }}
                    />
                    <p 
                      className="text-sm opacity-60"
                      style={{ color: NODE_COLORS.YOUTUBE.textColor }}
                    >
                      No transcript available
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }, [url, inputUrl, isLoading, error, handleUrlSubmit, openInNewTab, transcript, copyTranscript, copied, nodeData.label, nodeId, viewMode, getYouTubeEmbedUrl, getYouTubeThumbnailUrl]);

  const containerStyle = getNodeContainerStyle('YOUTUBE', selected);

  return (
    <div 
      className={`w-full h-full ${containerStyle.className}`}
      style={{
        ...containerStyle.style,
        minWidth: `${NODE_SIZES.MIN_WIDTH}px`,
        minHeight: `${NODE_SIZES.MIN_HEIGHT}px`
      }}
    >
      <div className="h-full flex flex-col">
        {/* No original header - content handles its own header */}
        {youtubeContentComponent}
      </div>
    </div>
  );
} 