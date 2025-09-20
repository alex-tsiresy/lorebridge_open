'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { FileText } from 'lucide-react';
import { useApiClient } from '../lib/useApiClient';
import { NODE_COLORS } from './flow/constants';
import { logger } from '@/lib/logger';

interface PDFComponentsType {
  Document: React.ComponentType<Record<string, unknown>>;
  Page: React.ComponentType<{
    pageNumber: number;
    scale?: number;
    rotate?: number;
    onRenderSuccess?: (page: { getViewport: (args: { scale: number; rotation: number }) => { width: number; height: number } }) => void;
    className?: string;
  }>;
}

interface PDFViewerProps {
  className?: string;
  onPageResize?: (width: number, height: number) => void;
  graphId?: string;  // Add graphId prop to enable file uploads
  onPdfUploaded?: (assetId: string) => void;  // Callback when PDF is processed
  contentId?: string;  // Asset ID to load existing PDF
  isPlaceholder?: boolean;  // Whether this is a placeholder waiting for upload
  placeholderId?: string;  // Placeholder ID for creating real asset
  onAssetCreated?: (newAssetId: string) => void;  // Callback when real asset is created from placeholder
  showImmediately?: boolean;  // Show PDF immediately without waiting for processing
  fullScreenMode?: boolean;  // Whether to render in full screen mode with continuous scrolling
}

export default function PDFViewer({ 
  className = '', 
  onPageResize, 
  graphId, 
  onPdfUploaded, 
  contentId, 
  isPlaceholder = false,
  placeholderId,
  onAssetCreated,
  showImmediately = false,
  fullScreenMode = false
}: PDFViewerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);  // For loading existing files
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isClient, setIsClient] = useState(false);
  const [PDFComponents, setPDFComponents] = useState<PDFComponentsType | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [loadingExisting, setLoadingExisting] = useState<boolean>(false);
  const [actualAssetId, setActualAssetId] = useState<string | null>(null); // Track the real asset ID
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set([1])); // Track visible pages for virtualization
  
  const apiClient = useApiClient();

  // Memoize PDF.js options to prevent unnecessary reloads (must be at top to maintain hook order)
  const pdfOptions = useMemo(() => ({
    // Add CORS support and error handling
    httpHeaders: {},
    withCredentials: false,
    // Reduce verbosity for production
    verbosity: process.env.NODE_ENV === 'production' ? 0 : 1,
    // Simple fix: disable external font loading completely
    disableFontFace: true,
    useSystemFonts: true,
    stopAtErrors: false,
  }), []);

  // Get the backend base URL for file serving
  const getBackendFileUrl = useCallback((assetId: string) => {
    // Use the frontend API route which handles authentication
    const url = `/api/v1/graphs/${graphId}/assets/${assetId}/file`;
    return url;
  }, [graphId]);

  // Load existing PDF file if contentId is provided (but skip for placeholders)
  useEffect(() => {
    const loadExistingPdf = async () => {
      // Skip loading for placeholder nodes - they don't have real assets yet
      if (isPlaceholder) {
        return;
      }
      
      // Use actualAssetId if available (for placeholder-created assets), otherwise use contentId
      const assetIdToLoad = actualAssetId || contentId;
      
      if (!assetIdToLoad || !graphId || !apiClient) {
        return;
      }
      setLoadingExisting(true);
      try {
        // Check if the asset has a file available
        const assetData = await apiClient.getAsset(graphId, assetIdToLoad) as { 
          status: string; 
          file_path?: string; 
          source?: string; 
        };
        
        if ((assetData.status === 'completed' && assetData.file_path) || showImmediately) {
          // Create URL to the stored file using backend URL
          const fileUrl = getBackendFileUrl(assetIdToLoad);
          
          // Use URL-based loading directly (simpler and more reliable)
          setFileUrl(fileUrl);
          setError('');
          setUploadStatus('');
        } else if (assetData.status === 'processing') {
          setUploadStatus('PDF is processing...');
          // Start polling for completion
          startPolling(assetIdToLoad);
        } else if (assetData.status === 'failed') {
          setError('PDF processing failed. Please try uploading again.');
        } else {
          if (assetData.source === 'example.pdf') {
            // This is a placeholder asset, show upload area
            setUploadStatus('');
          }
        }
      } catch (error) {
        // If asset not found (404), treat as if there's no PDF to load
        if (error instanceof Error && error.message.includes('404')) {
          setError('');
          setUploadStatus('');
        }
        // Don't set error here - just means no existing file, user can upload
      } finally {
        setLoadingExisting(false);
      }
    };
    
    loadExistingPdf();
  }, [contentId, actualAssetId, graphId, apiClient, isPlaceholder, getBackendFileUrl]);

  // Polling function to check processing status
  const startPolling = useCallback((assetIdToCheck?: string) => {
    // Use provided assetId or actualAssetId if available (for placeholder-created assets), otherwise use contentId
    const assetId = assetIdToCheck || actualAssetId || contentId;
    if (!assetId || !graphId || !apiClient) return;
    
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts * 2 seconds = 1 minute max
    
    const pollStatus = async () => {
      if (attempts >= maxAttempts) {
        setUploadStatus('Processing is taking longer than expected...');
        return;
      }
      
      try {
        const assetData = await apiClient.getAsset(graphId, assetId) as { 
          status: string; 
          file_path?: string; 
        };
        
        if (assetData.status === 'completed' && assetData.file_path) {
          setUploadStatus('PDF processed successfully! Ready for Q&A.');
          const fileUrl = getBackendFileUrl(assetId);
          setFileUrl(fileUrl);
          
          setError('');
          
          // Clear status after 3 seconds
          setTimeout(() => setUploadStatus(''), 3000);
        } else if (assetData.status === 'failed') {
          setUploadStatus('');
          setError('PDF processing failed. Please try uploading again.');
        } else {
          // Still processing, check again in 2 seconds
          attempts++;
          setTimeout(pollStatus, 2000);
        }
      } catch (error) {
        logger.error('Error polling asset status:', error);
        setUploadStatus('');
        setError('Error checking processing status.');
      }
    };
    
    // Start polling after a short delay
    setTimeout(pollStatus, 2000);
  }, [actualAssetId, contentId, graphId, apiClient, getBackendFileUrl]);

  // Set up PDF.js worker and components on client side only
  useEffect(() => {
    const setupPDF = async () => {
      if (typeof window !== 'undefined') {
        try {
          // Import react-pdf components
          const reactPdf = await import('react-pdf');
          const { pdfjs } = reactPdf;
          
          // Use the local worker file
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
          
          
          // Load CSS styles dynamically
          const loadStyle = (href: string) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            document.head.appendChild(link);
          };
          
          // Load react-pdf styles
          if (!document.querySelector('link[href*="AnnotationLayer.css"]')) {
            loadStyle('https://unpkg.com/react-pdf@10.0.1/dist/Page/AnnotationLayer.css');
          }
          if (!document.querySelector('link[href*="TextLayer.css"]')) {
            loadStyle('https://unpkg.com/react-pdf@10.0.1/dist/Page/TextLayer.css');
          }
          
          // Store the components for use in render
          setPDFComponents({
            Document: reactPdf.Document,
            Page: reactPdf.Page,
          } as PDFComponentsType);
          
          setIsClient(true);
        } catch (error) {
          logger.error('Failed to load PDF components:', error);
          setError('Failed to load PDF viewer components');
        }
      }
    };
    setupPDF();
  }, []);

  const onFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = event.target;
    if (files && files[0]) {
      const selectedFile = files[0];
      
      // Check if file is PDF
      if (selectedFile.type !== 'application/pdf') {
        setError('Please select a PDF file');
        return;
      }
      
      // Check file size (max 4MB)
      if (selectedFile.size > 4 * 1024 * 1024) {
        setError('File size must be less than 4MB');
        return;
      }
      
      setFile(selectedFile);
      setError('');
      setPageNumber(1);
      setScale(1.0);
      setRotation(0);

      // If graphId is provided, upload and process the PDF
      if (graphId && apiClient) {
        setIsUploading(true);
        setUploadStatus('Uploading and processing PDF...');
        
        try {
          let result: { id: string } | undefined;
          
          // Handle placeholder nodes - create real asset first
          if (isPlaceholder && placeholderId) {
            logger.log('PDFViewer: Creating real asset from placeholder:', placeholderId);
            result = await apiClient.createAssetFromPlaceholder(graphId, placeholderId, selectedFile);
            setUploadStatus('PDF uploaded successfully! Processing in background...');
            
            // Set the actual asset ID for polling and file URL
            if (result?.id) {
              const newAssetId = result.id;
              setActualAssetId(newAssetId);
              
              // Set the file URL immediately so it shows in the viewer
              const fileUrl = getBackendFileUrl(newAssetId);
              setFileUrl(fileUrl);
              
              // Notify parent component that real asset was created
              if (onAssetCreated) {
                onAssetCreated(newAssetId);
              }
              
              // Start polling for processing completion
              setTimeout(() => {
                setUploadStatus('PDF is processing...');
                startPolling(newAssetId);
              }, 2000);
            }
            
          } else if (contentId) {
            // Upload to existing asset
            // Use actualAssetId if available (for placeholder-created assets), otherwise use contentId
            const assetIdToUpload = actualAssetId || contentId;
            logger.log('PDFViewer: Uploading to existing asset:', assetIdToUpload);
            result = await apiClient.uploadPdfToAsset(graphId, assetIdToUpload, selectedFile);
            setUploadStatus('PDF uploaded successfully! Processing in background...');
            
            // Set the file URL immediately so it shows in the viewer
            const fileUrl = getBackendFileUrl(assetIdToUpload);
            setFileUrl(fileUrl);
            
            // Start polling for processing completion
            setTimeout(() => {
              setUploadStatus('PDF is processing...');
              startPolling(assetIdToUpload);
            }, 2000);
            
          } else {
            // Fallback: create new asset (for backwards compatibility)
            logger.log('PDFViewer: Creating new asset for upload');
            result = await apiClient.uploadPdfFile(graphId, selectedFile);
            setUploadStatus('PDF uploaded successfully! Processing in background...');
            
            if (onPdfUploaded && result?.id) {
              onPdfUploaded(result.id);
            }
          }
          
          // Clear uploading state
          setIsUploading(false);
          
        } catch (uploadError) {
          logger.error('Failed to upload PDF:', uploadError);
          setError(`Failed to upload PDF: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
          setIsUploading(false);
          setUploadStatus('');
        }
      }
    }
  }, [graphId, apiClient, onPdfUploaded, contentId, isPlaceholder, placeholderId, onAssetCreated, getBackendFileUrl, startPolling]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    // Check if it's a network/response error
    if (error.name === 'ResponseException' || error.message.includes('ResponseException')) {
      setError('Failed to load PDF file - network or server error. Please try refreshing the page.');
    } else {
      setError(`Failed to load PDF: ${error.message}`);
    }
    setLoading(false);
  }, []);

  const onDocumentLoadStart = useCallback(() => {
    setLoading(true);
    setError('');
  }, []);

  const goToPrevPage = () => {
    setPageNumber(prev => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setPageNumber(prev => Math.min(numPages, prev + 1));
  };

  const zoomIn = () => {
    setScale(prev => Math.min(3.0, prev + 0.2));
  };

  const zoomOut = () => {
    setScale(prev => Math.max(0.5, prev - 0.2));
  };

  const rotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  // Create a ref to store the intersection observer
  const observerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || !fullScreenMode) return;
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const pageNumber = parseInt(entry.target.getAttribute('data-page') || '0');
        if (pageNumber > 0) {
          setVisiblePages(prev => {
            const newSet = new Set(prev);
            if (entry.isIntersecting) {
              newSet.add(pageNumber);
              // Add buffer pages for smooth scrolling
              if (pageNumber > 1) newSet.add(pageNumber - 1);
              if (pageNumber < numPages) newSet.add(pageNumber + 1);
            }
            return newSet;
          });
        }
      });
    }, {
      root: null,
      rootMargin: '300px',
      threshold: 0.1
    });
    
    observer.observe(node);
    return () => observer.disconnect();
  }, [fullScreenMode, numPages]);


  // Show loading state while client-side setup is happening
  if (!isClient || !PDFComponents) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg`}>
        <div className="text-center p-8">
          <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500">Loading PDF viewer...</p>
        </div>
      </div>
    );
  }

  // Show loading state while loading existing PDF
  if (loadingExisting) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg`}>
        <div className="text-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading existing PDF...</p>
        </div>
      </div>
    );
  }

  // Determine what to display: uploaded file or file URL
  const pdfSource = file || fileUrl;
  const hasContent = pdfSource !== null;

  return (
    <div 
      className={`${className} flex flex-col overflow-hidden`}
      style={{ 
        backgroundColor: hasContent ? 'white' : NODE_COLORS.PDF.background,
        border: 'none'
      }}
    >
      {/* File upload area - only show if no content is loaded */}
      {!hasContent && (
        <div className="flex-1 flex items-center justify-center m-2">
          <div className="text-center p-8 w-full max-w-md">
            <div 
              className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6"
              style={{ 
                backgroundColor: NODE_COLORS.PDF.headerBg,
                border: `2px solid ${NODE_COLORS.PDF.border}`
              }}
            >
              <FileText className="h-8 w-8" style={{ color: NODE_COLORS.PDF.textColor }} />
            </div>
            <h3 
              className="text-xl font-semibold mb-3"
              style={{ color: NODE_COLORS.PDF.textColor }}
            >
              PDF Document
            </h3>
            <p 
              className="text-sm mb-6 opacity-80"
              style={{ color: NODE_COLORS.PDF.textColor }}
            >
              Upload a PDF file to extract and view its content
            </p>
            
            {/* Show upload area if no processing status */}
            {!uploadStatus && !isUploading && (
              <>
                <div 
                  className="p-4 rounded-lg border-2 border-dashed mb-4"
                  style={{ 
                    backgroundColor: NODE_COLORS.PDF.headerBg,
                    borderColor: NODE_COLORS.PDF.border
                  }}
                >
                  <label htmlFor="pdf-upload" className="cursor-pointer block">
                    <span 
                      className="text-base font-medium block mb-2"
                      style={{ color: NODE_COLORS.PDF.textColor }}
                    >
                      Click to upload PDF
                    </span>
                    <p 
                      className="text-sm opacity-80"
                      style={{ color: NODE_COLORS.PDF.textColor }}
                    >
                      PDF files up to 4MB
                    </p>
                  </label>
                  <input
                    id="pdf-upload"
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={onFileChange}
                    className="hidden"
                  />
                </div>
              </>
            )}
            
            {/* Show uploading indicator */}
            {isUploading && (
              <div className="mt-4">
                <div 
                  className="animate-spin rounded-full h-6 w-6 border-b-2 mx-auto mb-2"
                  style={{ borderColor: NODE_COLORS.PDF.border }}
                ></div>
                <p 
                  className="text-sm font-medium"
                  style={{ color: NODE_COLORS.PDF.textColor }}
                >
                  {uploadStatus}
                </p>
              </div>
            )}
            
            {/* Show processing status */}
            {uploadStatus && !isUploading && (
              <div className="mt-4">
                {uploadStatus.includes('processing') || uploadStatus.includes('Processing') ? (
                  <div 
                    className="animate-spin rounded-full h-6 w-6 border-b-2 mx-auto mb-2"
                    style={{ borderColor: NODE_COLORS.PDF.border }}
                  ></div>
                ) : null}
                <p 
                  className="text-sm font-medium"
                  style={{ color: NODE_COLORS.PDF.textColor }}
                >
                  {uploadStatus}
                </p>
                
                {/* Show upload option again if processing failed or completed */}
                {(uploadStatus.includes('failed') || uploadStatus.includes('Ready for Q&A')) && (
                  <div className="mt-4">
                    <label htmlFor="pdf-upload-retry" className="cursor-pointer">
                      <span 
                        className="text-sm font-medium hover:opacity-80 transition-opacity"
                        style={{ color: NODE_COLORS.PDF.textColor }}
                      >
                        Upload a different PDF
                      </span>
                    </label>
                    <input
                      id="pdf-upload-retry"
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={onFileChange}
                      className="hidden"
                    />
                  </div>
                )}
              </div>
            )}
            
            {/* Show error */}
            {error && (
              <div className="mt-4">
                <p 
                  className="text-sm font-medium"
                  style={{ color: '#dc2626' }}
                >
                  {error}
                </p>
                <div className="mt-2">
                  <label htmlFor="pdf-upload-error" className="cursor-pointer">
                    <span 
                      className="text-sm font-medium hover:opacity-80 transition-opacity"
                      style={{ color: NODE_COLORS.PDF.textColor }}
                    >
                      Try uploading again
                    </span>
                  </label>
                  <input
                    id="pdf-upload-error"
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={onFileChange}
                    className="hidden"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PDF display area - show if content is available */}
      {hasContent && (
        <>
          {/* PDF Controls - hide navigation in full screen mode */}
          {!fullScreenMode && (
            <div 
              className="flex items-center justify-between p-3 text-sm"
              style={{ 
                backgroundColor: NODE_COLORS.PDF.headerBg,
                borderBottom: `2px solid ${NODE_COLORS.PDF.border}`
              }}
            >
              <div className="flex items-center space-x-2">
                <button
                  onClick={goToPrevPage}
                  disabled={pageNumber <= 1}
                  className="px-2 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  style={{
                    backgroundColor: 'white',
                    border: `1px solid ${NODE_COLORS.PDF.border}`,
                    color: NODE_COLORS.PDF.textColor
                  }}
                  onMouseEnter={(e) => {
                    if (pageNumber > 1) {
                      e.currentTarget.style.backgroundColor = NODE_COLORS.PDF.border;
                      e.currentTarget.style.color = 'white';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (pageNumber > 1) {
                      e.currentTarget.style.backgroundColor = 'white';
                      e.currentTarget.style.color = NODE_COLORS.PDF.textColor;
                    }
                  }}
                >
                  ←
                </button>
                <span style={{ color: NODE_COLORS.PDF.textColor }}>
                  Page {pageNumber} of {numPages}
                </span>
                <button
                  onClick={goToNextPage}
                  disabled={pageNumber >= numPages}
                  className="px-2 py-1 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  style={{
                    backgroundColor: 'white',
                    border: `1px solid ${NODE_COLORS.PDF.border}`,
                    color: NODE_COLORS.PDF.textColor
                  }}
                  onMouseEnter={(e) => {
                    if (pageNumber < numPages) {
                      e.currentTarget.style.backgroundColor = NODE_COLORS.PDF.border;
                      e.currentTarget.style.color = 'white';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (pageNumber < numPages) {
                      e.currentTarget.style.backgroundColor = 'white';
                      e.currentTarget.style.color = NODE_COLORS.PDF.textColor;
                    }
                  }}
                >
                  →
                </button>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={zoomOut}
                  className="px-2 py-1 rounded transition-all duration-200"
                  style={{
                    backgroundColor: 'white',
                    border: `1px solid ${NODE_COLORS.PDF.border}`,
                    color: NODE_COLORS.PDF.textColor
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = NODE_COLORS.PDF.border;
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.color = NODE_COLORS.PDF.textColor;
                  }}
                  title="Zoom Out"
                >
                  −
                </button>
                <span style={{ color: NODE_COLORS.PDF.textColor, minWidth: '48px' }} className="text-center">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={zoomIn}
                  className="px-2 py-1 rounded transition-all duration-200"
                  style={{
                    backgroundColor: 'white',
                    border: `1px solid ${NODE_COLORS.PDF.border}`,
                    color: NODE_COLORS.PDF.textColor
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = NODE_COLORS.PDF.border;
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.color = NODE_COLORS.PDF.textColor;
                  }}
                  title="Zoom In"
                >
                  +
                </button>
                <button
                  onClick={rotate}
                  className="px-2 py-1 rounded transition-all duration-200"
                  style={{
                    backgroundColor: 'white',
                    border: `1px solid ${NODE_COLORS.PDF.border}`,
                    color: NODE_COLORS.PDF.textColor
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = NODE_COLORS.PDF.border;
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.color = NODE_COLORS.PDF.textColor;
                  }}
                  title="Rotate"
                >
                  ↻
                </button>
              </div>
            </div>
          )}

          {/* Zoom controls for full screen mode */}
          {fullScreenMode && (
            <div 
              className="flex items-center justify-center p-3 text-sm"
              style={{ 
                backgroundColor: NODE_COLORS.PDF.headerBg,
                borderBottom: `2px solid ${NODE_COLORS.PDF.border}`
              }}
            >
              <div className="flex items-center space-x-2">
                <button
                  onClick={zoomOut}
                  className="px-3 py-1 rounded transition-all duration-200"
                  style={{
                    backgroundColor: 'white',
                    border: `1px solid ${NODE_COLORS.PDF.border}`,
                    color: NODE_COLORS.PDF.textColor
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = NODE_COLORS.PDF.border;
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.color = NODE_COLORS.PDF.textColor;
                  }}
                  title="Zoom Out"
                >
                  −
                </button>
                <span style={{ color: NODE_COLORS.PDF.textColor, minWidth: '60px' }} className="text-center font-medium">
                  {Math.round(scale * 100)}%
                </span>
                <button
                  onClick={zoomIn}
                  className="px-3 py-1 rounded transition-all duration-200"
                  style={{
                    backgroundColor: 'white',
                    border: `1px solid ${NODE_COLORS.PDF.border}`,
                    color: NODE_COLORS.PDF.textColor
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = NODE_COLORS.PDF.border;
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.color = NODE_COLORS.PDF.textColor;
                  }}
                  title="Zoom In"
                >
                  +
                </button>
                <button
                  onClick={rotate}
                  className="px-3 py-1 rounded transition-all duration-200 ml-4"
                  style={{
                    backgroundColor: 'white',
                    border: `1px solid ${NODE_COLORS.PDF.border}`,
                    color: NODE_COLORS.PDF.textColor
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = NODE_COLORS.PDF.border;
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.color = NODE_COLORS.PDF.textColor;
                  }}
                  title="Rotate"
                >
                  ↻
                </button>
              </div>
            </div>
          )}

          <div 
            className="flex-1 overflow-auto p-4"
            style={{ backgroundColor: NODE_COLORS.PDF.background }}
          >
            <div className="flex justify-center">
              {loading && (
                <div className="flex items-center justify-center p-8">
                  <div style={{ color: NODE_COLORS.PDF.textColor }}>Loading PDF...</div>
                </div>
              )}
              
              {PDFComponents && (
                <PDFComponents.Document
                  file={pdfSource}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  onLoadStart={onDocumentLoadStart}
                  className="max-w-full"
                  options={pdfOptions}
                >
                  {fullScreenMode ? (
                    // Render pages with virtualization for performance
                    <div className="space-y-6">
                      {Array.from(new Array(numPages), (el, index) => {
                        const pageNum = index + 1;
                        const isVisible = visiblePages.has(pageNum);
                        
                        return (
                          <div 
                            key={`page_${pageNum}`} 
                            className="relative"
                            data-page={pageNum}
                            style={{
                              minHeight: isVisible ? 'auto' : '600px' // Placeholder height for non-visible pages
                            }}
                            ref={observerRef}
                          >
                            {/* Page number label */}
                            <div 
                              className="text-center mb-2 text-sm font-medium"
                              style={{ color: NODE_COLORS.PDF.textColor }}
                            >
                              Page {pageNum} of {numPages}
                            </div>
                            
                            {isVisible ? (
                              <PDFComponents.Page
                                pageNumber={pageNum}
                                scale={scale}
                                rotate={rotation}
                                onRenderSuccess={(page: { getViewport: (args: { scale: number; rotation: number }) => { width: number; height: number } }) => {
                                  if (onPageResize && page && index === 0) {
                                    // Only call resize callback for the first page to avoid multiple calls
                                    const viewport = page.getViewport({ scale: scale, rotation: rotation });
                                    onPageResize(viewport.width, viewport.height);
                                  }
                                }}
                                className="shadow-lg bg-white rounded-lg mx-auto block"
                              />
                            ) : (
                              // Placeholder for non-visible pages
                              <div 
                                className="shadow-lg bg-gray-200 rounded-lg mx-auto block flex items-center justify-center"
                                style={{ 
                                  width: '612px', // Standard PDF width at scale 1
                                  height: '792px', // Standard PDF height at scale 1
                                  maxWidth: '100%'
                                }}
                              >
                                <div className="text-gray-500 text-sm">
                                  Page {pageNum}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    // Render single page for regular mode
                    <PDFComponents.Page
                      pageNumber={pageNumber}
                      scale={scale}
                      rotate={rotation}
                      onRenderSuccess={(page: { getViewport: (args: { scale: number; rotation: number }) => { width: number; height: number } }) => {
                        if (onPageResize && page) {
                          // Get the page viewport at current scale
                          const viewport = page.getViewport({ scale: scale, rotation: rotation });
                          // Call the resize callback with the actual rendered dimensions
                          onPageResize(viewport.width, viewport.height);
                        }
                      }}
                      className="shadow-lg bg-white rounded-lg"
                    />
                  )}
                </PDFComponents.Document>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
} 