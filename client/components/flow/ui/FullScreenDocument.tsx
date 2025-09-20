"use client";

import React, { useState, useEffect, useRef } from "react";
import { Loader2, AlertCircle, Play, FileText, X } from "lucide-react";
import { useApiClient } from '@/lib/useApiClient';
import { DocumentNodeData } from '../types';
import MarkdownRenderer from '../../MarkdownRenderer';
import { useFullScreen } from '../context/FullScreenContext';
import { ProcessingOptionsModal } from '@/components/ProcessingOptionsModal';
import { logger } from '@/lib/logger';

interface FullScreenDocumentProps {
  nodeData: DocumentNodeData;
  nodeId: string;
}

export function FullScreenDocument({ nodeData, nodeId }: FullScreenDocumentProps) {
  const { setFullScreenNodeId } = useFullScreen();
  const apiClient = useApiClient();
  
  // Initialize with current node data immediately for fast display
  const [localContent, setLocalContent] = useState<string>(() => {
    // Prioritize actual content over placeholder states
    return nodeData.content || '';
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    // Only show loading if there's actually a process happening
    return (nodeData.isLoading || false) && !nodeData.content;
  });
  const [error, setError] = useState<string | null>(nodeData.error || null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [charactersReceived, setCharactersReceived] = useState<number>(0);
  const requestInProgressRef = useRef<boolean>(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [optionsPayload, setOptionsPayload] = useState<any | null>(null);
  const selectedOptionRef = useRef<any | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);

  const handleClose = () => {
    setFullScreenNodeId(null);
  };

  // Auto-scroll to bottom when content updates during streaming
  useEffect(() => {
    if (isLoading && localContent && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [localContent, isLoading]);

  // Listen for real-time content updates from DocumentNode
  useEffect(() => {
    const handleContentUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { nodeId: eventNodeId, content, isLoading: nodeIsLoading, error: nodeError, charactersReceived: nodeCharactersReceived } = customEvent.detail;
      
      if (eventNodeId === nodeId) {
        logger.log('[FullScreenDocument] Received content update', {
          nodeId: eventNodeId,
          contentLength: content?.length || 0,
          isLoading: nodeIsLoading,
          hasError: !!nodeError,
          charactersReceived: nodeCharactersReceived
        });
        
        setLocalContent(content || '');
        setIsLoading(nodeIsLoading || false);
        setError(nodeError || null);
        setCharactersReceived(nodeCharactersReceived || 0);
      }
    };

    window.addEventListener('document-content-update', handleContentUpdate);
    return () => {
      window.removeEventListener('document-content-update', handleContentUpdate);
    };
  }, [nodeId]);

  // Listen for chat-to-document edge creation events
  useEffect(() => {
    const handleUpdateDocumentNode = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { nodeId: eventNodeId, chatSessionId } = customEvent.detail;
      
      if (eventNodeId === nodeId && chatSessionId && !nodeData.chatSessionId) {
        // Update the node data with chatSessionId to trigger streaming
        const updateEvent = new CustomEvent('document-node-chat-session-update', {
          detail: {
            nodeId: nodeId,
            chatSessionId: chatSessionId,
          },
        });
        window.dispatchEvent(updateEvent);
      }
    };

    window.addEventListener('update-document-node', handleUpdateDocumentNode);
    return () => {
      window.removeEventListener('update-document-node', handleUpdateDocumentNode);
    };
  }, [nodeId, nodeData.chatSessionId]);

  // Pre-load artefact data immediately if available
  useEffect(() => {
    if (nodeData.artefactId && !localContent && !requestInProgressRef.current) {
      requestInProgressRef.current = true;
      const loadArtefact = async () => {
        try {
          setIsLoading(true);
          setError(null);
          
        const artefactData = await apiClient.getArtefact(nodeData.artefactId!) as any;
        if (artefactData.current_data?.markdown) {
          setLocalContent(artefactData.current_data.markdown);
        } else if (artefactData.content) {
          setLocalContent(artefactData.content);
        }
        } catch (err) {
          logger.error('Error loading artefact:', err);
          setError('Failed to load artefact content');
        } finally {
          setIsLoading(false);
          requestInProgressRef.current = false;
        }
      };
      
      loadArtefact();
    }
  }, [nodeData.artefactId, localContent, apiClient]);

  // Load processing options from database if available (for modal persistence on reload)
  useEffect(() => {
    if (nodeData.processingOptions && !optionsPayload) {
      setOptionsPayload(nodeData.processingOptions);
      if (nodeData.selectedProcessingOption) {
        selectedOptionRef.current = { 
          chatSessionId: null, // Will be set when edge is created
          selectedOption: nodeData.selectedProcessingOption 
        };
      }
      // Show modal if we have options but no content yet and no option was previously selected
      if (!localContent && !nodeData.content && nodeData.processingOptions?.options?.length > 0 && !nodeData.selectedProcessingOption) {
        setShowOptionsModal(true);
      }
    }
  }, [nodeData.processingOptions, nodeData.selectedProcessingOption, nodeData.processingOutputType, optionsPayload, nodeId, localContent, nodeData.content]);

  // Listen for document node chat session updates
  useEffect(() => {
    const handleDocumentNodeChatSessionUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { nodeId: eventNodeId, chatSessionId } = customEvent.detail;
      
      if (eventNodeId === nodeId && chatSessionId) {
        // First try to get processing options
        (async () => {
          try {
            setOptionsLoading(true);
            const opts = await apiClient.getProcessingOptions(chatSessionId, 'markdown', undefined, nodeData.artefactId);
            setOptionsPayload(opts);
            setShowOptionsModal(true);
            selectedOptionRef.current = { 
              chatSessionId,
              selectedOption: selectedOptionRef.current?.selectedOption 
            };
          } catch (e) {
            logger.error('Failed to get processing options, falling back to direct generation', e);
            createDocument(chatSessionId);
          } finally {
            setOptionsLoading(false);
          }
        })();
      }
    };

    window.addEventListener('document-node-chat-session-update', handleDocumentNodeChatSessionUpdate);
    return () => {
      window.removeEventListener('document-node-chat-session-update', handleDocumentNodeChatSessionUpdate);
    };
  }, [nodeId, apiClient, nodeData.artefactId]);

  const createDocument = async (chatSessionId: string) => {
    if (requestInProgressRef.current) return;
    
    try {
      requestInProgressRef.current = true;
      setIsLoading(true);
      setError(null);
      setLocalContent('');
      setCharactersReceived(0);
      
      logger.log('[FullScreenDocument] Starting document creation', {
        nodeId: nodeId,
        chatSessionId: chatSessionId,
        timestamp: new Date().toISOString()
      });

      const response = await apiClient.createDocumentArtefact(chatSessionId);
      
      if (response.ok) {
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body reader available');
        }

        const decoder = new TextDecoder();
        let accumulatedContent = '';

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            logger.log('[FullScreenDocument] Stream completed', {
              nodeId: nodeId,
              finalContentLength: accumulatedContent.length,
              timestamp: new Date().toISOString()
            });
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          accumulatedContent += chunk;
          setLocalContent(accumulatedContent);
          setCharactersReceived(accumulatedContent.length);
        }
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (err) {
      logger.error('[FullScreenDocument] Error creating document:', err);
      setError(err instanceof Error ? err.message : 'Failed to create document');
    } finally {
      setIsLoading(false);
      requestInProgressRef.current = false;
    }
  };

  const testCreateDocument = async () => {
    // This is a test function - you can implement it if needed
    logger.log('Test create document clicked');
  };

  return (
    <div className="h-full w-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-blue-50">
        <div className="text-lg font-medium text-gray-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-blue-600" />
            <span className="text-gray-900">{nodeData.label || 'Document'}</span>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
            title="Close full screen"
          >
            <X className="h-6 w-6 text-gray-600" />
          </button>
        </div>
        <div className="text-sm text-blue-600 font-semibold mt-1">Document</div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {showOptionsModal ? (
          <div className="p-8">
            <ProcessingOptionsModal
              isOpen={true}
              onClose={() => {
                setShowOptionsModal(false);
                handleClose();
              }}
              options={optionsPayload?.options || []}
              detectedSubjects={optionsPayload?.detected_subjects}
              outputType={'markdown'}
              nodeId={nodeId}
              isNodeSelected={true}
              inline
              onSelect={async (opt) => {
                setShowOptionsModal(false);
                try {
                  const chatSessionId = selectedOptionRef.current?.chatSessionId;
                  if (!chatSessionId) {
                    setError('Please connect this document to a chat session by creating an edge from a chat node to this document node');
                    return;
                  }
                  const response = await apiClient.createDocumentArtefactWithOption(chatSessionId, opt, undefined, nodeData.artefactId || undefined);
                  if (!response.body) return;
                  const reader = response.body.getReader();
                  const decoder = new TextDecoder();
                  setIsLoading(true);
                  setLocalContent('');
                  let buffer = '';
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;
                    const lines = buffer.split(/\r?\n/);
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                      if (!line.trim() || !line.startsWith('data: ')) continue;
                      const data = line.slice(6);
                      if (data === '[DONE]') continue;
                      try {
                        const event = JSON.parse(data);
                        if (event.type === 'token' && event.content) {
                          setLocalContent(prev => prev + event.content);
                          setCharactersReceived(prev => prev + event.content.length);
                        }
                      } catch {
                        setLocalContent(prev => prev + data);
                      }
                    }
                  }
                } catch (e) {
                  logger.error('Error generating markdown with selected option', e);
                } finally {
                  setIsLoading(false);
                }
              }}
            />
          </div>
        ) : isLoading || optionsLoading ? (
          <div className="w-full h-full flex flex-col">
            {/* Show streaming content as it arrives */}
            {localContent && (
              <div className="flex-1 overflow-auto bg-white" ref={contentRef}>
                <div className="relative p-8">
                  <div className="fullscreen-prose prose prose-lg max-w-none">
                    <div className="text-gray-900">
                      <MarkdownRenderer content={localContent} />
                    </div>
                    {/* Add blinking cursor effect when streaming */}
                    <span className="inline-block w-0.5 h-5 bg-blue-600 animate-pulse ml-1 align-text-bottom"></span>
                  </div>
                </div>
              </div>
            )}
            {/* Show loading indicator at the bottom */}
            <div className="flex items-center gap-2 text-gray-700 py-2 border-t border-gray-200 px-8">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">
                {optionsLoading ? 'Loading suggestions...' : (localContent ? 'Generating document...' : 'Loading document...')}
              </span>
              {localContent && (
                <span className="text-xs text-gray-500 ml-2">
                  {charactersReceived} characters generated
                </span>
              )}
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 text-red-500 p-8">
            <AlertCircle className="h-6 w-6" />
            <span className="text-sm text-center">{error}</span>
            {retryCount < 3 && (
              <button
                onClick={() => {
                  setError(null);
                  setRetryCount(prev => prev + 1);
                  setLocalContent('');
                }}
                className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Retry ({3 - retryCount} attempts left)
              </button>
            )}
          </div>
        ) : localContent ? (
          <div className="w-full h-full overflow-auto bg-white" ref={contentRef}>
            <div className="p-8">
              <div className="fullscreen-prose prose prose-lg max-w-none">
                <div className="text-gray-900">
                  <MarkdownRenderer content={localContent} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-gray-700 p-8">
            <div className="text-lg font-semibold text-center">
              No document content.
            </div>
            <button
              onClick={testCreateDocument}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Generate Test Document
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 