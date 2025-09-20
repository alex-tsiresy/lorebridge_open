"use client";

import React, { useMemo } from 'react';
import { useFullScreen } from '../context/FullScreenContext';
import { useReactFlow } from '@xyflow/react';
import { FlowNodeData } from '../types';
import MarkdownRenderer from '../../MarkdownRenderer';
import { FullScreenChat } from './FullScreenChat';
import { FullScreenDocument } from './FullScreenDocument';
import { FullScreenGraph } from './FullScreenGraph';
import { FullScreenTable } from './FullScreenTable';
import { FullScreenPDF } from './FullScreenPDF';
import { FullScreenWebsite } from './FullScreenWebsite';
import { FullScreenYouTube } from './FullScreenYouTube';
import { FullScreenInstagram } from './FullScreenInstagram';
import { FullScreenArtefact } from './FullScreenArtefact';

export function FullScreenOverlay() {
  const { fullScreenNodeId } = useFullScreen();
  const { getNode } = useReactFlow();
  
  // Always call hooks before any conditional returns
  const node = fullScreenNodeId ? getNode(fullScreenNodeId) : null;
  const nodeData = node?.data as unknown as FlowNodeData;
  
  // Memoize fresh node data to prevent unnecessary re-renders
  const freshNodeData = useMemo(() => {
    if (!node || !nodeData) return null;
    return {
      ...nodeData,
      ...node.data,
    };
  }, [nodeData, node?.data, node]);

  // Memoize the content renderer for performance
  const renderNodeContent = useMemo(() => {
    if (!fullScreenNodeId || !node || !nodeData || !freshNodeData) return null;
    switch (nodeData.type) {
      case 'chat':
        return (
          <FullScreenChat 
            nodeId={fullScreenNodeId!}
          />
        );
      case 'document':
        return (
          <div className="h-full">
            <FullScreenDocument 
              nodeData={freshNodeData as any} 
              nodeId={node.id} 
            />
          </div>
        );
      case 'graph':
        return (
          <div className="h-full">
            <FullScreenGraph 
              nodeData={freshNodeData as any} 
              nodeId={node.id} 
            />
          </div>
        );
      case 'table':
        return (
          <div className="h-full">
            <FullScreenTable 
              nodeData={freshNodeData as any} 
              nodeId={node.id} 
            />
          </div>
        );
      case 'pdf':
        return (
          <div className="h-full">
            <FullScreenPDF 
              nodeData={freshNodeData as any} 
            />
          </div>
        );
      case 'website':
        return (
          <div className="h-full">
            <FullScreenWebsite 
              nodeData={freshNodeData as any} 
              nodeId={node.id} 
            />
          </div>
        );
      case 'youtube':
        return (
          <div className="h-full">
            <FullScreenYouTube 
              nodeData={freshNodeData as any} 
              nodeId={node.id} 
            />
          </div>
        );
      case 'instagram':
        return (
          <div className="h-full">
            <FullScreenInstagram 
              nodeData={freshNodeData as any} 
              nodeId={node.id} 
            />
          </div>
        );
      case 'artefact':
        return (
          <div className="h-full">
            <FullScreenArtefact 
              nodeData={freshNodeData as any} 
            />
          </div>
        );
      default:
        const defaultContent = (freshNodeData as any).content || 'No content available.';
        return (
          <div className="p-8">
            <div className="fullscreen-prose">
              <MarkdownRenderer content={defaultContent} />
            </div>
          </div>
        );
    }
  }, [nodeData?.type, fullScreenNodeId, node?.id, freshNodeData, node, nodeData]);

  // Early returns after all hooks have been called
  if (!fullScreenNodeId || !node || !nodeData) {
    return null;
  }

  return (
    <div className="fullscreen-overlay">
      {/* Content - takes full page */}
      <div className="h-full w-full">
        {renderNodeContent}
      </div>
    </div>
  );
} 