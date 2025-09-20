"use client";

import React, { useCallback, useState, useEffect } from 'react';
import { FileText, X } from 'lucide-react';
import PDFViewer from '../../PDFViewer';
import { NodeData } from '../types';
import { useFullScreen } from '../context/FullScreenContext';
import { logger } from '@/lib/logger';

// Use the same interface as PDFNodeContent
interface PDFNodeData extends NodeData {
  type: 'pdf';
  graphId?: string;
  content_id?: string;
  is_placeholder?: boolean;  // Whether this is a placeholder waiting for upload
  placeholder_id?: string;   // Placeholder ID for creating real asset
}

interface FullScreenPDFProps {
  nodeData: PDFNodeData;
}

export function FullScreenPDF({ nodeData }: FullScreenPDFProps) {
  const { setFullScreenNodeId } = useFullScreen();
  
  // State to sync with node content
  const [syncedContentId, setSyncedContentId] = useState(nodeData.content_id);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  
  // Extract graphId from nodeData or try to get it from context
  const graphId = nodeData.graphId || (nodeData as { graph_id?: string })?.graph_id;
  const contentId = syncedContentId || nodeData.content_id;
  const isPlaceholder = nodeData.is_placeholder;
  const placeholderId = nodeData.placeholder_id;
  
  // Listen for PDF node updates to sync content immediately
  useEffect(() => {
    const handlePDFUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { nodeId: eventNodeId, contentId, status } = customEvent.detail;
      
      if (eventNodeId === nodeData.label) { // Use label as identifier
        setSyncedContentId(contentId);
        setProcessingStatus(status || '');
      }
    };

    window.addEventListener('pdf-content-update', handlePDFUpdate);
    return () => {
      window.removeEventListener('pdf-content-update', handlePDFUpdate);
    };
  }, [nodeData.label]);

  // Handle PDF page resize callback
  const handlePageResize = useCallback((width: number, height: number) => {
    // In full screen mode, we don't need to resize the container
    logger.log('PDF page resized:', { width, height });
  }, []);

  // Handle PDF upload completion
  const handlePdfUploaded = useCallback((assetId: string) => {
    logger.log('PDF uploaded in full screen:', assetId);
    setSyncedContentId(assetId);
  }, []);

  // Handle asset creation callback
  const handleAssetCreated = useCallback((newAssetId: string) => {
    logger.log('Asset created in full screen:', newAssetId);
    setSyncedContentId(newAssetId);
  }, []);

  const handleClose = () => {
    setFullScreenNodeId(null);
  };

  return (
    <div className="h-full w-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-green-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5" />
            <div>
              <div className="text-lg font-medium text-gray-900">
                {nodeData.label}
              </div>
              <div className="text-sm text-green-500 font-semibold mt-1">{nodeData.category}</div>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
            title="Close full screen"
          >
            <X className="h-6 w-6 text-gray-600" />
          </button>
        </div>
      </div>
      
      
      {/* Processing Status */}
      {processingStatus && (
        <div className="px-6 py-2 bg-green-100 border-b border-green-200">
          <p className="text-sm text-green-700">{processingStatus}</p>
        </div>
      )}
      
      {/* PDF Viewer */}
      <div className="flex-1 overflow-auto bg-gray-50">
        <PDFViewer 
          className="h-full w-full" 
          onPageResize={handlePageResize}
          graphId={graphId}
          contentId={contentId}
          onPdfUploaded={handlePdfUploaded}
          onAssetCreated={handleAssetCreated}
          isPlaceholder={isPlaceholder}
          placeholderId={placeholderId}
          showImmediately={true}
          fullScreenMode={true}
        />
      </div>
    </div>
  );
} 