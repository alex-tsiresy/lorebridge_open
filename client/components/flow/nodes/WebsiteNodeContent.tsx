"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Globe, ExternalLink, RefreshCw } from "lucide-react";
import { WebsiteNodeData } from '../types';
import { NODE_COLORS, NODE_SIZES } from '../constants';
import { getNodeHeaderStyle, getNodeContentStyle, getStickyNoteStyle } from '../utils';
import { FullScreenButton } from '../ui/FullScreenButton';
import { useApiClient } from '../../../lib/useApiClient';
import { logger } from '@/lib/logger';

interface WebsiteNodeContentProps {
  nodeId: string;
  nodeData: WebsiteNodeData;
  selected: boolean;
}

export function WebsiteNodeContent({ nodeId, nodeData, selected }: WebsiteNodeContentProps) {
  const apiClient = useApiClient();
  const [url, setUrl] = useState(nodeData.url || '');
  const [inputUrl, setInputUrl] = useState(nodeData.url || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingUrl, setIsSettingUrl] = useState(false);
  const [isPlaceholder, setIsPlaceholder] = useState(nodeData.is_placeholder || false);
  const [scrapedContent, setScrapedContent] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'iframe' | 'content'>('iframe');

  // Broadcast website state updates to full screen component
  useEffect(() => {
    const event = new CustomEvent('website-content-update', {
      detail: {
        nodeId: nodeId,
        url: url,
        inputUrl: inputUrl,
        isLoading: isLoading,
        isSettingUrl: isSettingUrl,
        scrapedContent: scrapedContent,
        viewMode: viewMode,
        timestamp: new Date().toISOString()
      }
    });
    window.dispatchEvent(event);
  }, [nodeId, url, inputUrl, isLoading, isSettingUrl, scrapedContent, viewMode]);

  const fetchScrapedContent = useCallback(async () => {
    
    // Don't fetch content for placeholder nodes
    if (isPlaceholder || (!nodeData.graph_id || !nodeId)) {
      return;
    }
    
    try {
      const content = await apiClient.getWebsiteContent(nodeData.graph_id, nodeId) as any;
      
      if (content && content.success) {
        setScrapedContent(content);
      } else {
        logger.error('API returned unsuccessful response:', content);
      }
    } catch (error) {
      logger.error('Failed to fetch scraped content:', error);
      logger.error('Error details:', error);
    }
  }, [nodeData.graph_id, isPlaceholder, nodeId, apiClient]);

  const handleUrlSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;
    
    // Debug logging to understand the state
    logger.log('handleUrlSubmit debug:', {
      isPlaceholder,
      'nodeData.graph_id': nodeData.graph_id,
      'nodeData.placeholder_id': nodeData.placeholder_id,
      'nodeData.content_id': nodeData.content_id,
      'nodeData.is_placeholder': nodeData.is_placeholder,
      inputUrl
    });

    // Add https:// if no protocol is specified
    let newUrl = inputUrl.trim();
    if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
      newUrl = 'https://' + newUrl;
    }

    setIsSettingUrl(true);
    
    // Smart endpoint selection: Try placeholder first, fallback to asset endpoint
    try {
      // First attempt: Try placeholder endpoint if it looks like a placeholder
      if ((nodeData.is_placeholder || isPlaceholder) && nodeData.graph_id && nodeData.placeholder_id) {
        logger.log('Trying placeholder endpoint first...');
        
        try {
          const result = await apiClient.setWebsiteUrl(nodeData.graph_id, nodeId, newUrl) as any;
          
          if (result.success) {
            setUrl(newUrl);
            setInputUrl(newUrl);
            setIsPlaceholder(false); // Node is no longer a placeholder!
            
            // Fetch content immediately since node is no longer placeholder
            setTimeout(async () => {
              await fetchScrapedContent();
            }, 500); // Small delay to ensure backend has processed
            return; // Success!
          } else {
            throw new Error(result?.message || result?.error || 'Unknown placeholder endpoint error');
          }
        } catch (placeholderError) {
          const errorMsg = placeholderError instanceof Error ? placeholderError.message : '';
          
          // If backend says "already has real asset", fall back to asset endpoint
          if (errorMsg.includes('already has a real asset')) {
            logger.log('Placeholder already converted, trying asset endpoint...');
            setIsPlaceholder(false); // Update state
            
            // Fall through to asset endpoint logic below
          } else {
            throw placeholderError; // Re-throw other errors
          }
        }
      }
      
      // Second attempt: Asset endpoint for existing assets
      if (nodeData.content_id && nodeData.graph_id) {
        logger.log('Trying asset endpoint...');
        
        const result = await apiClient.updateAssetUrl(nodeData.graph_id, nodeData.content_id, newUrl) as any;
        
        if (result) {
          setUrl(newUrl);
          setInputUrl(newUrl);
          
          // Fetch updated content
          await fetchScrapedContent();
          logger.log('Successfully updated website URL for asset:', nodeData.content_id);
        }
      } else {
        throw new Error('Missing content_id or graph_id for asset update');
      }
      
    } catch (error) {
      logger.error('Final error updating website URL:', {
        url: newUrl,
        error: error instanceof Error ? error.message : error,
        nodeId,
        assetId: nodeData.content_id,
        graphId: nodeData.graph_id
      });
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Error setting website URL: ${errorMessage}`);
    } finally {
      setIsSettingUrl(false);
    }
  }, [inputUrl, isPlaceholder, nodeData.graph_id, nodeData.placeholder_id, nodeData.content_id, nodeId, apiClient, fetchScrapedContent]);

  const openInNewTab = useCallback(() => {
    if (url) {
      window.open(url, '_blank');
    }
  }, [url]);

  // Load content when component mounts or when placeholder status changes
  useEffect(() => {
    if (!isPlaceholder) {
      fetchScrapedContent();
    }
  }, [isPlaceholder, fetchScrapedContent]);

  // Memoize the website content component to prevent unnecessary re-renders
  const websiteContentComponent = useMemo(() => {
    if (isPlaceholder) {
      return (
        <div 
          className="flex-1 p-8 flex flex-col items-center justify-center"
          style={{ backgroundColor: NODE_COLORS.WEBSITE.background }}
        >
          <div className="text-center max-w-md w-full">
            <div 
              className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6"
              style={{ 
                backgroundColor: NODE_COLORS.WEBSITE.headerBg,
                border: `2px solid ${NODE_COLORS.WEBSITE.border}`
              }}
            >
              <Globe className="h-8 w-8" style={{ color: NODE_COLORS.WEBSITE.textColor }} />
            </div>
            <h3 
              className="text-xl font-semibold mb-3"
              style={{ color: NODE_COLORS.WEBSITE.textColor }}
            >
              Website Node
            </h3>
            <p 
              className="text-sm mb-6 opacity-80"
              style={{ color: NODE_COLORS.WEBSITE.textColor }}
            >
              Enter a URL to start scraping website content
            </p>
            
            <form onSubmit={handleUrlSubmit} className="w-full space-y-4">
              <div 
                className="p-4 rounded-lg border-2 border-dashed"
                style={{ 
                  backgroundColor: NODE_COLORS.WEBSITE.headerBg,
                  borderColor: NODE_COLORS.WEBSITE.border
                }}
              >
                <input
                  type="url"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-4 py-3 text-base border-2 rounded-lg focus:outline-none transition-all duration-200"
                  style={{
                    borderColor: NODE_COLORS.WEBSITE.border,
                    backgroundColor: 'white',
                    color: NODE_COLORS.WEBSITE.textColor
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = NODE_COLORS.WEBSITE.border;
                    e.target.style.boxShadow = `0 0 0 3px ${NODE_COLORS.WEBSITE.border}20`;
                  }}
                  onBlur={(e) => {
                    e.target.style.boxShadow = 'none';
                  }}
                  disabled={isSettingUrl}
                />
              </div>
              <button
                type="submit"
                disabled={isSettingUrl || !inputUrl.trim()}
                className="w-full px-6 py-3 text-white text-base font-semibold rounded-lg transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: NODE_COLORS.WEBSITE.border
                }}
                onMouseEnter={(e) => {
                  if (!isSettingUrl && inputUrl.trim()) {
                    e.currentTarget.style.backgroundColor = NODE_COLORS.WEBSITE.textColor;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSettingUrl && inputUrl.trim()) {
                    e.currentTarget.style.backgroundColor = NODE_COLORS.WEBSITE.border;
                  }
                }}
              >
                {isSettingUrl ? (
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    Setting URL...
                  </div>
                ) : (
                  'Set Website URL'
                )}
              </button>
            </form>
          </div>
        </div>
      );
    }

    if (!url) {
      return (
        <div 
          className="flex-1 p-8 flex flex-col items-center justify-center"
          style={{ backgroundColor: NODE_COLORS.WEBSITE.background }}
        >
          <div className="text-center max-w-md w-full">
            <div 
              className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6"
              style={{ 
                backgroundColor: NODE_COLORS.WEBSITE.headerBg,
                border: `2px solid ${NODE_COLORS.WEBSITE.border}`
              }}
            >
              <Globe className="h-8 w-8" style={{ color: NODE_COLORS.WEBSITE.textColor }} />
            </div>
            <h3 
              className="text-xl font-semibold mb-3"
              style={{ color: NODE_COLORS.WEBSITE.textColor }}
            >
              No URL Set
            </h3>
            <p 
              className="text-sm mb-6 opacity-80"
              style={{ color: NODE_COLORS.WEBSITE.textColor }}
            >
              Enter a URL to start scraping website content
            </p>
            
            <form onSubmit={handleUrlSubmit} className="w-full space-y-4">
              <div 
                className="p-4 rounded-lg border-2 border-dashed"
                style={{ 
                  backgroundColor: NODE_COLORS.WEBSITE.headerBg,
                  borderColor: NODE_COLORS.WEBSITE.border
                }}
              >
                <input
                  type="url"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-4 py-3 text-base border-2 rounded-lg focus:outline-none transition-all duration-200"
                  style={{
                    borderColor: NODE_COLORS.WEBSITE.border,
                    backgroundColor: 'white',
                    color: NODE_COLORS.WEBSITE.textColor
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = NODE_COLORS.WEBSITE.border;
                    e.target.style.boxShadow = `0 0 0 3px ${NODE_COLORS.WEBSITE.border}20`;
                  }}
                  onBlur={(e) => {
                    e.target.style.boxShadow = 'none';
                  }}
                  disabled={isLoading}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !inputUrl.trim()}
                className="w-full px-6 py-3 text-white text-base font-semibold rounded-lg transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: NODE_COLORS.WEBSITE.border,
                }}
                onMouseEnter={(e) => {
                  if (!isLoading && inputUrl.trim()) {
                    e.currentTarget.style.backgroundColor = NODE_COLORS.WEBSITE.textColor;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading && inputUrl.trim()) {
                    e.currentTarget.style.backgroundColor = NODE_COLORS.WEBSITE.border;
                  }
                }}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    Loading...
                  </div>
                ) : (
                  'Load Website'
                )}
              </button>
            </form>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col h-full">
        {/* Single Header with Node Title and URL Controls */}
        <div 
          className="p-4 border-b-2 flex-shrink-0"
          style={{ 
            backgroundColor: NODE_COLORS.WEBSITE.headerBg,
            borderBottomColor: NODE_COLORS.WEBSITE.border
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5" style={{ color: NODE_COLORS.WEBSITE.textColor }} />
              <span 
                className="text-sm font-semibold"
                style={{ color: NODE_COLORS.WEBSITE.textColor }}
              >
                {nodeData.label} - Website Content
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode(viewMode === 'iframe' ? 'content' : 'iframe')}
                className="px-3 py-1.5 text-xs font-medium border-2 rounded-md transition-all duration-200"
                style={{
                  backgroundColor: 'white',
                  borderColor: NODE_COLORS.WEBSITE.border,
                  color: NODE_COLORS.WEBSITE.textColor
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = NODE_COLORS.WEBSITE.border;
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.color = NODE_COLORS.WEBSITE.textColor;
                }}
              >
                {viewMode === 'iframe' ? 'Show Content' : 'Show Website'}
              </button>
              <button
                onClick={openInNewTab}
                className="p-2 rounded-md transition-all duration-200"
                style={{ color: NODE_COLORS.WEBSITE.textColor }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = NODE_COLORS.WEBSITE.border;
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = NODE_COLORS.WEBSITE.textColor;
                }}
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
              <button
                onClick={fetchScrapedContent}
                disabled={isLoading}
                className="p-2 rounded-md transition-all duration-200 disabled:opacity-50"
                style={{ color: NODE_COLORS.WEBSITE.textColor }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.backgroundColor = NODE_COLORS.WEBSITE.border;
                    e.currentTarget.style.color = 'white';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = NODE_COLORS.WEBSITE.textColor;
                  }
                }}
                title="Refresh content"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <FullScreenButton nodeId={nodeId} isLoading={isLoading} />
            </div>
          </div>
          
          <form onSubmit={handleUrlSubmit} className="flex items-center gap-3">
            <input
              type="url"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              className="flex-1 px-4 py-2.5 text-sm border-2 rounded-lg focus:outline-none transition-all duration-200"
              style={{
                borderColor: NODE_COLORS.WEBSITE.border,
                backgroundColor: 'white',
                color: NODE_COLORS.WEBSITE.textColor
              }}
              onFocus={(e) => {
                e.target.style.borderColor = NODE_COLORS.WEBSITE.textColor;
                e.target.style.boxShadow = `0 0 0 3px ${NODE_COLORS.WEBSITE.border}20`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = NODE_COLORS.WEBSITE.border;
                e.target.style.boxShadow = 'none';
              }}
              placeholder="Enter website URL"
            />
            <button
              type="submit"
              disabled={isLoading || !inputUrl.trim()}
              className="px-4 py-2.5 text-white text-sm font-semibold rounded-lg transition-all duration-200 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: NODE_COLORS.WEBSITE.border,
                minWidth: '100px'
              }}
              onMouseEnter={(e) => {
                if (!isLoading && inputUrl.trim()) {
                  e.currentTarget.style.backgroundColor = NODE_COLORS.WEBSITE.textColor;
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading && inputUrl.trim()) {
                  e.currentTarget.style.backgroundColor = NODE_COLORS.WEBSITE.border;
                }
              }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-1">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Loading</span>
                </div>
              ) : (
                'Update'
              )}
            </button>
          </form>
        </div>

        {/* Content Display - Fixed height with proper scrolling */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {viewMode === 'iframe' ? (
            <div className="relative w-full h-full">
              <iframe
                src={url}
                className="w-full h-full border-0"
                title="Website content"
                sandbox="allow-scripts allow-same-origin"
              />
              {/* Transparent overlay that allows scrolling but blocks clicks */}
              <div 
                className="absolute inset-0 bg-transparent"
                style={{ 
                  pointerEvents: 'auto',
                  zIndex: 1,
                  cursor: 'default'
                }}
                onClick={(e) => {
                  // Block clicks from reaching iframe content
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onMouseDown={(e) => {
                  // Block mouse down from reaching iframe content  
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onWheel={(e) => {
                  // Let scroll events pass through naturally
                  // by temporarily disabling pointer events
                  const overlay = e.currentTarget;
                  overlay.style.pointerEvents = 'none';
                  setTimeout(() => {
                    overlay.style.pointerEvents = 'auto';
                  }, 0);
                }}
              />
            </div>
          ) : (
            <div className="h-full overflow-y-auto overflow-x-hidden">
              <div className="p-4">
                {scrapedContent ? (
                  <div className="prose prose-sm max-w-none">
                    <h3 
                      className="text-lg font-semibold mb-2"
                      style={{ color: NODE_COLORS.WEBSITE.textColor }}
                    >
                      {scrapedContent.title || 'Website Content'}
                    </h3>
                    {scrapedContent.content && (
                      <div 
                        className="text-sm leading-relaxed"
                        style={{ color: NODE_COLORS.WEBSITE.textColor }}
                        dangerouslySetInnerHTML={{ __html: scrapedContent.content }}
                      />
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Globe 
                      className="h-12 w-12 mx-auto mb-4 opacity-40"
                      style={{ color: NODE_COLORS.WEBSITE.textColor }}
                    />
                    <p 
                      className="text-sm opacity-60"
                      style={{ color: NODE_COLORS.WEBSITE.textColor }}
                    >
                      {isLoading ? 'Loading content...' : 'No content available'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }, [isPlaceholder, url, inputUrl, isSettingUrl, isLoading, handleUrlSubmit, viewMode, openInNewTab, fetchScrapedContent, scrapedContent, nodeData.label, nodeId]);

  const containerStyle = getStickyNoteStyle('WEBSITE', selected);

  return (
    <div 
      className={containerStyle.className}
      style={{ 
        ...containerStyle.style,
        minWidth: `${NODE_SIZES.MIN_WIDTH}px`, 
        minHeight: `${NODE_SIZES.MIN_HEIGHT}px` 
      }}
    >
      <div className="h-full flex flex-col relative z-10">
        {/* No original header - content handles its own header */}
        {websiteContentComponent}
      </div>
    </div>
  );
} 