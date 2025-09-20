"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { Instagram, ExternalLink, RefreshCw, Copy, Check, X } from 'lucide-react';
import { InstagramNodeData } from '../types';
import { useFullScreen } from '../context/FullScreenContext';
import { logger } from '@/lib/logger';

interface FullScreenInstagramProps {
  nodeData: InstagramNodeData;
  nodeId: string;
}

export function FullScreenInstagram({ nodeData, nodeId }: FullScreenInstagramProps) {
  const { setFullScreenNodeId } = useFullScreen();
  const [url, setUrl] = useState(nodeData.url || '');
  const [inputUrl, setInputUrl] = useState(url);
  const [transcript, setTranscript] = useState(nodeData.transcript || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const validateInstagramUrl = (url: string): boolean => {
    const instagramRegex = /^(https?:\/\/)?(www\.)?instagram\.com\/(p|reel|reels|tv)\/[\w-]+/;
    return instagramRegex.test(url);
  };

  const handleClose = () => {
    setFullScreenNodeId(null);
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
    
    if (!validateInstagramUrl(newUrl)) {
      setError('Please enter a valid Instagram URL (posts, reels, or IGTV)');
      return;
    }
    
    setUrl(newUrl);
    setInputUrl(newUrl);
    
    // Fetch transcript
    setIsLoading(true);
    try {
      // TODO: Connect to backend API for Instagram transcript extraction
      const extractedTranscript = "Instagram transcript extraction moved to backend";
      setTranscript(extractedTranscript);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract transcript');
      setTranscript('');
    } finally {
      setIsLoading(false);
    }
  }, [inputUrl]);

  // Listen for real-time content updates from InstagramNode
  useEffect(() => {
    const handleContentUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { nodeId: eventNodeId, url: nodeUrl, transcript: nodeTranscript, isLoading: nodeIsLoading, error: nodeError } = customEvent.detail;
      
      if (eventNodeId === nodeId) {
        logger.log('[FullScreenInstagram] Received content update', {
          nodeId: eventNodeId,
          hasUrl: !!nodeUrl,
          transcriptLength: nodeTranscript?.length || 0,
          isLoading: nodeIsLoading,
          hasError: !!nodeError
        });
        
        setUrl(nodeUrl || '');
        setInputUrl(nodeUrl || '');
        setTranscript(nodeTranscript || '');
        setIsLoading(nodeIsLoading || false);
        setError(nodeError || null);
      }
    };

    window.addEventListener('instagram-content-update', handleContentUpdate);
    return () => {
      window.removeEventListener('instagram-content-update', handleContentUpdate);
    };
  }, [nodeId]);

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

  return (
    <div className="h-full w-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-pink-50">
        <div className="text-lg font-medium text-gray-900 flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Instagram className="h-5 w-5 text-pink-600" />
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
        <form onSubmit={handleUrlSubmit} className="flex items-center gap-2 mb-2">
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Enter Instagram URL..."
            className="flex-1 px-3 py-2 text-sm text-black border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="p-2 rounded hover:bg-pink-100 text-pink-600 transition-colors disabled:opacity-50"
            title="Fetch Transcript"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {url && (
            <button
              type="button"
              onClick={openInNewTab}
              className="p-2 rounded hover:bg-pink-100 text-pink-600 transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
          )}
        </form>
        {error && (
          <div className="text-sm text-red-600">{error}</div>
        )}
      </div>
      
      {/* Transcript display area */}
      <div className="flex-1 overflow-hidden bg-white flex flex-col">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-2 text-gray-500">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="text-lg">Extracting transcript...</span>
            </div>
          </div>
        ) : transcript ? (
          <div className="flex-1 flex flex-col">
            <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Transcript</span>
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
              <Instagram className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg">Enter an Instagram URL to extract transcript</p>
              <p className="text-sm text-gray-400 mt-2">Supports posts, reels, and IGTV</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 