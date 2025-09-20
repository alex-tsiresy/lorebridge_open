"use client";

import { useState, useCallback, useMemo } from "react";
import { useEdgesState, addEdge, Edge } from '@xyflow/react';
import { Connection, EdgeType, FlowEdgeData, EdgeOperationResult } from '../types';
import { createStandardValidator } from '../validation';
import { createEdgeByType } from '../factories';
import { createCustomEdge } from '../factories';
import { updateEdgesSelection, filterEdgesByType, getEdgeStats, removeOrphanedEdges } from '../utils';
import { EDGE_CONFIGS } from '../constants';
import { useApiClient } from '@/lib/useApiClient';
import { logger } from '@/lib/logger';

// Utility: Simple UUID validator (matches canonical 8-4-4-4-12 hex format)
const isUUID = (id: string): boolean => {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
};

// Simple notification function
const showNotification = (title: string, description: string, type: 'error' | 'success' = 'error') => {
  const event = new CustomEvent('show-notification', {
    detail: { title, description, type }
  });
  window.dispatchEvent(event);
};

interface UseEdgeManagerProps {
  initialEdges?: Edge[];
  defaultEdgeType?: EdgeType;
  maxConnectionsPerHandle?: number;
}

export function useEdgeManager({
  initialEdges = [],
  defaultEdgeType = 'default',
  maxConnectionsPerHandle = 10
}: UseEdgeManagerProps = {}, nodesParam?: import('@xyflow/react').Node[], graphId?: string) {
  // Core edge state
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedEdges, setSelectedEdges] = useState<Edge[]>([]);
  const [activeEdgeType, setActiveEdgeType] = useState<EdgeType>(defaultEdgeType);

  const apiClient = useApiClient();

  // Edge validator
  const validator = useMemo(() => 
    createStandardValidator(edges), 
    [edges]
  );

    // Edge selection management
  const onEdgeSelectionChange = useCallback((selectedEdgeIds: string[]) => {
    // Update selected edges immediately
    setSelectedEdges(currentSelectedEdges => {
      // Only update if selection actually changed
      const currentSelectedIds = currentSelectedEdges.map(edge => edge.id).sort();
      const newSelectedIds = selectedEdgeIds.sort();
      
      if (JSON.stringify(currentSelectedIds) === JSON.stringify(newSelectedIds)) {
        return currentSelectedEdges; // No change, return same reference
      }
      
      // Get the new selected edges from current edges
      const newSelectedEdges = edges.filter(edge => selectedEdgeIds.includes(edge.id));
      return newSelectedEdges;
    });
    
    // Update edge visual state with timeout to avoid circular dependency
    setTimeout(() => {
      setEdges(currentEdges => updateEdgesSelection(currentEdges, selectedEdgeIds));
    }, 0);
  }, [edges, setEdges]);

  // Edge validation
  const isValidConnection = useCallback((connection: Edge | Connection): boolean => {
    const validationContext = {
      existingEdges: edges,
      maxConnectionsPerHandle,
      nodes: nodesParam, // Pass the nodes array for category validation
    };
    
    return validator.isValid(connection, validationContext);
  }, [validator, maxConnectionsPerHandle, edges, nodesParam]);

  // Create edge with validation and backend sync
  const createEdge = useCallback((
    connection: Connection,
    edgeType: EdgeType = activeEdgeType,
    options?: unknown
  ): EdgeOperationResult => {
    logger.log('[EdgeManager] EVENT: createEdge called', { 
      connection, 
      edgeType, 
      graphId,
      sourceNode: connection.source,
      targetNode: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      timestamp: new Date().toISOString()
    });
    
    // Validate connection first
    if (!isValidConnection(connection)) {
      logger.log('[EdgeManager] EVENT: Edge validation failed', {
        connection,
        reason: 'invalid-connection',
        timestamp: new Date().toISOString()
      });
      return {
        success: false,
        message: 'Invalid connection',
      };
    }

    // Create edge using the user-selected type
    let result: EdgeOperationResult;
    if (edgeType === 'custom') {
      result = createCustomEdge(connection, options as Record<string, unknown>);
    } else {
      result = createEdgeByType(edgeType, connection);
    }

    if (result.success && result.edge) {
      logger.log('[EdgeManager] EVENT: Local edge created successfully', {
        edgeId: result.edge.id,
        edgeType: result.edge.type,
        source: result.edge.source,
        target: result.edge.target,
        timestamp: new Date().toISOString()
      });
      
      // If graphId is present, create edge in backend
      if (graphId) {
        const backendEdgeData = {
          source_node_id: connection.source,
          target_node_id: connection.target,
          type: 'DERIVED_FROM' as const, // Only supported type for now
          source_handle: connection.sourceHandle || null,
          target_handle: connection.targetHandle || null,
        };
        logger.log('[EdgeManager] EVENT: Making backend API call to create edge', {
          graphId,
          backendEdgeData,
          endpoint: `/api/v1/graphs/${graphId}/edges`,
          timestamp: new Date().toISOString()
        });
        
        apiClient.createEdge(graphId, backendEdgeData)
          .then((backendEdge: {
            id: string;
            source_node_id: string;
            target_node_id: string;
            target_handle?: string | null;
            context_messages?: Array<{
              chat_session_id: string;
              role: string;
              content: string;
            }>;
            context_message?: {
              chat_session_id: string;
              role: string;
              content: string;
            };
            chat_session_id?: string;
            error?: string;
          }) => {
            logger.log('[EdgeManager] EVENT: Backend edge created successfully', {
              edgeId: backendEdge.id,
              sourceNode: backendEdge.source_node_id,
              targetNode: backendEdge.target_node_id,
              contextMessageCount: backendEdge.context_messages?.length || 0,
              hasError: !!backendEdge.error,
              error: backendEdge.error,
              timestamp: new Date().toISOString()
            });

            // Handle context transfer error
            if (backendEdge.error) {
              logger.warn('[EdgeManager] EVENT: Context transfer failed', {
                error: backendEdge.error,
                edgeId: backendEdge.id,
                timestamp: new Date().toISOString()
              });
              
              // Show error notification to user
              showNotification(
                'Context Transfer Failed',
                backendEdge.error === 'Circular transfer prevented' 
                  ? 'Cannot transfer context between chats that already share context. This prevents circular references.'
                  : backendEdge.error,
                'error'
              );
              
              // Still add the edge to the flow, but show error to user
              setEdges(currentEdges => 
                currentEdges.map(e => 
                  e.id === result.edge!.id 
                    ? { ...e, targetHandle: backendEdge.target_handle } : e
                )
              );
              
              return;
            }

            // Update edge visual state immediately (no delay)
            setEdges(currentEdges => 
              currentEdges.map(e => 
                e.id === result.edge!.id 
                  ? { ...e, targetHandle: backendEdge.target_handle } : e
              )
            );

            // NEW: Dispatch event(s) for any context messages that were created
            if (Array.isArray(backendEdge.context_messages) && backendEdge.context_messages.length > 0) {
              logger.log('[EdgeManager] EVENT: Dispatching context message events', {
                contextMessageCount: backendEdge.context_messages.length,
                timestamp: new Date().toISOString()
              });
              
              backendEdge.context_messages.forEach((msg, index: number) => {
                logger.log('[EdgeManager] EVENT: Dispatching new-context-message event', {
                  messageIndex: index,
                  sessionId: msg.chat_session_id,
                  messageRole: msg.role,
                  messageContentLength: msg.content?.length || 0,
                  timestamp: new Date().toISOString()
                });
                
                const event = new CustomEvent('new-context-message', {
                  detail: {
                    sessionId: msg.chat_session_id,
                    message: msg,
                  },
                });
                window.dispatchEvent(event);
              });
            } else if (backendEdge.context_message) { // Fallback for older API shape
              logger.log('[EdgeManager] EVENT: Dispatching single context message event (fallback)', {
                sessionId: backendEdge.context_message.chat_session_id,
                messageRole: backendEdge.context_message.role,
                timestamp: new Date().toISOString()
              });
              
              const event = new CustomEvent('new-context-message', {
                detail: {
                  sessionId: backendEdge.context_message.chat_session_id,
                  message: backendEdge.context_message,
                },
              });
              window.dispatchEvent(event);
            }

            // NEW: Handle chat-to-document/table edge creation
            if (backendEdge.chat_session_id) {
              // Get the target node to determine if it's a document or table node
              const targetNode = nodesParam?.find(node => node.id === connection.target);
              const nodeType = targetNode?.data?.type;
              
              logger.log('[EdgeManager] EVENT: Processing chat-to-artefact edge creation', {
                chatSessionId: backendEdge.chat_session_id,
                targetNodeId: connection.target,
                targetNodeType: nodeType,
                action: 'dispatching-update-artefact-node-event',
                timestamp: new Date().toISOString()
              });
              
              if (nodeType === 'document') {
                // Dispatch event to update DocumentNode with chatSessionId
                const event = new CustomEvent('update-document-node', {
                  detail: {
                    nodeId: connection.target,
                    chatSessionId: backendEdge.chat_session_id,
                  },
                });
                window.dispatchEvent(event);
                logger.log('[EdgeManager] EVENT: Dispatched update-document-node event', {
                  nodeId: connection.target,
                  chatSessionId: backendEdge.chat_session_id,
                  timestamp: new Date().toISOString()
                });
              } else if (nodeType === 'table') {
                // Dispatch event to update TableNode with chatSessionId
                const event = new CustomEvent('update-table-node', {
                  detail: {
                    nodeId: connection.target,
                    chatSessionId: backendEdge.chat_session_id,
                  },
                });
                window.dispatchEvent(event);
                logger.log('[EdgeManager] EVENT: Dispatched update-table-node event', {
                  nodeId: connection.target,
                  chatSessionId: backendEdge.chat_session_id,
                  timestamp: new Date().toISOString()
                });
              } else if (nodeType === 'graph') {
                // Dispatch event to update GraphNode with chatSessionId
                const event = new CustomEvent('update-graph-node', {
                  detail: {
                    nodeId: connection.target,
                    chatSessionId: backendEdge.chat_session_id,
                  },
                });
                window.dispatchEvent(event);
                logger.log('[EdgeManager] EVENT: Dispatched update-graph-node event', {
                  nodeId: connection.target,
                  chatSessionId: backendEdge.chat_session_id,
                  timestamp: new Date().toISOString()
                });
              } else {
                logger.log('[EdgeManager] EVENT: Unknown artefact node type', {
                  targetNodeId: connection.target,
                  nodeType: nodeType,
                  timestamp: new Date().toISOString()
                });
              }
            } else {
              logger.log('[EdgeManager] EVENT: No chat_session_id in response, not a chat-to-artefact edge', {
                targetNodeId: connection.target,
                timestamp: new Date().toISOString()
              });
            }
          })
          .catch(err => {
            logger.error('[EdgeManager] EVENT: Failed to create edge in backend', {
              error: err instanceof Error ? err.message : 'Unknown error',
              graphId,
              backendEdgeData,
              timestamp: new Date().toISOString()
            });
          });
      } else {
        logger.log('[EdgeManager] EVENT: No graphId provided, skipping backend sync', {
          timestamp: new Date().toISOString()
        });
      }
      setEdges(currentEdges => addEdge(result.edge!, currentEdges));
    } else {
      logger.log('[EdgeManager] EVENT: Local edge creation failed', {
        success: result.success,
        message: result.message,
        timestamp: new Date().toISOString()
      });
    }

    return result;
  }, [activeEdgeType, isValidConnection, setEdges, graphId, apiClient, nodesParam]);

  // Connect nodes (React Flow onConnect handler)
  const onConnect = useCallback((connection: Connection) => {
    const result = createEdge(connection, activeEdgeType, undefined);
    
    if (!result.success) {
      logger.warn('Connection failed:', result.message);
    }
    
    return result;
  }, [createEdge, activeEdgeType]);

  // Edge type management
  const changeEdgeType = useCallback((edgeId: string, newType: EdgeType): boolean => {
    const edge = edges.find(e => e.id === edgeId);
    if (!edge) return false;

    // Update backend (fire and forget)
    (async () => {
      if (isUUID(edgeId) && graphId) {
        try {
          await apiClient.updateEdge(graphId, edgeId, { type: newType });
        } catch (err) {
          logger.error('[EdgeManager] EVENT: Failed to update edge type in backend', {
            edgeId,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }
    })();

    // Create new connection with new type
    const connection: Connection = {
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || null,
      targetHandle: edge.targetHandle || null,
    };

    // Remove old edge and create new one
    setEdges(currentEdges => {
      const filtered = currentEdges.filter(e => e.id !== edgeId);
      const result = createEdgeByType(newType, connection);
      if (result.success && result.edge) {
        return addEdge(result.edge, filtered);
      }
      return currentEdges; // Revert if failed
    });

    return true;
  }, [edges, setEdges, apiClient, graphId]);

  // Edge data management
  const updateEdgeData = useCallback((
    edgeId: string,
    dataUpdate: Partial<FlowEdgeData>
  ): boolean => {
    setEdges(currentEdges =>
      currentEdges.map(edge =>
        edge.id === edgeId
          ? { ...edge, data: { ...edge.data, ...dataUpdate } }
          : edge
      )
    );
    return true;
  }, [setEdges]);

  // Edge deletion
  const deleteEdge = useCallback((edgeId: string): boolean => {
    const edgeToDelete = edges.find(e => e.id === edgeId);
    logger.log('[EdgeManager] [deleteEdge] Called with:', { edgeId, graphId, edgeToDelete, allEdges: edges });
    if (graphId && isUUID(edgeId)) {
      const url = `/api/v1/graphs/${graphId}/edges/${edgeId}`;
      logger.log('[EdgeManager] [deleteEdge] Will call API:', url);
      apiClient.deleteEdge(graphId, edgeId)
        .then((response) => {
          logger.log('[EdgeManager] [deleteEdge] Edge deleted in backend', { edgeId, response });
        })
        .catch(err => {
          logger.error('[EdgeManager] [deleteEdge] Failed to delete edge in backend:', { edgeId, error: err });
        });
    } else if (!isUUID(edgeId)) {
      logger.warn('[EdgeManager] [deleteEdge] Skipping backend deletion, edgeId is not a UUID', { edgeId });
    } else {
      logger.warn('[EdgeManager] [deleteEdge] No graphId provided for edge deletion', { edgeId });
    }
    setEdges(currentEdges => {
      const after = currentEdges.filter(edge => edge.id !== edgeId);
      logger.log('[EdgeManager] [deleteEdge] Edges after local deletion:', after);
      return after;
    });
    setSelectedEdges(current => current.filter(edge => edge.id !== edgeId));
    return true;
  }, [setEdges, graphId, edges, apiClient]);

  const deleteSelectedEdges = useCallback((): number => {
    const deletedCount = selectedEdges.length;
    const selectedIds = selectedEdges.map(edge => edge.id);
    logger.log('[EdgeManager] [deleteSelectedEdges] Called with:', { selectedEdges, selectedIds, graphId, allEdges: edges });
    if (graphId) {
      selectedIds.forEach(edgeId => {
        if (!isUUID(edgeId)) {
          logger.warn('[EdgeManager] [deleteSelectedEdges] Skipping backend deletion, edgeId is not a UUID', { edgeId });
          return;
        }
        const url = `/api/v1/graphs/${graphId}/edges/${edgeId}`;
        const edgeToDelete = edges.find(e => e.id === edgeId);
        logger.log('[EdgeManager] [deleteSelectedEdges] Will call API:', { edgeId, url, edgeToDelete });
        apiClient.deleteEdge(graphId, edgeId)
          .then((response) => {
            logger.log('[EdgeManager] [deleteSelectedEdges] Selected edge deleted in backend', { edgeId, response });
          })
          .catch(err => {
            logger.error('[EdgeManager] [deleteSelectedEdges] Failed to delete selected edge in backend:', { edgeId, error: err });
          });
      });
    } else {
      logger.warn('[EdgeManager] [deleteSelectedEdges] No graphId provided for selected edge deletion', { selectedIds });
    }
    setEdges(currentEdges => {
      const after = currentEdges.filter(edge => !selectedIds.includes(edge.id));
      logger.log('[EdgeManager] [deleteSelectedEdges] Edges after local deletion:', after);
      return after;
    });
    setSelectedEdges([]);
    return deletedCount;
  }, [selectedEdges, setEdges, graphId, edges, apiClient]);

  const deleteEdgesByNode = useCallback((nodeId: string): number => {
    const edgesToDelete = edges.filter(edge => 
      edge.source === nodeId || edge.target === nodeId
    );
    
    setEdges(currentEdges => 
      currentEdges.filter(edge => 
        edge.source !== nodeId && edge.target !== nodeId
      )
    );
    
    return edgesToDelete.length;
  }, [edges, setEdges]);

  // Edge filtering and queries
  const getEdgesByType = useCallback((edgeType: EdgeType): Edge[] => {
    return filterEdgesByType(edges, edgeType);
  }, [edges]);

  // Fetch a single edge from backend
  const fetchEdge = useCallback(async (edgeId: string) => {
    if (!graphId) return undefined;
    try {
      const edge = await apiClient.getEdge(graphId, edgeId);
      return edge;
    } catch (err) {
      logger.error('Failed to fetch edge from backend:', err);
      return undefined;
    }
  }, [graphId, apiClient]);

  // Update a single edge in backend
  const updateEdge = useCallback(async (edgeId: string, edgeData: Partial<{ source_node_id: string; target_node_id: string; type: string; }>) => {
    if (!isUUID(edgeId)) {
      logger.warn('[EdgeManager] [updateEdge] Skipping backend update, edgeId is not a UUID', { edgeId });
      return undefined;
    }
    if (!graphId) return undefined;
    try {
      const updated = await apiClient.updateEdge(graphId, edgeId, edgeData);
      return updated;
    } catch (err) {
      logger.error('Failed to update edge in backend:', err);
      return undefined;
    }
  }, [graphId, apiClient]);

  // Patch getEdgeById to optionally fetch from backend
  const getEdgeById = useCallback((edgeId: string, fetchRemote = false) => {
    const localEdge = edges.find(edge => edge.id === edgeId);
    if (fetchRemote && graphId) {
      fetchEdge(edgeId).then(remoteEdge => {
        if (remoteEdge) {
          // Optionally update local state or log
          // setEdges? (not updating here to avoid side effects)
          logger.log('Remote edge:', remoteEdge);
        }
      });
    }
    return localEdge;
  }, [edges, fetchEdge, graphId]);

  // Edge statistics
  const edgeStats = useMemo(() => getEdgeStats(edges), [edges]);

  // Cleanup operations
  const cleanupOrphanedEdges = useCallback((nodeIds: string[]): number => {
    const originalCount = edges.length;
    const cleanedEdges = removeOrphanedEdges(edges, nodeIds);
    
    setEdges(cleanedEdges);
    
    return originalCount - cleanedEdges.length;
  }, [edges, setEdges]);

  const clearAllEdges = useCallback((): number => {
    const deletedCount = edges.length;
    setEdges([]);
    setSelectedEdges([]);
    return deletedCount;
  }, [edges, setEdges]);

  // Bulk operations
  const createMultipleEdges = useCallback((
    connections: Array<{ connection: Connection; type?: EdgeType; options?: unknown }>
  ): EdgeOperationResult[] => {
    const results: EdgeOperationResult[] = [];
    
    connections.forEach(({ connection, type = activeEdgeType, options }) => {
      const result = createEdge(connection, type, options);
      results.push(result);
    });
    
    return results;
  }, [activeEdgeType, createEdge]);

  // Edge configuration
  const getAvailableEdgeTypes = useCallback((): EdgeType[] => {
    return Object.keys(EDGE_CONFIGS) as EdgeType[];
  }, []);

  const getEdgeTypeConfig = useCallback((edgeType: EdgeType) => {
    return EDGE_CONFIGS[edgeType];
  }, []);

  return useMemo(() => ({
    // Core state
    edges,
    selectedEdges,
    activeEdgeType,
    edgeStats,

    // State management
    setEdges,
    onEdgesChange,
    onEdgeSelectionChange,
    setActiveEdgeType,

    // Edge operations
    onConnect,
    createEdge,
    deleteEdge,
    deleteSelectedEdges,
    deleteEdgesByNode,
    updateEdgeData,
    changeEdgeType,

    // Validation
    isValidConnection,
    validator,

    // Queries
    getEdgesByType,
    getEdgeById,
    getAvailableEdgeTypes,
    getEdgeTypeConfig,

    // Bulk operations
    createMultipleEdges,
    cleanupOrphanedEdges,
    clearAllEdges,

    // Computed properties
    hasSelectedEdges: selectedEdges.length > 0,
    edgeCount: edges.length,
    selectedEdgeCount: selectedEdges.length,
    fetchEdge,
    updateEdge,
  }), [
    edges,
    selectedEdges,
    activeEdgeType,
    edgeStats,
    setEdges,
    onEdgesChange,
    onEdgeSelectionChange,
    setActiveEdgeType,
    onConnect,
    createEdge,
    deleteEdge,
    deleteSelectedEdges,
    deleteEdgesByNode,
    updateEdgeData,
    changeEdgeType,
    isValidConnection,
    validator,
    getEdgesByType,
    getEdgeById,
    getAvailableEdgeTypes,
    getEdgeTypeConfig,
    createMultipleEdges,
    cleanupOrphanedEdges,
    clearAllEdges,
    fetchEdge,
    updateEdge,
  ]);
} 