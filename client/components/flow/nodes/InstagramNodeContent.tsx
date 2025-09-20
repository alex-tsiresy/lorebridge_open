"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Instagram, ExternalLink, RefreshCw, Copy, Check } from "lucide-react";
import { NodeData } from '../types';
import { NODE_COLORS } from '../constants';
import { getNodeHeaderStyle, getNodeContentStyle, getStickyNoteStyle } from '../utils';
import { FullScreenButton } from '../ui/FullScreenButton';
import { logger } from '@/lib/logger';

interface InstagramNodeData extends NodeData {
  url?: string;
  transcript?: string;
  isLoading?: boolean;
  error?: string | null;
}

interface InstagramNodeContentProps {
  nodeId: string;
  nodeData: InstagramNodeData;
  selected: boolean;
}

export function InstagramNodeContent({ nodeId, nodeData, selected }: InstagramNodeContentProps) {
  // State management
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

  // Broadcast Instagram content updates to full screen component
  useEffect(() => {
    const event = new CustomEvent('instagram-content-update', {
      detail: {
        nodeId: nodeId,
        url: url,
        transcript: transcript,
        isLoading: isLoading,
        error: error,
        timestamp: new Date().toISOString()
      }
    });
    window.dispatchEvent(event);
  }, [nodeId, url, transcript, isLoading, error]);

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

  const headerStyle = getNodeHeaderStyle('INSTAGRAM');
  const contentStyle = getNodeContentStyle('INSTAGRAM');
  const containerStyle = getStickyNoteStyle('INSTAGRAM', selected);

  return (
    <div className={containerStyle.className} style={containerStyle.style}>
      <div className="h-full flex flex-col relative z-10">
        {/* Header with URL input */}
        <div className={headerStyle.className} style={headerStyle.style}>
          <div className="text-sm font-semibold flex items-center justify-between mb-2" style={{ color: NODE_COLORS.INSTAGRAM.textColor }}>
            <div className="flex items-center gap-2">
              <Instagram className="h-4 w-4" />
              {nodeData.label}
            </div>
            <FullScreenButton nodeId={nodeId} />
          </div>
          <form onSubmit={handleUrlSubmit} className="flex items-center gap-1">
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Enter Instagram URL..."
              className="flex-1 px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1"
              style={{ 
                color: NODE_COLORS.INSTAGRAM.textColor,
                borderColor: NODE_COLORS.INSTAGRAM.border,
                backgroundColor: 'rgba(255, 255, 255, 0.8)'
              }}
            />
            <button
              type="submit"
              disabled={isLoading}
              className="p-1 rounded hover:opacity-80 transition-all disabled:opacity-50"
              style={{ color: NODE_COLORS.INSTAGRAM.textColor }}
              title="Fetch Transcript"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            {url && (
              <button
                type="button"
                onClick={openInNewTab}
                className="p-1 rounded hover:opacity-80 transition-all"
                style={{ color: NODE_COLORS.INSTAGRAM.textColor }}
                title="Open in new tab"
              >
                <ExternalLink className="h-3 w-3" />
              </button>
            )}
          </form>
          {error && (
            <div className="mt-1 text-xs" style={{ color: '#dc2626' }}>{error}</div>
          )}
        </div>
        
        {/* Transcript display area */}
        <div className="flex-1 overflow-hidden flex flex-col" style={contentStyle.style}>
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex items-center gap-2" style={{ color: NODE_COLORS.INSTAGRAM.textColor, opacity: 0.7 }}>
                <RefreshCw className="h-5 w-5 animate-spin" />
                <span className="text-sm">Extracting transcript...</span>
              </div>
            </div>
          ) : transcript ? (
            <div className="flex-1 flex flex-col">
              <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: NODE_COLORS.INSTAGRAM.border }}>
                <span className="text-xs font-medium" style={{ color: NODE_COLORS.INSTAGRAM.textColor }}>Transcript</span>
                <button
                  onClick={copyTranscript}
                  className="p-1 rounded hover:opacity-80 transition-all"
                  style={{ color: NODE_COLORS.INSTAGRAM.textColor }}
                  title="Copy transcript"
                >
                  {copied ? <Check className="h-3 w-3" style={{ color: '#16a34a' }} /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
              <div className="flex-1 p-3 overflow-y-auto">
                <div className="text-xs whitespace-pre-wrap leading-relaxed" style={{ color: NODE_COLORS.INSTAGRAM.textColor }}>
                  {transcript}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center" style={{ color: NODE_COLORS.INSTAGRAM.textColor, opacity: 0.7 }}>
                <Instagram className="h-8 w-8 mx-auto mb-2" style={{ opacity: 0.5 }} />
                <p className="text-sm">Enter an Instagram URL to extract transcript</p>
                <p className="text-xs mt-1" style={{ opacity: 0.6 }}>Supports posts, reels, and IGTV</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 