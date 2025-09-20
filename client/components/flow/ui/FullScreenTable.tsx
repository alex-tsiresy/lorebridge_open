"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Table, Loader2, AlertCircle, Play, X } from 'lucide-react';
import { useApiClient } from '@/lib/useApiClient';
import { TableNodeData } from '../types';
import { TableRenderer } from '../../TableRenderer';
import { useFullScreen } from '../context/FullScreenContext';
import { ProcessingOptionsModal } from '@/components/ProcessingOptionsModal';
import { logger } from '@/lib/logger';

interface FullScreenTableProps {
  nodeData: TableNodeData;
  nodeId: string;
}

export function FullScreenTable({ nodeData, nodeId }: FullScreenTableProps) {
  const { setFullScreenNodeId } = useFullScreen();
  const apiClient = useApiClient();
  const [localTableData, setLocalTableData] = useState<any>(null);
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

  const handleClose = () => {
    setFullScreenNodeId(null);
  };

  // Auto-scroll to bottom when content updates during streaming
  useEffect(() => {
    if (isLoading && localTableData && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [localTableData, isLoading]);

  // Load processing options from database if available
  useEffect(() => {
    if (nodeData.processingOptions && !optionsPayload) {
      setOptionsPayload(nodeData.processingOptions);
      if (nodeData.selectedProcessingOption) {
        selectedOptionRef.current = { 
          chatSessionId: null,
          selectedOption: nodeData.selectedProcessingOption 
        };
      }
      if (!localTableData && !nodeData.content && nodeData.processingOptions?.options?.length > 0 && !nodeData.selectedProcessingOption) {
        setShowOptionsModal(true);
      }
    }
  }, [nodeData.processingOptions, nodeData.selectedProcessingOption, optionsPayload, nodeId, localTableData, nodeData.content]);

  // Listen for real-time table data updates from TableNode
  useEffect(() => {
    const handleTableDataUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { nodeId: eventNodeId, tableData, isLoading: nodeIsLoading, error: nodeError, charactersReceived: nodeCharactersReceived } = customEvent.detail;
      
      if (eventNodeId === nodeId) {
        logger.log('[FullScreenTable] Received table data update', {
          nodeId: eventNodeId,
          hasTableData: !!tableData,
          isLoading: nodeIsLoading,
          hasError: !!nodeError,
          charactersReceived: nodeCharactersReceived
        });
        
        setLocalTableData(tableData || null);
        setIsLoading(nodeIsLoading || false);
        setError(nodeError || null);
        setCharactersReceived(nodeCharactersReceived || 0);
      }
    };

    window.addEventListener('table-content-update', handleTableDataUpdate);
    return () => {
      window.removeEventListener('table-content-update', handleTableDataUpdate);
    };
  }, [nodeId]);

  // Listen for chat-to-table edge creation events
  useEffect(() => {
    const handleUpdateTableNode = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { nodeId: eventNodeId, chatSessionId } = customEvent.detail;
      
      if (eventNodeId === nodeId && chatSessionId && !nodeData.chatSessionId) {
        // Update the node data with chatSessionId to trigger streaming
        const updateEvent = new CustomEvent('table-node-chat-session-update', {
          detail: {
            nodeId: nodeId,
            chatSessionId: chatSessionId,
          },
        });
        window.dispatchEvent(updateEvent);
      }
    };

    window.addEventListener('update-table-node', handleUpdateTableNode);
    return () => {
      window.removeEventListener('update-table-node', handleUpdateTableNode);
    };
  }, [nodeId, nodeData.chatSessionId]);

  // Load artefact data when artefactId is available
  useEffect(() => {
    if (nodeData.artefactId && !localTableData) {
      const loadArtefact = async () => {
        try {
          setIsLoading(true);
          setError(null);
          
          const artefactData = await apiClient.getArtefact(nodeData.artefactId!) as any;
          if (artefactData.current_data?.table_json) {
            try {
              const tableData = JSON.parse(artefactData.current_data.table_json);
              setLocalTableData(tableData);
            } catch (parseError) {
              logger.error('Error parsing table JSON:', parseError);
              setError('Failed to parse table data');
            }
          }
        } catch (err) {
          logger.error('Error loading artefact:', err);
          setError('Failed to load artefact content');
        } finally {
          setIsLoading(false);
        }
      };
      
      loadArtefact();
    }
  }, [nodeData.artefactId, localTableData, apiClient]);

  // Listen for table node chat session updates
  useEffect(() => {
    const handleTableNodeChatSessionUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { nodeId: eventNodeId, chatSessionId } = customEvent.detail;
      
      if (eventNodeId === nodeId && chatSessionId) {
        createTable(chatSessionId);
      }
    };

    window.addEventListener('table-node-chat-session-update', handleTableNodeChatSessionUpdate);
    return () => {
      window.removeEventListener('table-node-chat-session-update', handleTableNodeChatSessionUpdate);
    };
  }, [nodeId]);

  const createTable = async (chatSessionId: string) => {
    if (requestInProgressRef.current) return;
    
    try {
      requestInProgressRef.current = true;
      setIsLoading(true);
      setError(null);
      setLocalTableData(null);
      setCharactersReceived(0);
      
      logger.log('[FullScreenTable] Starting table creation', {
        nodeId: nodeId,
        chatSessionId: chatSessionId,
        timestamp: new Date().toISOString()
      });

      const response = await apiClient.createTableArtefact(chatSessionId);
      
      if (response.ok) {
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body reader available');
        }

        const decoder = new TextDecoder();
        let accumulatedJson = '';

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            logger.log('[FullScreenTable] Stream completed', {
              nodeId: nodeId,
              finalContentLength: accumulatedJson.length,
              timestamp: new Date().toISOString()
            });
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          accumulatedJson += chunk;
          
          // Try to parse the accumulated JSON and update the table data
          try {
            const tableData = JSON.parse(accumulatedJson);
            setLocalTableData(tableData);
            setCharactersReceived(accumulatedJson.length);
          } catch (parseError) {
            // Ignore parse errors during streaming - JSON might be incomplete
            logger.debug('[FullScreenTable] JSON parse error during streaming (expected)', {
              nodeId: nodeId,
              accumulatedLength: accumulatedJson.length,
              error: parseError instanceof Error ? parseError.message : 'Unknown error'
            });
          }
        }
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (err) {
      logger.error('[FullScreenTable] Error creating table:', err);
      setError(err instanceof Error ? err.message : 'Failed to create table');
    } finally {
      setIsLoading(false);
      requestInProgressRef.current = false;
    }
  };

  const testCreateTable = async () => {
    if (requestInProgressRef.current) return;
    
    try {
      setIsLoading(true);
      setError(null);
      setLocalTableData(null);
      setCharactersReceived(0);
      
      logger.log('[FullScreenTable] Starting test table creation', {
        nodeId: nodeId,
        timestamp: new Date().toISOString()
      });

      const response = await apiClient.createTestTableArtefact();
      
      if (response.ok) {
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body reader available');
        }

        const decoder = new TextDecoder();
        let accumulatedJson = '';

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            logger.log('[FullScreenTable] Test stream completed', {
              nodeId: nodeId,
              finalContentLength: accumulatedJson.length,
              timestamp: new Date().toISOString()
            });
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          accumulatedJson += chunk;
          
          // Try to parse the accumulated JSON and update the table data
          try {
            const tableData = JSON.parse(accumulatedJson);
            setLocalTableData(tableData);
            setCharactersReceived(accumulatedJson.length);
          } catch (parseError) {
            // Ignore parse errors during streaming - JSON might be incomplete
            logger.debug('[FullScreenTable] Test JSON parse error during streaming (expected)', {
              nodeId: nodeId,
              accumulatedLength: accumulatedJson.length,
              error: parseError instanceof Error ? parseError.message : 'Unknown error'
            });
          }
        }
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (err) {
      logger.error('[FullScreenTable] Error creating test table:', err);
      setError(err instanceof Error ? err.message : 'Failed to create test table');
    } finally {
      setIsLoading(false);
      requestInProgressRef.current = false;
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-green-50">
        <div className="text-lg font-medium text-gray-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Table className="h-5 w-5" />
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
        <div className="text-sm text-green-600 font-semibold mt-1">Table</div>
        {/* Test button for creating table from chat session */}
        {!nodeData.chatSessionId && !isLoading && (
          <button
            onClick={testCreateTable}
            className="mt-2 px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Test Generate Table
          </button>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        {showOptionsModal ? (
          <ProcessingOptionsModal
            isOpen={true}
            onClose={() => {
              setShowOptionsModal(false);
              handleClose();
            }}
            options={optionsPayload?.options || []}
            detectedSubjects={optionsPayload?.detected_subjects}
            outputType={'table'}
            nodeId={nodeId}
            isNodeSelected={true}
            inline
            onSelect={async (opt) => {
              setShowOptionsModal(false);
              logger.log('Table option selected:', opt);
            }}
          />
        ) : isLoading || optionsLoading ? (
          <div className="w-full h-full flex flex-col">
            {/* Show streaming content as it arrives */}
            {localTableData && (
              <div className="flex-1 overflow-auto" ref={contentRef}>
                <TableRenderer tableData={localTableData} isLoading={false} />
              </div>
            )}
            {/* Show loading indicator at the bottom */}
            <div className="flex items-center gap-2 text-gray-700 py-2 border-t border-gray-200">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">
                {optionsLoading ? 'Loading suggestions...' : (localTableData ? 'Generating table...' : 'Loading table...')}
              </span>
              {localTableData && (
                <span className="text-xs text-gray-500 ml-2">
                  {charactersReceived} characters generated
                </span>
              )}
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 text-red-500">
            <AlertCircle className="h-6 w-6" />
            <span className="text-sm text-center">{error}</span>
            {retryCount < 3 && (
              <button
                onClick={() => {
                  setError(null);
                  setRetryCount(prev => prev + 1);
                  setLocalTableData(null);
                }}
                className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
              >
                Retry ({3 - retryCount} attempts left)
              </button>
            )}
          </div>
        ) : localTableData ? (
          <div className="w-full h-full overflow-auto" ref={contentRef}>
            <TableRenderer tableData={localTableData} isLoading={false} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-gray-700">
            <div className="text-lg font-semibold text-center">
              No table content.
            </div>
            <button
              onClick={testCreateTable}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Generate Test Table
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 