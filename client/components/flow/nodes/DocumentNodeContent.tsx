"use client";

import React, { useState, useEffect, useRef } from "react";
import { FileText, Loader2, AlertCircle, Play } from "lucide-react";
import { DocumentNodeData } from '../types';
import { NODE_COLORS } from '../constants';
import { getNodeHeaderStyle, getNodeContentStyle, getStickyNoteStyle } from '../utils';
import MarkdownRenderer from '../../MarkdownRenderer';
import { useApiClient } from '@/lib/useApiClient';
import { FullScreenButton } from '../ui/FullScreenButton';
import { ProcessingOptionsModal } from '@/components/ProcessingOptionsModal';
import { logger } from '@/lib/logger';

interface DocumentNodeContentProps {
  nodeId: string;
  nodeData: DocumentNodeData;
  selected: boolean;
}

export function DocumentNodeContent({ nodeId, nodeData, selected }: DocumentNodeContentProps) {
  const apiClient = useApiClient();
  const [localContent, setLocalContent] = useState<string>(nodeData.content || '');
  const [isLoading, setIsLoading] = useState<boolean>(nodeData.isLoading || false);
  const [error, setError] = useState<string | null>(nodeData.error || null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [charactersReceived, setCharactersReceived] = useState<number>(0);
  const requestInProgressRef = useRef<boolean>(false); // Track if request is in progress
  const contentRef = useRef<HTMLDivElement>(null); // Ref for auto-scrolling
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [optionsPayload, setOptionsPayload] = useState<any | null>(null);
  const selectedOptionRef = useRef<any | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // Auto-scroll to bottom when content updates during streaming
  useEffect(() => {
    if (isLoading && localContent && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [localContent, isLoading]);

  // Broadcast content updates to full screen component
  useEffect(() => {
    const event = new CustomEvent('document-content-update', {
      detail: {
        nodeId: nodeId,
        content: localContent,
        isLoading: isLoading,
        error: error,
        charactersReceived: charactersReceived,
        timestamp: new Date().toISOString()
      }
    });
    window.dispatchEvent(event);
  }, [nodeId, localContent, isLoading, error, charactersReceived]);

  // Load processing options from database if available (for modal persistence on reload)
  useEffect(() => {
    if (nodeData.processingOptions && !optionsPayload) {
      logger.log('[DocumentNode] Loading saved processing options from database', {
        nodeId,
        processingOptions: nodeData.processingOptions,
        selectedOption: nodeData.selectedProcessingOption,
        outputType: nodeData.processingOutputType,
      });
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
  }, [nodeData.processingOptions, nodeData.selectedProcessingOption, nodeData.processingOutputType, optionsPayload, nodeId]);

  // Listen for chat-to-document edge creation events
  useEffect(() => {
    const handleUpdateDocumentNode = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { nodeId: eventNodeId, chatSessionId } = customEvent.detail;
      
      // Document node event logging removed for security
      
      if (eventNodeId === nodeId && chatSessionId && !nodeData.chatSessionId) {
        // Chat-to-document edge creation logging removed for security
        
        // Step 1: fetch processing options and display modal
        (async () => {
          try {
            setOptionsLoading(true);
            const opts = await apiClient.getProcessingOptions(chatSessionId, 'markdown', undefined, nodeData.artefactId);
            setOptionsPayload(opts);
            setShowOptionsModal(true);
            // Preserve any existing selectedOption from database when updating chatSessionId
            selectedOptionRef.current = { 
              chatSessionId,
              selectedOption: selectedOptionRef.current?.selectedOption 
            };
          } catch (e) {
            logger.error('[DocumentNode] EVENT: Failed to get processing options, falling back to direct generation', e);
            const updateEvent = new CustomEvent('document-node-chat-session-update', { detail: { nodeId, chatSessionId } });
            window.dispatchEvent(updateEvent);
          } finally {
            setOptionsLoading(false);
          }
        })();
      } else {
        logger.log('[DocumentNode] EVENT: Ignored update-document-node event', { 
          reason: eventNodeId !== nodeId ? 'wrong-node' : 'already-has-chat-session',
          nodeId: eventNodeId, 
          chatSessionId, 
          currentNodeId: nodeId, 
          hasExistingChatSession: !!nodeData.chatSessionId,
          timestamp: new Date().toISOString()
        });
      }
    };

    logger.log('[DocumentNode] EVENT: Setting up event listener', {
      nodeId: nodeId,
      eventType: 'update-document-node',
      timestamp: new Date().toISOString()
    });
    window.addEventListener('update-document-node', handleUpdateDocumentNode);
    return () => {
      logger.log('[DocumentNode] EVENT: Removing event listener', {
        nodeId: nodeId,
        eventType: 'update-document-node',
        timestamp: new Date().toISOString()
      });
      window.removeEventListener('update-document-node', handleUpdateDocumentNode);
    };
  }, [nodeId]); // Removed nodeData.chatSessionId from dependencies to prevent event listener recreation

  // Load artefact data when artefactId is available
  useEffect(() => {
    if (nodeData.artefactId && !localContent) {
      const loadArtefact = async () => {
        try {
          setIsLoading(true);
          setError(null);
          logger.log('[DocumentNode] EVENT: Loading artefact data', {
            nodeId: nodeId,
            artefactId: nodeData.artefactId,
            timestamp: new Date().toISOString()
          });
          const artefact = await apiClient.getArtefact(nodeData.artefactId!) as any;
          logger.log('[DocumentNode] EVENT: Artefact loaded', {
            nodeId: nodeId,
            artefactId: nodeData.artefactId,
            hasMarkdown: !!artefact.current_data?.markdown,
            markdownLength: artefact.current_data?.markdown?.length || 0,
            timestamp: new Date().toISOString()
          });
          if (artefact.current_data?.markdown) {
            setLocalContent(artefact.current_data.markdown);
          }
        } catch (err) {
          logger.error('[DocumentNode] EVENT: Failed to load artefact', {
            nodeId: nodeId,
            artefactId: nodeData.artefactId,
            error: err instanceof Error ? err.message : 'Unknown error',
            timestamp: new Date().toISOString()
          });
          setError(err instanceof Error ? err.message : 'Failed to load artefact');
        } finally {
          setIsLoading(false);
        }
      };
      loadArtefact();
    }
  }, [nodeData.artefactId, localContent, nodeId]); // Removed apiClient from dependencies

  // Create document artefact from chat session (only if no existing content)
  useEffect(() => {
    if (nodeData.chatSessionId && !isLoading && !requestInProgressRef.current && !localContent && !nodeData.content) {
      const createDocument = async () => {
        // Set request in progress flag to prevent multiple requests
        requestInProgressRef.current = true;
        
        logger.log('[DocumentNode] EVENT: Starting document generation', {
          nodeId: nodeId,
          chatSessionId: nodeData.chatSessionId,
          hasArtefactId: !!nodeData.artefactId,
          isLoading,
          timestamp: new Date().toISOString()
        });
        
        // Set up timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          logger.warn('[DocumentNode] EVENT: Document generation timeout', {
            nodeId: nodeId,
            chatSessionId: nodeData.chatSessionId,
            timeoutMs: 60000,
            timestamp: new Date().toISOString()
          });
          setError('Document generation timed out. Please try again.');
          setIsLoading(false);
          requestInProgressRef.current = false; // Reset flag on timeout
        }, 60000); // 60 second timeout
        
        try {
          setIsLoading(true);
          setError(null);
          setLocalContent(''); // Start with empty content for new generation
          setCharactersReceived(0); // Reset character counter
          
          logger.log('[DocumentNode] EVENT: Making API call to create document artefact', {
            nodeId: nodeId,
            chatSessionId: nodeData.chatSessionId,
            artefactId: nodeData.artefactId || 'none',
            endpoint: '/api/v1/artefacts/document',
            timestamp: new Date().toISOString()
          });
          
          const response = await apiClient.createDocumentArtefact(nodeData.chatSessionId!, undefined, nodeData.artefactId || undefined);
          
          logger.log('[DocumentNode] EVENT: Received streaming response', {
            nodeId: nodeId,
            chatSessionId: nodeData.chatSessionId,
            hasResponseBody: !!response.body,
            responseStatus: response.status,
            responseHeaders: Object.fromEntries(response.headers.entries()),
            timestamp: new Date().toISOString()
          });
          
          // Handle streaming response
          if (response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let chunkCount = 0;
            let totalChars = 0;
            let buffer = "";
            
            logger.log('[DocumentNode] EVENT: Starting markdown streaming', {
              nodeId: nodeId,
              chatSessionId: nodeData.chatSessionId,
              timestamp: new Date().toISOString()
            });
            
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  logger.log('[DocumentNode] EVENT: Streaming completed', {
                    nodeId: nodeId,
                    chatSessionId: nodeData.chatSessionId,
                    totalChunks: chunkCount,
                    totalChars,
                    timestamp: new Date().toISOString()
                  });
                  break;
                }
                
                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                
                // Split on newlines to handle multiple JSON events in one chunk
                let lines = buffer.split(/\r?\n/);
                buffer = lines.pop() || ""; // Keep incomplete line in buffer
                
                for (const line of lines) {
                  if (!line.trim() || !line.startsWith('data: ')) continue;
                  
                  try {
                    const data = line.slice(6); // Remove 'data: ' prefix
                    
                    if (data === '[DONE]') {
                      logger.log('[DocumentNode] EVENT: Received completion signal', {
                        nodeId: nodeId,
                        chatSessionId: nodeData.chatSessionId,
                        timestamp: new Date().toISOString()
                      });
                      continue;
                    }
                    
                    const event = JSON.parse(data);
                    
                    if (event.type === 'token' && event.content) {
                      chunkCount++;
                      totalChars += event.content.length;
                      
                      // Update character count immediately for real-time progress
                      setCharactersReceived(prev => prev + event.content.length);
                      
                      // Append new chunk to existing content
                      setLocalContent(prevContent => {
                        const newContent = prevContent + event.content;
                        return newContent;
                      });
                    } else if (event.type === 'error') {
                      logger.error('[DocumentNode] EVENT: Received error from server', {
                        nodeId: nodeId,
                        chatSessionId: nodeData.chatSessionId,
                        error: event.error,
                        timestamp: new Date().toISOString()
                      });
                      setError(event.error || 'Error during document generation');
                    }
                  } catch (parseError) {
                    // Ignore JSON parse errors for incomplete lines
                    logger.debug('[DocumentNode] EVENT: JSON parse error (likely incomplete line)', {
                      nodeId: nodeId,
                      line: line.substring(0, 100),
                      error: parseError instanceof Error ? parseError.message : 'Unknown error'
                    });
                  }
                }
              }
              
            } catch (streamError) {
              logger.error('[DocumentNode] EVENT: Error during streaming', {
                nodeId: nodeId,
                chatSessionId: nodeData.chatSessionId,
                error: streamError instanceof Error ? streamError.message : 'Unknown error',
                errorType: streamError instanceof TypeError ? 'TypeError' : 'Error',
                timestamp: new Date().toISOString()
              });
              if (streamError instanceof TypeError && streamError.message.includes('network')) {
                setError('Network error during streaming. Please check your connection and try again.');
              } else {
                setError('Error during document generation streaming');
              }
            } finally {
              reader.releaseLock();
            }
          } else {
            throw new Error('No response body for streaming');
          }
        } catch (err) {
          logger.error('[DocumentNode] EVENT: Error creating document', {
            nodeId: nodeId,
            chatSessionId: nodeData.chatSessionId,
            error: err instanceof Error ? err.message : 'Unknown error',
            timestamp: new Date().toISOString()
          });
          setError(err instanceof Error ? err.message : 'Failed to create document');
        } finally {
          clearTimeout(timeoutId);
          setIsLoading(false);
          requestInProgressRef.current = false; // Reset flag when done
        }
      };
      createDocument();
    }
  }, [nodeData.chatSessionId, nodeData.artefactId]); // Removed apiClient from dependencies to prevent multiple requests

  const headerStyle = getNodeHeaderStyle('DOCUMENT');
  const contentStyle = getNodeContentStyle('DOCUMENT');
  const containerStyle = getStickyNoteStyle('DOCUMENT', selected);

  return (
    <div className={containerStyle.className} style={containerStyle.style}>
      <div className="h-full flex flex-col relative z-10">
        <div className={headerStyle.className} style={headerStyle.style}>
          <div className="text-sm font-semibold flex items-center justify-between" style={{ color: NODE_COLORS.DOCUMENT.textColor }}>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {nodeData.label}
            </div>
            <FullScreenButton nodeId={nodeId} />
          </div>
          <div className="text-xs font-semibold mt-0.5" style={{ color: NODE_COLORS.DOCUMENT.textColor, opacity: 0.8 }}>Document</div>
        </div>
        <div className="flex-1 overflow-auto w-full p-4 min-h-0" style={contentStyle.style}>
          {showOptionsModal ? (
            <div className="w-full">
              <ProcessingOptionsModal
                isOpen={true}
                onClose={() => {
                  setShowOptionsModal(false);
                  const removeEvent = new CustomEvent('remove-node', { detail: { nodeId } });
                  window.dispatchEvent(removeEvent);
                }}
                options={optionsPayload?.options || []}
                detectedSubjects={optionsPayload?.detected_subjects}
                outputType={'markdown'}
                nodeId={nodeId}
                isNodeSelected={selected}
                inline
                onSelect={async (opt) => {
                  setShowOptionsModal(false);
                  try {
                    const chatSessionId = selectedOptionRef.current?.chatSessionId || nodeData.chatSessionId;
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
                    logger.error('[DocumentNode] EVENT: Error generating markdown with selected option', e);
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
                <div className="flex-1 overflow-auto" ref={contentRef}>
                  <div className="relative">
                    <MarkdownRenderer content={localContent} />
                    {/* Add blinking cursor effect when streaming */}
                    <span className="inline-block w-0.5 h-5 bg-gray-800 animate-pulse ml-1 align-text-bottom"></span>
                  </div>
                </div>
              )}
              {/* Show loading indicator at the bottom */}
              <div className="flex items-center gap-2 py-2 border-t" style={{ color: NODE_COLORS.DOCUMENT.textColor, borderColor: NODE_COLORS.DOCUMENT.border, opacity: 0.7 }}>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">
                  {optionsLoading ? 'Loading suggestions...' : (localContent ? 'Generating document...' : 'Loading document...')}
                </span>
                {localContent && (
                  <span className="text-xs ml-2" style={{ opacity: 0.6 }}>
                    {charactersReceived} characters generated
                  </span>
                )}
              </div>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-2" style={{ color: '#dc2626' }}>
              <AlertCircle className="h-6 w-6" />
              <span className="text-sm text-center">{error}</span>
              {retryCount < 3 && (
                <button
                  onClick={() => {
                    setError(null);
                    setRetryCount(prev => prev + 1);
                    setLocalContent('');
                  }}
                  className="px-3 py-1 text-xs text-white rounded hover:opacity-80 transition-all"
                  style={{ backgroundColor: NODE_COLORS.DOCUMENT.border }}
                >
                  Retry ({3 - retryCount} attempts left)
                </button>
              )}
            </div>
          ) : localContent ? (
            <div className="w-full h-full overflow-auto" ref={contentRef}>
              <MarkdownRenderer content={localContent} />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4" style={{ color: NODE_COLORS.DOCUMENT.textColor, opacity: 0.7 }}>
              <div className="text-lg font-semibold text-center">
                No document content.
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Inline options rendered above when open */}
    </div>
  );
} 