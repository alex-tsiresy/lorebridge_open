"use client";

import React, { useState, useCallback, useMemo } from "react";
import { FileText } from "lucide-react";
import { useReactFlow } from '@xyflow/react';
import PDFViewer from '../../PDFViewer';
import { NodeData } from '../types';
import { NODE_COLORS, NODE_SIZES, PDF_NODE_PADDING } from '../constants';
import { getNodeHeaderStyle, getNodeContentStyle, getStickyNoteStyle } from '../utils';
import { useApiClient } from '../../../lib/useApiClient';
import { FullScreenButton } from '../ui/FullScreenButton';
import { logger } from '@/lib/logger';

interface PDFNodeData extends NodeData {
  type: 'pdf';
  graphId?: string;
  content_id?: string;
  is_placeholder?: boolean;  // Whether this is a placeholder waiting for upload
  placeholder_id?: string;   // Placeholder ID for creating real asset
}

interface PDFNodeContentProps {
  nodeId: string;
  nodeData: PDFNodeData;
  selected: boolean;
}

export function PDFNodeContent({ nodeId, nodeData, selected }: PDFNodeContentProps) {
  const { setNodes } = useReactFlow();
  const apiClient = useApiClient();
  
  // State for handling content
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [actualContentId, setActualContentId] = useState<string | undefined>(nodeData.content_id);

  // Extract graphId from nodeData or try to get it from context
  const graphId = nodeData.graphId || (nodeData as { graph_id?: string }).graph_id;

  // Broadcast PDF updates to full screen component
  const broadcastUpdate = useCallback((contentId: string, status: string) => {
    const event = new CustomEvent('pdf-content-update', {
      detail: {
        nodeId: nodeData.label,
        contentId: contentId,
        status: status
      }
    });
    window.dispatchEvent(event);
  }, [nodeData.label]);

  // Handle PDF upload completion
  const handlePdfUploaded = useCallback(async (assetId: string) => {
    const status = 'PDF uploaded! Processing in background...';
    setProcessingStatus(status);
    broadcastUpdate(assetId, status);
    
    // Poll for processing completion
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts * 2 seconds = 1 minute max
    
    const pollStatus = async () => {
      if (attempts >= maxAttempts) {
        setProcessingStatus('Processing is taking longer than expected...');
        return;
      }
      
      try {
        if (!graphId) {
          logger.error('No graphId available for polling');
          return;
        }
        
        const assetData = await apiClient.getAsset(graphId, assetId) as { status: string };
        
        if (assetData.status === 'completed') {
          const status = 'PDF processed successfully! Ready for Q&A.';
          setProcessingStatus(status);
          broadcastUpdate(assetId, status);
          setTimeout(() => {
            setProcessingStatus('');
            broadcastUpdate(assetId, '');
          }, 3000);
        } else if (assetData.status === 'failed') {
          const status = 'PDF processing failed. Please try uploading again.';
          setProcessingStatus(status);
          broadcastUpdate(assetId, status);
          setTimeout(() => {
            setProcessingStatus('');
            broadcastUpdate(assetId, '');
          }, 5000);
        } else {
          // Still processing, check again in 2 seconds
          attempts++;
          setTimeout(pollStatus, 2000);
        }
      } catch (error) {
        logger.error('Error polling asset status:', error);
        setProcessingStatus('Error checking processing status.');
        setTimeout(() => setProcessingStatus(''), 3000);
      }
    };
    
    // Start polling after a short delay
    setTimeout(pollStatus, 2000);
  }, [apiClient, graphId, broadcastUpdate]);

  // Handle PDF page resize callback
  const handlePageResize = useCallback((width: number, height: number) => {
    const totalExtraHeight = 
      PDF_NODE_PADDING.HEADER + 
      PDF_NODE_PADDING.PDF_VIEWER_HEADER + 
      PDF_NODE_PADDING.CONTROLS + 
      PDF_NODE_PADDING.BORDER;
    
    const newHeight = height + totalExtraHeight;
    
    // Update node dimensions
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, style: { ...node.style, height: newHeight } }
          : node
      )
    );
  }, [nodeId, setNodes]);

  // Handle asset creation callback
  const handleAssetCreated = useCallback((newAssetId: string) => {
    setActualContentId(newAssetId);
    
    // Update node data with the new asset ID
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { 
              ...node, 
              data: { 
                ...node.data, 
                content_id: newAssetId,
                is_placeholder: false 
              } 
            }
          : node
      )
    );
  }, [nodeId, setNodes]);

  // Memoize the PDF viewer component to prevent unnecessary re-renders
  const pdfViewerComponent = useMemo(() => (
    <PDFViewer
      graphId={graphId}
      contentId={actualContentId}
      onPdfUploaded={handlePdfUploaded}
      onPageResize={handlePageResize}
      onAssetCreated={handleAssetCreated}
      isPlaceholder={nodeData.is_placeholder}
      placeholderId={nodeData.placeholder_id}
    />
  ), [graphId, actualContentId, handlePdfUploaded, handlePageResize, handleAssetCreated, nodeData.is_placeholder, nodeData.placeholder_id]);

  const headerStyle = getNodeHeaderStyle('PDF');
  const contentStyle = getNodeContentStyle('PDF');
  const containerStyle = getStickyNoteStyle('PDF', selected);

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
        <div className={headerStyle.className} style={headerStyle.style}>
          <div className="text-sm font-semibold flex items-center justify-between" style={{ color: NODE_COLORS.PDF.textColor }}>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>{nodeData.label}</span>
            </div>
            <FullScreenButton nodeId={nodeId} isLoading={false} />
          </div>
          <div className="text-xs font-semibold mt-0.5" style={{ color: NODE_COLORS.PDF.textColor, opacity: 0.8 }}>{nodeData.category}</div>
        </div>
        
        {processingStatus && (
          <div className="px-4 py-2 border-b" style={{ backgroundColor: NODE_COLORS.PDF.headerBg, borderColor: NODE_COLORS.PDF.border }}>
            <p className="text-xs" style={{ color: NODE_COLORS.PDF.textColor }}>{processingStatus}</p>
          </div>
        )}
        
        <div className="flex-1 overflow-hidden" style={contentStyle.style}>
          {pdfViewerComponent}
        </div>
      </div>
    </div>
  );
} 