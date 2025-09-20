"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { Globe, ExternalLink, RefreshCw, X } from 'lucide-react';
import { WebsiteNodeData } from '../types';
import { useFullScreen } from '../context/FullScreenContext';
import { logger } from '@/lib/logger';

interface FullScreenWebsiteProps {
  nodeData: WebsiteNodeData;
  nodeId: string;
}

export function FullScreenWebsite({ nodeData, nodeId }: FullScreenWebsiteProps) {
  const { setFullScreenNodeId } = useFullScreen();
  const [url, setUrl] = useState(nodeData.url || 'https://www.google.com');
  const [inputUrl, setInputUrl] = useState(url);
  const [isLoading, setIsLoading] = useState(false);

  const handleClose = () => {
    setFullScreenNodeId(null);
  };

  // Listen for real-time state updates from WebsiteNode
  useEffect(() => {
    const handleStateUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { nodeId: eventNodeId, url: nodeUrl, inputUrl: nodeInputUrl, isLoading: nodeIsLoading } = customEvent.detail;
      
      if (eventNodeId === nodeId) {
        logger.log('[FullScreenWebsite] Received state update', {
          nodeId: eventNodeId,
          url: nodeUrl,
          inputUrl: nodeInputUrl,
          isLoading: nodeIsLoading
        });
        
        setUrl(nodeUrl || '');
        setInputUrl(nodeInputUrl || '');
        setIsLoading(nodeIsLoading || false);
      }
    };

    window.addEventListener('website-content-update', handleStateUpdate);
    return () => {
      window.removeEventListener('website-content-update', handleStateUpdate);
    };
  }, [nodeId]);

  const handleUrlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (inputUrl.trim()) {
      setIsLoading(true);
      // Add https:// if no protocol is specified
      let newUrl = inputUrl.trim();
      if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
        newUrl = 'https://' + newUrl;
      }
      setUrl(newUrl);
      setInputUrl(newUrl);
      setIsLoading(false);
    }
  }, [inputUrl]);

  const openInNewTab = useCallback(() => {
    window.open(url, '_blank');
  }, [url]);

  return (
    <div className="h-full w-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-purple-50">
        <div className="text-lg font-medium text-gray-900 flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Globe className="h-5 w-5" />
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
        <div className="text-sm text-purple-500 font-semibold mb-3">{nodeData.category}</div>
        <form onSubmit={handleUrlSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Enter website URL..."
            className="flex-1 px-3 py-2 text-sm text-black border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            type="submit"
            className="p-2 rounded hover:bg-purple-100 text-purple-600 transition-colors"
            title="Load URL"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={openInNewTab}
            className="p-2 rounded hover:bg-purple-100 text-purple-600 transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        </form>
      </div>
      
      {/* Website iframe */}
      <div className="flex-1 overflow-hidden bg-white">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex items-center gap-2 text-gray-500">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="text-lg">Loading...</span>
            </div>
          </div>
        ) : (
          <iframe
            src={url}
            data-node-id={nodeData.label}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
            title={`Website: ${url}`}
          />
        )}
      </div>
    </div>
  );
} 