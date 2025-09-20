"use client";

import React, { useState, useEffect, useRef } from "react";
import { Table, Loader2, AlertCircle, Play } from "lucide-react";
import { TableNodeData } from '../types';
import { NODE_COLORS } from '../constants';
import { getNodeHeaderStyle, getNodeContentStyle, getStickyNoteStyle } from '../utils';
import { useApiClient } from '@/lib/useApiClient';
import { FullScreenButton } from '../ui/FullScreenButton';
import { ProcessingOptionsModal } from '@/components/ProcessingOptionsModal';
import { logger } from '@/lib/logger';

// Table interfaces for direct integration
interface TableColumn {
  key: string;
  title: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'array';
  width: string;
  sortable: boolean;
  filterable: boolean;
}

interface TableMetadata {
  total_rows: number;
  total_columns: number;
  has_filters: boolean;
  has_sorting: boolean;
  table_type: 'comparison' | 'summary' | 'detailed' | 'analysis' | 'timeline' | 'categorical' | 'other';
}

interface TableData {
  table_title?: string;
  table_description?: string;
  columns?: TableColumn[];
  data?: Record<string, any>[];
  metadata?: TableMetadata;
  error?: string;
}

function renderCellValue(value: any, type: string): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-gray-400 italic">—</span>;
  }

  switch (type) {
    case 'boolean':
      return (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {value ? 'Yes' : 'No'}
        </span>
      );
    
    case 'number':
      return (
        <span className="font-mono text-sm">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
      );
    
    case 'date':
      return (
        <span className="text-sm">
          {new Date(value).toLocaleDateString()}
        </span>
      );
    
    case 'array':
      if (Array.isArray(value)) {
        return (
          <div className="flex flex-wrap gap-1">
            {value.map((item, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
              >
                {String(item)}
              </span>
            ))}
          </div>
        );
      }
      return <span className="text-sm">{String(value)}</span>;
    
    case 'string':
    default:
      return <span className="text-sm">{String(value)}</span>;
  }
}

interface TableNodeContentProps {
  nodeId: string;
  nodeData: TableNodeData;
  selected: boolean;
}

export function TableNodeContent({ nodeId, nodeData, selected }: TableNodeContentProps) {
  const apiClient = useApiClient();

  const [localTableData, setLocalTableData] = useState<TableData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(nodeData.isLoading || false);
  const [error, setError] = useState<string | null>(nodeData.error || null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [charactersReceived, setCharactersReceived] = useState<number>(0);
  const requestInProgressRef = useRef<boolean>(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [optionsPayload, setOptionsPayload] = useState<any | null>(null);
  const selectedOptionRef = useRef<any | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // Auto-scroll to bottom when content updates during streaming
  useEffect(() => {
    if (isLoading && localTableData && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [localTableData, isLoading]);

  // Broadcast table data updates to full screen component
  useEffect(() => {
    const event = new CustomEvent('table-content-update', {
      detail: {
        nodeId: nodeId,
        tableData: localTableData,
        isLoading: isLoading,
        error: error,
        charactersReceived: charactersReceived,
        timestamp: new Date().toISOString()
      }
    });
    window.dispatchEvent(event);
  }, [nodeId, localTableData, isLoading, error, charactersReceived]);

  // Load processing options from database if available (for modal persistence on reload)
  useEffect(() => {
    if (nodeData.processingOptions && !optionsPayload) {
      logger.log('[TableNode] Loading saved processing options from database', {
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
      if (!localTableData && !nodeData.content && nodeData.processingOptions?.options?.length > 0 && !nodeData.selectedProcessingOption) {
        setShowOptionsModal(true);
      }
    }
  }, [nodeData.processingOptions, nodeData.selectedProcessingOption, nodeData.processingOutputType, optionsPayload, nodeId]);

  // Listen for chat-to-table edge creation events
  useEffect(() => {
    const handleUpdateTableNode = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { nodeId: eventNodeId, chatSessionId } = customEvent.detail;
      
      logger.log('[TableNode] EVENT: Received update-table-node event', { 
        eventType: 'update-table-node',
        nodeId: eventNodeId, 
        chatSessionId, 
        currentNodeId: nodeId,
        nodeType: nodeData.type,
        hasExistingChatSession: !!nodeData.chatSessionId,
        timestamp: new Date().toISOString()
      });
      
      if (eventNodeId === nodeId && chatSessionId && !nodeData.chatSessionId) {
        logger.log('[TableNode] EVENT: Processing chat-to-table edge creation', {
          nodeId: nodeId,
          chatSessionId: chatSessionId,
          action: 'dispatching-table-node-chat-session-update',
          timestamp: new Date().toISOString()
        });
        
        // Step 1: fetch processing options and display modal
        (async () => {
          try {
            setOptionsLoading(true);
            const opts = await apiClient.getProcessingOptions(chatSessionId, 'table', undefined, nodeData.artefactId);
            setOptionsPayload(opts);
            setShowOptionsModal(true);
            // Store session for later
            // Preserve any existing selectedOption from database when updating chatSessionId
            selectedOptionRef.current = { 
              chatSessionId,
              selectedOption: selectedOptionRef.current?.selectedOption 
            };
          } catch (e) {
            logger.error('[TableNode] EVENT: Failed to get processing options, falling back to direct generation', e);
            const updateEvent = new CustomEvent('table-node-chat-session-update', {
              detail: { nodeId, chatSessionId },
            });
            window.dispatchEvent(updateEvent);
          } finally {
            setOptionsLoading(false);
          }
        })();
      } else {
        logger.log('[TableNode] EVENT: Ignored update-table-node event', { 
          reason: eventNodeId !== nodeId ? 'wrong-node' : 'already-has-chat-session',
          nodeId: eventNodeId, 
          chatSessionId, 
          currentNodeId: nodeId, 
          hasExistingChatSession: !!nodeData.chatSessionId,
          timestamp: new Date().toISOString()
        });
      }
    };

    window.addEventListener('update-table-node', handleUpdateTableNode);
    return () => {
      window.removeEventListener('update-table-node', handleUpdateTableNode);
    };
  }, [nodeId, nodeData.chatSessionId, nodeData.type]);

  // Load artefact data when artefactId is available
  useEffect(() => {
    if (nodeData.artefactId && !localTableData) {
      const loadArtefact = async () => {
        try {
          setIsLoading(true);
          setError(null);
          logger.log('[TableNode] EVENT: Loading artefact data', {
            nodeId: nodeId,
            artefactId: nodeData.artefactId,
            timestamp: new Date().toISOString()
          });
          const artefact = await apiClient.getArtefact(nodeData.artefactId!) as any;
          logger.log('[TableNode] EVENT: Artefact loaded', {
            nodeId: nodeId,
            artefactId: nodeData.artefactId,
            hasTableData: !!artefact.current_data?.table_json,
            timestamp: new Date().toISOString()
          });
          if (artefact.current_data?.table_json) {
            // Parse the table_json string into a table data object
            try {
              const tableData = JSON.parse(artefact.current_data.table_json);
              setLocalTableData(tableData);
            } catch (parseError) {
              logger.error('[TableNode] EVENT: Failed to parse table JSON', {
                nodeId: nodeId,
                artefactId: nodeData.artefactId,
                error: parseError instanceof Error ? parseError.message : 'Unknown error',
                timestamp: new Date().toISOString()
              });
              setError('Failed to parse saved table data');
            }
          }
        } catch (err) {
          logger.error('[TableNode] EVENT: Failed to load artefact', {
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
  }, [nodeData.artefactId, localTableData, nodeId]);

  // Create table artefact from chat session (only if no existing content)
  useEffect(() => {
    if (nodeData.chatSessionId && !isLoading && !requestInProgressRef.current && !localTableData && !nodeData.content) {
      const createTable = async () => {
        // Set request in progress flag to prevent multiple requests
        requestInProgressRef.current = true;
        
        logger.log('[TableNode] EVENT: Starting table generation', {
          nodeId: nodeId,
          chatSessionId: nodeData.chatSessionId,
          hasArtefactId: !!nodeData.artefactId,
          isLoading,
          timestamp: new Date().toISOString()
        });
        
        // Set up timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
          logger.warn('[TableNode] EVENT: Table generation timeout', {
            nodeId: nodeId,
            chatSessionId: nodeData.chatSessionId,
            timeoutMs: 60000,
            timestamp: new Date().toISOString()
          });
          setError('Table generation timed out. Please try again.');
          setIsLoading(false);
          requestInProgressRef.current = false; // Reset flag on timeout
        }, 60000); // 60 second timeout
        
        try {
          setIsLoading(true);
          setError(null);
          setLocalTableData(null); // Start with empty content for new generation
          setCharactersReceived(0); // Reset character counter
          
          logger.log('[TableNode] EVENT: Making API call to create table artefact', {
            nodeId: nodeId,
            chatSessionId: nodeData.chatSessionId,
            artefactId: nodeData.artefactId || 'none',
            endpoint: '/api/v1/artefacts/table',
            timestamp: new Date().toISOString()
          });
          
          const response = await apiClient.createTableArtefact(nodeData.chatSessionId!, undefined, nodeData.artefactId || undefined);
          
          logger.log('[TableNode] EVENT: Received streaming response', {
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
            let accumulatedJson = "";
            
            logger.log('[TableNode] EVENT: Starting table JSON streaming', {
              nodeId: nodeId,
              chatSessionId: nodeData.chatSessionId,
              timestamp: new Date().toISOString()
            });
            
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  logger.log('[TableNode] EVENT: Streaming completed', {
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
                      logger.log('[TableNode] EVENT: Received completion signal', {
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
                      
                      // Accumulate JSON content
                      accumulatedJson += event.content;
                      
                      // Try to parse the accumulated JSON
                      try {
                        const tableData = JSON.parse(accumulatedJson);
                        setLocalTableData(tableData);
                      } catch (parseError) {
                        // JSON is not complete yet, continue accumulating
                      }
                    } else if (event.type === 'error') {
                      logger.error('[TableNode] EVENT: Received error from server', {
                        nodeId: nodeId,
                        chatSessionId: nodeData.chatSessionId,
                        error: event.error,
                        timestamp: new Date().toISOString()
                      });
                      setError(event.error || 'Error during table generation');
                    }
                  } catch (parseError) {
                    // Ignore JSON parse errors for incomplete lines
                    logger.debug('[TableNode] EVENT: JSON parse error (likely incomplete line)', {
                      nodeId: nodeId,
                      line: line.substring(0, 100),
                      error: parseError instanceof Error ? parseError.message : 'Unknown error'
                    });
                  }
                }
              }
              
            } catch (streamError) {
              logger.error('[TableNode] EVENT: Error during streaming', {
                nodeId: nodeId,
                chatSessionId: nodeData.chatSessionId,
                error: streamError instanceof Error ? streamError.message : 'Unknown error',
                errorType: streamError instanceof TypeError ? 'TypeError' : 'Error',
                timestamp: new Date().toISOString()
              });
              if (streamError instanceof TypeError && streamError.message.includes('network')) {
                setError('Network error during streaming. Please check your connection and try again.');
              } else {
                setError('Error during table generation streaming');
              }
            } finally {
              reader.releaseLock();
            }
          } else {
            throw new Error('No response body for streaming');
          }
        } catch (err) {
          logger.error('[TableNode] EVENT: Error creating table', {
            nodeId: nodeId,
            chatSessionId: nodeData.chatSessionId,
            error: err instanceof Error ? err.message : 'Unknown error',
            timestamp: new Date().toISOString()
          });
          setError(err instanceof Error ? err.message : 'Failed to create table');
        } finally {
          clearTimeout(timeoutId);
          setIsLoading(false);
          requestInProgressRef.current = false; // Reset flag when done
        }
      };
      createTable();
    }
  }, [nodeData.chatSessionId, isLoading, nodeId, nodeData.artefactId]);

  // Listen for table node chat session updates
  useEffect(() => {
    const handleTableNodeChatSessionUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { nodeId: eventNodeId, chatSessionId } = customEvent.detail;
      
      if (eventNodeId === nodeId && chatSessionId) {
        logger.log('[TableNode] EVENT: Received table-node-chat-session-update event', {
          nodeId: nodeId,
          chatSessionId: chatSessionId,
          timestamp: new Date().toISOString()
        });
        
        // This will trigger the table creation effect above
        // The node data will be updated by the parent flow state
      }
    };

    window.addEventListener('table-node-chat-session-update', handleTableNodeChatSessionUpdate);
    return () => {
      window.removeEventListener('table-node-chat-session-update', handleTableNodeChatSessionUpdate);
    };
  }, [nodeId]);

  const renderTableContent = () => {
    if (isLoading || optionsLoading) {
      return (
        <div className="flex-1 flex flex-col p-4">
          {/* Show streaming content as it arrives */}
          {localTableData && (
            <div className="flex-1 overflow-auto" ref={contentRef}>
              <div className="relative">
                {renderTable(localTableData)}
                {/* Add blinking cursor effect when streaming */}
                <div className="mt-2 flex items-center">
                  <span className="inline-block w-0.5 h-5 bg-gray-800 animate-pulse ml-1"></span>
                </div>
              </div>
            </div>
          )}
          {/* Show loading indicator at the bottom */}
            <div className="flex items-center gap-2 py-2 border-t border-green-200">
            <Loader2 className="h-4 w-4 animate-spin text-green-600" />
            <span className="text-sm text-green-700">
              {optionsLoading ? 'Loading suggestions...' : (localTableData ? 'Generating table...' : 'Loading table...')}
            </span>
            {localTableData && (
              <span className="text-xs text-green-600 ml-2">
                {charactersReceived} characters generated
              </span>
            )}
          </div>
        </div>
      );
    } else if (error) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <AlertCircle className="h-6 w-6 text-red-500 mb-2" />
          <span className="text-sm text-center text-red-600">{error}</span>
          {retryCount < 3 && (
            <button
              onClick={() => {
                setError(null);
                setRetryCount(prev => prev + 1);
                setLocalTableData(null);
              }}
              className="mt-2 px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              Retry ({3 - retryCount} attempts left)
            </button>
          )}
        </div>
      );
    } else if (localTableData) {
      return (
        <div className="flex-1 overflow-auto p-4" ref={contentRef}>
          {renderTable(localTableData)}
        </div>
      );
    } else {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="text-center text-green-700">
            <div className="text-lg font-semibold mb-2">
              No table content.
            </div>
          </div>
        </div>
      );
    }
  };

  const renderTable = (tableData: TableData) => {
    if (tableData.error) {
      return (
        <div className="flex items-center justify-center p-4">
          <div className="text-center text-red-600">
            <AlertCircle className="h-6 w-6 mx-auto mb-2" />
            <p className="text-sm">{tableData.error}</p>
          </div>
        </div>
      );
    }

    const { table_title, table_description, columns, data, metadata } = tableData;

    if (!columns || !data) {
      return (
        <div className="flex items-center justify-center p-4">
          <div className="text-center text-gray-500">
            <Table className="h-6 w-6 mx-auto mb-2" />
            <p className="text-sm">No table data available</p>
          </div>
        </div>
      );
    }

    return (
      <div className="w-full">
        {/* Table header with title and description */}
        {(table_title || table_description) && (
          <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
            {table_title && (
              <h3 className="text-lg font-semibold text-green-800 mb-1">{table_title}</h3>
            )}
            {table_description && (
              <p className="text-sm text-green-700">{table_description}</p>
            )}
          </div>
        )}

        {/* Table metadata */}
        {metadata && (
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
              {metadata.total_rows} rows
            </span>
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
              {metadata.total_columns} columns
            </span>
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded capitalize">
              {metadata.table_type}
            </span>
          </div>
        )}

        {/* Main table */}
        <div className="overflow-x-auto border border-green-200 rounded-lg">
          <table className="w-full bg-white">
            <thead className="bg-green-50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className="px-3 py-2 text-left text-xs font-medium text-green-700 uppercase tracking-wider border-b border-green-200"
                    style={{ width: column.width }}
                  >
                    <div className="flex items-center gap-1">
                      {column.title}
                      {column.sortable && (
                        <span className="text-green-500 opacity-50">↕</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-green-100">
              {data.map((row, index) => (
                <tr key={index} className="hover:bg-green-50 transition-colors">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className="px-3 py-2 whitespace-nowrap border-b border-green-100 text-black"
                    >
                      {renderCellValue(row[column.key], column.type)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table footer with row count */}
        <div className="mt-3 text-xs text-green-600">
          Showing {data.length} rows
        </div>
      </div>
    );
  };

  const containerStyle = getStickyNoteStyle('TABLE', selected);

  return (
    <div className={containerStyle.className} style={containerStyle.style}>
      <div className="h-full flex flex-col min-h-0">
        {/* Node header - integrated with table title */}
        <div className="px-3 py-2 border-b border-green-200 bg-green-50 rounded-t-lg flex-shrink-0">
          <div className="text-sm font-medium text-gray-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Table className="h-4 w-4" />
              {nodeData.label}
            </div>
            <FullScreenButton nodeId={nodeId} />
          </div>
          <div className="text-xs text-green-600 font-semibold mt-0.5">Table</div>
        </div>
        
        {/* Table content or inline suggestions */}
        <div className="flex-1 overflow-auto w-full min-h-0">
          {showOptionsModal ? (
            <div className="p-3">
              <ProcessingOptionsModal
                isOpen={true}
                onClose={() => {
                  setShowOptionsModal(false);
                  const removeEvent = new CustomEvent('remove-node', { detail: { nodeId } });
                  window.dispatchEvent(removeEvent);
                }}
                options={optionsPayload?.options || []}
                detectedSubjects={optionsPayload?.detected_subjects}
                outputType={'table'}
                nodeId={nodeId}
                isNodeSelected={selected}
                inline
                onSelect={async (opt) => {
                  setShowOptionsModal(false);
                  try {
                    const chatSessionId = selectedOptionRef.current?.chatSessionId || nodeData.chatSessionId;
                    if (!chatSessionId) {
                      setError('Please connect this table to a chat session by creating an edge from a chat node to this table node');
                      return;
                    }
                    const response = await apiClient.createTableArtefact(chatSessionId, undefined, nodeData.artefactId || undefined, opt);
                    if (!response.body) return;
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    let buffer = '';
                    let accumulatedJson = '';
                    setIsLoading(true);
                    setLocalTableData(null);
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
                            accumulatedJson += event.content;
                            setCharactersReceived(prev => prev + event.content.length);
                            try {
                              const tableData = JSON.parse(accumulatedJson);
                              setLocalTableData(tableData);
                            } catch {}
                          }
                        } catch {
                          accumulatedJson += data;
                        }
                      }
                    }
                  } catch (e) {
                    logger.error('[TableNode] EVENT: Error generating table with selected option', e);
                  } finally {
                    setIsLoading(false);
                  }
                }}
              />
            </div>
          ) : (
            renderTableContent()
          )}
        </div>
      </div>
    </div>
  );
} 