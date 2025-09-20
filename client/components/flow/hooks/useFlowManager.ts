"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  useNodesState,
  Node,
  OnSelectionChangeParams,
  Connection,
  NodeChange,
} from '@xyflow/react';
import { NODE_SIZES, RESIZE_CONFIG } from '../constants';
import type { Edge } from '@xyflow/react';
import { generateRandomPosition, exportFlowData } from '../utils';
import { useEdgeManager } from '../edges';
import { useApiClient } from '@/lib/useApiClient';
import { useUserLimits } from '@/lib/useUserLimits';
import { logger } from '@/lib/logger';

export function useFlowManager(initialData?: { nodes?: Node[]; edges?: Edge[] }, graphId?: string) {
  const apiClient = useApiClient();
  const { canCreateNode, getNodeLimitMessage, isProUser } = useUserLimits();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialData?.nodes || []);
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  const [resizingNodes, setResizingNodes] = useState<Set<string>>(new Set());
  const initialAutoAssignDoneRef = useRef<boolean>(false);
  


  const edgeManager = useEdgeManager({
    initialEdges: initialData?.edges || [],
    defaultEdgeType: 'default',
    maxConnectionsPerHandle: 10,
  }, nodes, graphId);

  // --- Auto-handle assignment helpers ---
  const isUUID = useCallback((id: string): boolean => {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
  }, []);

  type NodeRect = { x: number; y: number; width: number; height: number; cx: number; cy: number };

  const buildNodeRect = useCallback((n: Node): NodeRect => {
    const width = (n as any).width ?? (n.style as any)?.width ?? NODE_SIZES.DEFAULT_WIDTH;
    const height = (n as any).height ?? (n.style as any)?.height ?? NODE_SIZES.DEFAULT_HEIGHT;
    const x = n.position?.x ?? 0;
    const y = n.position?.y ?? 0;
    return { x, y, width, height, cx: x + width / 2, cy: y + height / 2 };
  }, []);

	// Debounce handle reassignment checks during rapid node changes
	const HANDLE_REASSIGN_DEBOUNCE_MS = RESIZE_CONFIG.DEBOUNCE_TIME;
	const handleReassignTimerRef = useRef<NodeJS.Timeout | null>(null);
	const pendingReassignNodeIdsRef = useRef<Set<string>>(new Set());

	// Compute absolute closest pair of handles (across all 4x4 combinations) based on handle-anchor distances
	const chooseHandlesByGeometry = useCallback((sourceNode: Node, targetNode: Node, currentSource?: string | null, currentTarget?: string | null) => {
		const s = buildNodeRect(sourceNode);
		const t = buildNodeRect(targetNode);

		// Handle anchors for source and target
		const sourceAnchors: Record<'top-source' | 'bottom-source' | 'left-source' | 'right-source', { x: number; y: number }> = {
			'top-source': { x: s.cx, y: s.y },
			'bottom-source': { x: s.cx, y: s.y + s.height },
			'left-source': { x: s.x, y: s.cy },
			'right-source': { x: s.x + s.width, y: s.cy },
		};
		const targetAnchors: Record<'top-target' | 'bottom-target' | 'left-target' | 'right-target', { x: number; y: number }> = {
			'top-target': { x: t.cx, y: t.y },
			'bottom-target': { x: t.cx, y: t.y + t.height },
			'left-target': { x: t.x, y: t.cy },
			'right-target': { x: t.x + t.width, y: t.cy },
		};

		const sourceKeys = ['top-source', 'bottom-source', 'left-source', 'right-source'] as const;
		const targetKeys = ['top-target', 'bottom-target', 'left-target', 'right-target'] as const;

		let best = { sourceHandle: (currentSource as keyof typeof sourceAnchors) ?? 'right-source', targetHandle: (currentTarget as keyof typeof targetAnchors) ?? 'left-target' };
		let bestDist = Number.POSITIVE_INFINITY;

		// If current handles are provided, seed the distance with them
		if (currentSource && currentTarget && sourceAnchors[currentSource as keyof typeof sourceAnchors] && targetAnchors[currentTarget as keyof typeof targetAnchors]) {
			const a0 = sourceAnchors[currentSource as keyof typeof sourceAnchors];
			const b0 = targetAnchors[currentTarget as keyof typeof targetAnchors];
			bestDist = Math.hypot(b0.x - a0.x, b0.y - a0.y);
		}

		for (const sKey of sourceKeys) {
			for (const tKey of targetKeys) {
				const a = sourceAnchors[sKey];
				const b = targetAnchors[tKey];
				const dx = b.x - a.x;
				const dy = b.y - a.y;
				const dist = Math.hypot(dx, dy);
				if (dist < bestDist) {
					bestDist = dist;
					best = { sourceHandle: sKey, targetHandle: tKey };
				}
			}
		}

		return best;
	}, [buildNodeRect]);

  const edgeHandleUpdateTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
  const pendingEdgeHandleUpdatesRef = useRef<Map<string, { source_handle?: string | null; target_handle?: string | null }>>(new Map());

  const flushPendingEdgeHandleUpdates = useCallback(async () => {
    if (!graphId || pendingEdgeHandleUpdatesRef.current.size === 0) return;
    const updates = Array.from(pendingEdgeHandleUpdatesRef.current.entries());
    pendingEdgeHandleUpdatesRef.current.clear();

    await Promise.allSettled(updates.map(([edgeId, data]) => {
      if (!isUUID(edgeId)) return Promise.resolve();
      return apiClient.updateEdge(graphId, edgeId, data).catch(() => undefined);
    }));
  }, [graphId, apiClient, isUUID]);

  const scheduleEdgeHandleUpdate = useCallback((edgeId: string, data: { source_handle?: string | null; target_handle?: string | null }) => {
    const existing = pendingEdgeHandleUpdatesRef.current.get(edgeId) || {};
    pendingEdgeHandleUpdatesRef.current.set(edgeId, { ...existing, ...data });

    if (edgeHandleUpdateTimersRef.current[edgeId]) {
      clearTimeout(edgeHandleUpdateTimersRef.current[edgeId]);
    }
    edgeHandleUpdateTimersRef.current[edgeId] = setTimeout(() => {
      flushPendingEdgeHandleUpdates();
      delete edgeHandleUpdateTimersRef.current[edgeId];
    }, RESIZE_CONFIG.DEBOUNCE_TIME);
  }, [flushPendingEdgeHandleUpdates]);

  const autoAssignHandlesForNodeIds = useCallback((affectedNodeIds: string[]) => {
    if (!edgeManager?.edges || edgeManager.edges.length === 0) return;
    const affectedSet = new Set(affectedNodeIds);
    const nodeMap = new Map(nodes.map(n => [n.id, n] as const));

    const updates: Array<{ id: string; sourceHandle?: string | null; targetHandle?: string | null }> = [];
    edgeManager.edges.forEach(e => {
      if (!affectedSet.has(e.source) && !affectedSet.has(e.target)) return;
      const sourceNode = nodeMap.get(e.source);
      const targetNode = nodeMap.get(e.target);
      if (!sourceNode || !targetNode) return;
      const chosen = chooseHandlesByGeometry(sourceNode, targetNode, e.sourceHandle ?? null, e.targetHandle ?? null) as any;
      const newSource = chosen.sourceHandle ?? chosen.source;
      const newTarget = chosen.targetHandle ?? chosen.target;
      const changedSource = newSource !== (e.sourceHandle ?? null);
      const changedTarget = newTarget !== (e.targetHandle ?? null);
      if (changedSource || changedTarget) {
        updates.push({ id: e.id, sourceHandle: newSource, targetHandle: newTarget });
      }
    });

    if (updates.length === 0) return;

		edgeManager.setEdges(currentEdges => currentEdges.map(e => {
			const u = updates.find(x => x.id === e.id);
			if (!u) return e;
			return { ...e, sourceHandle: u.sourceHandle ?? e.sourceHandle ?? null, targetHandle: u.targetHandle ?? e.targetHandle ?? null } as Edge;
		}));

		updates.forEach(u => {
			scheduleEdgeHandleUpdate(u.id, { source_handle: u.sourceHandle ?? null, target_handle: u.targetHandle ?? null });
		});
  }, [edgeManager, nodes, chooseHandlesByGeometry, scheduleEdgeHandleUpdate]);

  // Listen for document node chat session updates
  useEffect(() => {
    const handleDocumentNodeUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { nodeId, chatSessionId } = customEvent.detail;
      
      // Find the target node before update
      const targetNode = nodes.find(n => n.id === nodeId);
      
      setNodes(currentNodes => {
        const updatedNodes = currentNodes.map(node => 
          node.id === nodeId 
            ? { 
                ...node, 
                data: { 
                  ...node.data, 
                  chatSessionId: chatSessionId,
                  isLoading: true 
                } 
              }
            : node
        );
        
        return updatedNodes;
      });
    };

    window.addEventListener('document-node-chat-session-update', handleDocumentNodeUpdate);
    return () => {
      window.removeEventListener('document-node-chat-session-update', handleDocumentNodeUpdate);
    };
  }, [nodes, setNodes]);

  // Listen for graph node chat session updates
  useEffect(() => {
    const handleGraphNodeUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { nodeId, chatSessionId } = customEvent.detail;

      setNodes(currentNodes => {
        const updatedNodes = currentNodes.map(node =>
          node.id === nodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  chatSessionId: chatSessionId,
                  isLoading: true,
                },
              }
            : node
        );
        return updatedNodes;
      });
    };

    window.addEventListener('graph-node-chat-session-update', handleGraphNodeUpdate);
    return () => {
      window.removeEventListener('graph-node-chat-session-update', handleGraphNodeUpdate);
    };
  }, [setNodes]);

  // Listen for table node chat session updates
  useEffect(() => {
    const handleTableNodeUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { nodeId, chatSessionId } = customEvent.detail;
      
      // Find the target node before update
      const targetNode = nodes.find(n => n.id === nodeId);
      
      setNodes(currentNodes => {
        const updatedNodes = currentNodes.map(node => 
          node.id === nodeId 
            ? { 
                ...node, 
                data: { 
                  ...node.data, 
                  chatSessionId: chatSessionId,
                  isLoading: true 
                } 
              }
            : node
        );
        
        return updatedNodes;
      });
    };

    window.addEventListener('table-node-chat-session-update', handleTableNodeUpdate);
    return () => {
      window.removeEventListener('table-node-chat-session-update', handleTableNodeUpdate);
    };
  }, [nodes, setNodes]);

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedNodes(params.nodes);

    // Always include explicitly selected edges from React Flow
    const directSelectedEdgeIds = params.edges.map(edge => edge.id);

    // When nodes are selected, also highlight all edges connected to any selected node
    const selectedNodeIds = params.nodes.map(n => n.id);
    const connectedEdges = edgeManager?.edges
      ?.filter(e => selectedNodeIds.includes(e.source) || selectedNodeIds.includes(e.target)) || [];
    const connectedEdgeIds = connectedEdges.map(e => e.id);

    // Update edge data to carry highlight direction (outgoing = orange, incoming = green)
    // Only update if something actually changes to avoid update loops
    if (edgeManager?.setEdges) {
      const selectedSet = new Set(selectedNodeIds);
      let changed = false;
      edgeManager.setEdges(currentEdges => {
        const nextEdges = currentEdges.map(e => {
          const isConnected = selectedSet.has(e.source) || selectedSet.has(e.target);
          const currentDirection = (e.data as any)?.highlightDirection as 'incoming' | 'outgoing' | undefined;
          if (!isConnected) {
            if (currentDirection !== undefined) {
              changed = true;
              if (e.data && typeof e.data === 'object') {
                const { highlightDirection, ...rest } = e.data as Record<string, unknown>;
                return { ...e, data: { ...rest } } as Edge;
              }
            }
            return e;
          }
          const isOutgoing = selectedSet.has(e.source);
          const direction = isOutgoing ? 'outgoing' : 'incoming';
          if (currentDirection !== direction) {
            changed = true;
            const nextData = { ...(e.data as Record<string, unknown> | undefined), highlightDirection: direction } as Record<string, unknown>;
            return { ...e, data: nextData } as Edge;
          }
          return e;
        });
        return changed ? nextEdges : currentEdges;
      });
    }

    const uniqueSelectedEdgeIds = Array.from(new Set([...directSelectedEdgeIds, ...connectedEdgeIds]));

    if (edgeManager?.onEdgeSelectionChange) {
      edgeManager.onEdgeSelectionChange(uniqueSelectedEdgeIds);
    }
  }, [edgeManager?.onEdgeSelectionChange, edgeManager?.edges]);

  const debouncedUpdates = useRef<Record<string, NodeJS.Timeout>>({});
  const batchedUpdates = useRef<Map<string, { width?: number; height?: number; position_x?: number; position_y?: number }>>(new Map());

  // Utility function to validate node resize constraints
  const validateNodeResize = useCallback((nodeId: string, dimensions: { width: number; height: number }) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return false;
    
    const { MIN_WIDTH, MIN_HEIGHT, MAX_WIDTH, MAX_HEIGHT } = NODE_SIZES;
    return dimensions.width >= MIN_WIDTH && 
           dimensions.height >= MIN_HEIGHT &&
           dimensions.width <= MAX_WIDTH &&
           dimensions.height <= MAX_HEIGHT;
  }, [nodes]);

  // Batch API updates for better performance
  const flushBatchedUpdates = useCallback(async () => {
    if (!graphId || batchedUpdates.current.size === 0) return;

    const updates = Array.from(batchedUpdates.current.entries());
    batchedUpdates.current.clear();

    // Process updates in parallel for better performance
    const updatePromises = updates.map(([nodeId, updateData]) => 
      apiClient.updateNode(graphId, nodeId, updateData).catch(err => {
        logger.error(`Failed to update node ${nodeId}:`, err);
        // Optionally revert the visual change here
      })
    );

    try {
      await Promise.allSettled(updatePromises);
    } catch (err) {
      logger.error('Batch update failed:', err);
    }
  }, [graphId, apiClient]);

  // Cleanup debounced updates on unmount
  useEffect(() => {
    return () => {
      // Clear all pending debounced updates
      Object.values(debouncedUpdates.current).forEach(timeout => {
        clearTimeout(timeout);
      });
      debouncedUpdates.current = {};
      
      // Flush any remaining batched updates
      if (batchedUpdates.current.size > 0) {
        flushBatchedUpdates();
      }

      // Clear pending handle reassignment timer
      if (handleReassignTimerRef.current) {
        clearTimeout(handleReassignTimerRef.current);
        handleReassignTimerRef.current = null;
      }
    };
  }, [flushBatchedUpdates]);

  // Remove node event handler (used when user cancels processing options modal)
  useEffect(() => {
    const handleRemoveNode = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { nodeId } = customEvent.detail || {};
      if (!nodeId) return;
      setNodes(currentNodes => currentNodes.filter(n => n.id !== nodeId));
      // Optionally also remove connected edges immediately
      edgeManager.deleteEdgesByNode(nodeId);
    };
    const handleSelectNode = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { nodeId } = customEvent.detail || {};
      if (!nodeId) return;
      // Mark this node as selected in state
      const node = nodes.find(n => n.id === nodeId);
      if (!node) return;
      setSelectedNodes([node]);
    };
    window.addEventListener('remove-node', handleRemoveNode);
    window.addEventListener('select-node', handleSelectNode);
    return () => {
      window.removeEventListener('remove-node', handleRemoveNode);
      window.removeEventListener('select-node', handleSelectNode);
    };
  }, [setNodes, edgeManager]);

  const onNodesChangeWithLog = useCallback((changes: NodeChange[]) => {
    // Apply changes immediately to UI for responsive feel
    onNodesChange(changes);

    // Debounced auto-assign handles during drag/resize on both ends
    const affectedIds: string[] = [];
    changes.forEach(change => {
      if (change.type === 'position' || change.type === 'dimensions') {
        affectedIds.push(change.id);
      }
    });
    if (affectedIds.length > 0) {
      affectedIds.forEach(id => pendingReassignNodeIdsRef.current.add(id));
      if (handleReassignTimerRef.current) {
        clearTimeout(handleReassignTimerRef.current);
      }
      handleReassignTimerRef.current = setTimeout(() => {
        const ids = Array.from(pendingReassignNodeIdsRef.current);
        pendingReassignNodeIdsRef.current.clear();
        autoAssignHandlesForNodeIds(Array.from(new Set(ids)));
        handleReassignTimerRef.current = null;
      }, HANDLE_REASSIGN_DEBOUNCE_MS);
    }

    if (!graphId) return;

    changes.forEach(change => {
      if (change.type === 'position' && change.position && !change.dragging) {
        const nodeId = change.id;
        if (debouncedUpdates.current[nodeId]) {
          clearTimeout(debouncedUpdates.current[nodeId]);
        }
        
        // Add to batch instead of immediate API call
        const existing = batchedUpdates.current.get(nodeId) || {};
        batchedUpdates.current.set(nodeId, {
          ...existing,
          position_x: change.position.x,
          position_y: change.position.y,
        });
        
        debouncedUpdates.current[nodeId] = setTimeout(() => {
          flushBatchedUpdates();
          delete debouncedUpdates.current[nodeId];
        }, RESIZE_CONFIG.DEBOUNCE_TIME);
        
      } else if (change.type === 'dimensions' && change.dimensions) {
        const nodeId = change.id;
        const { width, height } = change.dimensions;
        
        // Validate resize constraints
        if (RESIZE_CONFIG.VALIDATION_ENABLED && !validateNodeResize(nodeId, { width, height })) {
          logger.warn(`Resize validation failed for node ${nodeId}:`, { width, height });
          return;
        }
        
        // Add visual feedback for ongoing resize
        setResizingNodes(prev => new Set(prev).add(nodeId));
        
        const debounceKey = `${nodeId}-dimensions`;
        if (debouncedUpdates.current[debounceKey]) {
          clearTimeout(debouncedUpdates.current[debounceKey]);
        }
        
        // Add to batch instead of immediate API call
        const existing = batchedUpdates.current.get(nodeId) || {};
        batchedUpdates.current.set(nodeId, {
          ...existing,
          width,
          height,
        });
        
        debouncedUpdates.current[debounceKey] = setTimeout(() => {
          flushBatchedUpdates();
          setResizingNodes(prev => {
            const next = new Set(prev);
            next.delete(nodeId);
            return next;
          });
          delete debouncedUpdates.current[debounceKey];
        }, RESIZE_CONFIG.DEBOUNCE_TIME);
      }
    });
  }, [onNodesChange, graphId, validateNodeResize, flushBatchedUpdates]);

  const hasSelection = selectedNodes.length > 0 || edgeManager.hasSelectedEdges;

  // Wrapper function to check node limits before creation
  const withNodeLimitCheck = useCallback((nodeCreationFn: () => Promise<void>, nodeName: string) => {
    return async () => {
      const currentNodeCount = nodes.length;
      
      if (!canCreateNode(graphId, currentNodeCount)) {
        const message = `${getNodeLimitMessage()} You currently have ${currentNodeCount} nodes in this board.`;
        const upgradeMessage = !isProUser ? " Upgrade to Pro for unlimited nodes." : "";
        alert(message + upgradeMessage);
        return;
      }
      
      try {
        await nodeCreationFn();
      } catch (err: any) {
        logger.error(`Failed to create ${nodeName}:`, err);
        
        // Handle specific limit error responses
        if (err.message && err.message.includes('Node limit exceeded')) {
          alert(`Node limit exceeded. ${getNodeLimitMessage()}`);
        } else if (err.response?.status === 403) {
          alert(`Node limit exceeded. ${getNodeLimitMessage()}`);
        } else {
          alert(`Failed to create ${nodeName}. Please try again.`);
        }
      }
    };
  }, [nodes.length, canCreateNode, graphId, getNodeLimitMessage, isProUser]);

  // Shared function to delete selected nodes and edges
  const deleteSelectedNodesAndEdges = useCallback((nodesToDelete: Node[] = selectedNodes, edgesToDelete: any[] = edgeManager.selectedEdges) => {
    // Delete nodes and their content in backend and update state
    if (nodesToDelete.length > 0) {
      const nodeIds = nodesToDelete
        .map(node => node.id)
        .filter((id): id is string => typeof id === 'string');
      if (typeof graphId === 'string') {
        nodeIds.forEach(nodeId => {
          apiClient.deleteNodeAndContent(graphId, nodeId).catch(logger.error);
        });
        nodeIds.forEach(nodeId => {
          edgeManager.deleteEdgesByNode(nodeId);
        });
      }
      setNodes(nds => nds.filter(node => typeof node.id === 'string' && !nodeIds.includes(node.id)));
    }
    // Delete edges via edgeManager (calls backend and updates state)
    if (edgesToDelete.length > 0) {
      const edgeIds = edgesToDelete.map((edge: any) => edge.id).filter((id): id is string => typeof id === 'string');
      edgeIds.forEach(edgeId => {
        edgeManager.deleteEdge(edgeId);
      });
    }
    setSelectedNodes([]);
    // edgeManager.setSelectedEdges([]); // Not needed, handled by edgeManager
  }, [selectedNodes, edgeManager, graphId, apiClient, setNodes]);

  // Toolbar and keyboard delete both use this
  const deleteSelected = useCallback(async () => {
    await deleteSelectedNodesAndEdges();
  }, [deleteSelectedNodesAndEdges]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isEditingText = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.getAttribute('contenteditable') === 'true' ||
        activeElement.getAttribute('contenteditable') === ''
      );

      if ((event.key === 'Delete' || event.key === 'Backspace') && !isEditingText) {
        if (hasSelection) {
          event.preventDefault();
          deleteSelected();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasSelection, deleteSelected]);

  const isValidConnection = edgeManager.isValidConnection;

  const mousePositionRef = useRef({ x: 0, y: 0 });
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePositionRef.current = { x: e.clientX, y: e.clientY };
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Initial auto-assignment after load (runs once when nodes and edges exist)
  useEffect(() => {
    if (initialAutoAssignDoneRef.current) return;
    if (!nodes || nodes.length === 0) return;
    if (!edgeManager?.edges || edgeManager.edges.length === 0) return;
    initialAutoAssignDoneRef.current = true;
    const nodeIds = Array.from(new Set(edgeManager.edges.flatMap(e => [e.source, e.target])));
    requestAnimationFrame(() => autoAssignHandlesForNodeIds(nodeIds));
  }, [nodes, edgeManager?.edges]);

  const onConnect = useCallback((connection: Connection) => {
    if (!isValidConnection(connection)) {
      logger.warn('Invalid connection attempted');
      return;
    }
    
    // Optimize handles immediately based on geometry
    const sourceNode = nodes.find(n => n.id === connection.source);
    const targetNode = nodes.find(n => n.id === connection.target);
    let optimized = connection;
    if (sourceNode && targetNode) {
      const chosen = chooseHandlesByGeometry(sourceNode, targetNode, connection.sourceHandle ?? null, connection.targetHandle ?? null) as any;
      optimized = {
        ...connection,
        sourceHandle: chosen.source ?? chosen.sourceHandle,
        targetHandle: chosen.target ?? chosen.targetHandle,
      } as Connection;
    }

    // Create edge directly without modal
    const result = edgeManager.createEdge(optimized, 'default', undefined);
    
    if (!result.success) {
      logger.warn('Edge creation failed:', result.message);
    }
  }, [isValidConnection, edgeManager, nodes, chooseHandlesByGeometry]);



  const addChatNode = useCallback(async (position?: { x: number; y: number }) => {
    logger.log("addChatNode called, graphId:", graphId);
    if (!graphId) {
      logger.warn("No graphId, aborting chat node creation");
      return;
    }
    const nodePosition = position || generateRandomPosition();
    try {
      const response = await apiClient.createNodeWithContent(graphId, {
        type: 'chat',
        position_x: nodePosition.x,
        position_y: nodePosition.y,
        width: NODE_SIZES.DEFAULT_WIDTH,
        height: NODE_SIZES.DEFAULT_HEIGHT,
        title: `Chat Node`,
        model_used: 'gpt-4o',
      }) as { node?: any };
      if (!response.node) {
        logger.error('API did not return a node:', response);
        return;
      }
      const newNode: Node = {
        id: response.node.id.toString(),
        type: 'chatNode',
        position: { x: response.node.position_x, y: response.node.position_y },
        data: { label: response.node.title, category: 'Polyvalent', type: 'chat', content_id: response.node.content_id },
        style: {
          width: response.node.width,
          height: response.node.height,
        },
      };
      setNodes((nds) => [...nds, newNode]);
    } catch (err) {
      logger.error('Failed to create chat node:', err);
    }
  }, [graphId, setNodes, apiClient]);

  const addPDFNode = useCallback(async (position?: { x: number; y: number }) => {
    logger.log("addPDFNode called, graphId:", graphId);
    if (!graphId) {
      logger.warn("No graphId, aborting PDF node creation");
      return;
    }
    const nodePosition = position || generateRandomPosition();
    try {
      const response = await apiClient.createNodeWithContent(graphId, {
        type: 'asset',
        position_x: nodePosition.x,
        position_y: nodePosition.y,
        width: NODE_SIZES.DEFAULT_WIDTH,
        height: NODE_SIZES.DEFAULT_HEIGHT,
        title: `PDF Viewer Node`,
        asset_type: 'pdf',
        source: 'example.pdf',  // This triggers placeholder creation in backend
      }) as { node?: any; content?: any };
      if (!response.node) {
        logger.error('API did not return a node:', response);
        return;
      }
      
      // Check if this is a placeholder (new PDF waiting for upload)
      const isPlaceholder = response.content?.is_placeholder === true;
      
      const newNode: Node = {
        id: response.node.id.toString(),
        type: 'pdfNode',
        position: { x: response.node.position_x, y: response.node.position_y },
        data: { 
          label: response.node.title, 
          category: 'Data source', 
          type: 'pdf',
          graphId: graphId, // Add graphId to node data
          content_id: response.node.content_id,
          is_placeholder: isPlaceholder, // Flag to indicate this is waiting for upload
          placeholder_id: isPlaceholder ? response.node.content_id : undefined // Store placeholder ID for later use
        },
        style: {
          width: response.node.width,
          height: response.node.height,
        },
      };
      setNodes((nds) => [...nds, newNode]);
      
      if (isPlaceholder) {
        logger.log("Created PDF node with placeholder content_id:", response.node.content_id);
      }
    } catch (err) {
      logger.error('Failed to create PDF node:', err);
    }
  }, [graphId, setNodes, apiClient]);

  const addWebsiteNode = useCallback(async (position?: { x: number; y: number }) => {
    if (!graphId) {
      logger.warn("No graphId, aborting website node creation");
      return;
    }
    const nodePosition = position || generateRandomPosition();
    try {
      const response = await apiClient.createNodeWithContent(graphId, {
        type: 'asset',
        position_x: nodePosition.x,
        position_y: nodePosition.y,
        width: NODE_SIZES.DEFAULT_WIDTH,
        height: NODE_SIZES.DEFAULT_HEIGHT,
        title: `Website Node`,
        asset_type: 'website',
        source: 'https://www.google.com',  // This triggers placeholder creation
      }) as { node?: any; content?: any };
      if (!response.node) {
        logger.error('API did not return a node:', response);
        return;
      }
      
      // Check if this is a placeholder (new website waiting for URL)
      const isPlaceholder = response.content?.is_placeholder === true;
      
      const newNode: Node = {
        id: response.node.id.toString(),
        type: 'websiteNode',
        position: { x: response.node.position_x, y: response.node.position_y },
        data: { 
          label: response.node.title, 
          category: 'Data source', 
          type: 'website', 
          url: isPlaceholder ? null : (response.node.source || 'https://www.google.com'),
          graph_id: String(graphId),
          is_placeholder: isPlaceholder,
          placeholder_id: isPlaceholder ? response.node.content_id : undefined,
          content_id: response.node.content_id
        },
        style: {
          width: response.node.width,
          height: response.node.height,
        },
      };
      setNodes((nds) => [...nds, newNode]);
      
      if (isPlaceholder) {
        logger.log("Created website node with placeholder content_id:", response.node.content_id);
      }
    } catch (err) {
      logger.error('Failed to create website node:', err);
    }
  }, [graphId, setNodes, apiClient]);

  const addYouTubeNode = useCallback(async (position?: { x: number; y: number }) => {
    logger.log("addYouTubeNode called, graphId:", graphId);
    if (!graphId) {
      logger.warn("No graphId, aborting YouTube node creation");
      return;
    }
    const nodePosition = position || generateRandomPosition();
    try {
      const response = await apiClient.createNodeWithContent(graphId, {
        type: 'asset',
        position_x: nodePosition.x,
        position_y: nodePosition.y,
        width: NODE_SIZES.DEFAULT_WIDTH,
        height: NODE_SIZES.DEFAULT_HEIGHT,
        title: `YouTube Node`,
        asset_type: 'youtube',
        source: 'https://www.youtube.com/watch?v=example',
      }) as { node?: any };
      if (!response.node) {
        logger.error('API did not return a node:', response);
        return;
      }
      const newNode: Node = {
        id: response.node.id.toString(),
        type: 'youtubeNode',
        position: { x: response.node.position_x, y: response.node.position_y },
        data: { 
          label: response.node.title, 
          category: 'Data source', 
          type: 'youtube', 
          url: response.node.source,
          content_id: response.node.content_id,
          graph_id: response.node.graph_id ? String(response.node.graph_id) : String(graphId),
        },
        style: {
          width: response.node.width,
          height: response.node.height,
        },
      };
      setNodes((nds) => [...nds, newNode]);
    } catch (err) {
      logger.error('Failed to create YouTube node:', err);
    }
  }, [graphId, setNodes, apiClient]);

  const addInstagramNode = useCallback(async (position?: { x: number; y: number }) => {
    logger.log("addInstagramNode called, graphId:", graphId);
    if (!graphId) {
      logger.warn("No graphId, aborting Instagram node creation");
      return;
    }
    const nodePosition = position || generateRandomPosition();
    try {
      const response = await apiClient.createNodeWithContent(graphId, {
        type: 'asset',
        position_x: nodePosition.x,
        position_y: nodePosition.y,
        width: NODE_SIZES.DEFAULT_WIDTH,
        height: NODE_SIZES.DEFAULT_HEIGHT,
        title: `Instagram Node`,
        asset_type: 'instagram',
        source: 'https://www.instagram.com/example',
      }) as { node?: any };
      if (!response.node) {
        logger.error('API did not return a node:', response);
        return;
      }
      const newNode: Node = {
        id: response.node.id.toString(),
        type: 'instagramNode',
        position: { x: response.node.position_x, y: response.node.position_y },
        data: { label: response.node.title, category: 'Data source', type: 'instagram', url: response.node.source },
        style: {
          width: response.node.width,
          height: response.node.height,
        },
      };
      setNodes((nds) => [...nds, newNode]);
    } catch (err) {
      logger.error('Failed to create Instagram node:', err);
    }
  }, [graphId, setNodes, apiClient]);

  const addArtefactNode = useCallback(async (position?: { x: number; y: number }) => {
    logger.log("addArtefactNode called, graphId:", graphId);
    if (!graphId) {
      logger.warn("No graphId, aborting artefact node creation");
      return;
    }
    const nodePosition = position || generateRandomPosition();
    try {
      const response = await apiClient.createNodeWithContent(graphId, {
        type: 'artefact',
        position_x: nodePosition.x,
        position_y: nodePosition.y,
        width: NODE_SIZES.DEFAULT_WIDTH,
        height: NODE_SIZES.DEFAULT_HEIGHT,
        title: `Artefact Node`,
        artefact_type: 'table',
        current_data: {},
      }) as { node?: any };
      if (!response.node) {
        logger.error('API did not return a node:', response);
        return;
      }
      const newNode: Node = {
        id: response.node.id.toString(),
        type: 'artefactNode',
        position: { x: response.node.position_x, y: response.node.position_y },
        data: { label: response.node.title, category: 'Polyvalent', type: 'artefact' },
        style: {
          width: response.node.width,
          height: response.node.height,
        },
      };
      setNodes((nds) => [...nds, newNode]);
    } catch (err) {
      logger.error('Failed to create artefact node:', err);
    }
  }, [graphId, setNodes, apiClient]);

  const addDocumentNode = useCallback(async (position?: { x: number; y: number }, chatSessionId?: string) => {
    if (!graphId) {
      logger.warn("No graphId, aborting document node creation");
      return;
    }
    const nodePosition = position || generateRandomPosition();
    try {
      const response = await apiClient.createNodeWithContent(graphId, {
        type: 'artefact',
        position_x: nodePosition.x,
        position_y: nodePosition.y,
        width: NODE_SIZES.DEFAULT_WIDTH,
        height: NODE_SIZES.DEFAULT_HEIGHT,
        title: `Document Node`,
        artefact_type: 'document',
        current_data: {},
      }) as { node?: any; content?: any };
      if (!response.node) {
        logger.error('API did not return a node:', response);
        return;
      }
      const newNode: Node = {
        id: response.node.id.toString(),
        type: 'documentNode',
        position: { x: response.node.position_x, y: response.node.position_y },
        data: { 
          label: response.node.title, 
          category: 'Polyvalent', 
          type: 'document', 
          content: response.node.content,
          artefactId: response.content?.id, // Set the artefact ID from the response
          chatSessionId: chatSessionId,
          isLoading: chatSessionId ? true : false,
        },
        style: {
          width: response.node.width,
          height: response.node.height,
        },
      };
      setNodes((nds) => [...nds, newNode]);
    } catch (err) {
      logger.error('Failed to create document node:', err);
    }
  }, [graphId, setNodes, apiClient]);

  const addDocumentNodeFromChat = useCallback(async (chatSessionId: string, position?: { x: number; y: number }) => {
    if (!graphId) {
      logger.warn("No graphId, aborting document node creation from chat");
      return;
    }
    const nodePosition = position || generateRandomPosition();
    try {
      const response = await apiClient.createNodeWithContent(graphId, {
        type: 'artefact',
        position_x: nodePosition.x,
        position_y: nodePosition.y,
        width: NODE_SIZES.DEFAULT_WIDTH,
        height: NODE_SIZES.DEFAULT_HEIGHT,
        title: `Document from Chat`,
        artefact_type: 'document',
        current_data: {},
      }) as { node?: any; content?: any };
      if (!response.node) {
        logger.error('API did not return a node:', response);
        return;
      }
      const newNode: Node = {
        id: response.node.id.toString(),
        type: 'documentNode',
        position: { x: response.node.position_x, y: response.node.position_y },
        data: { 
          label: response.node.title, 
          category: 'Polyvalent', 
          type: 'document', 
          content: '',
          artefactId: response.content?.id, // Set the artefact ID from the response
          chatSessionId: chatSessionId,
          isLoading: true,
        },
        style: {
          width: response.node.width,
          height: response.node.height,
        },
      };
      setNodes((nds) => [...nds, newNode]);
    } catch (err) {
      logger.error('Failed to create document node from chat:', err);
    }
  }, [graphId, setNodes, apiClient]);

  const addTableNode = useCallback(async (position?: { x: number; y: number }, chatSessionId?: string) => {
    if (!graphId) {
      logger.warn("No graphId, aborting table node creation");
      return;
    }
    const nodePosition = position || generateRandomPosition();
    try {
      const response = await apiClient.createNodeWithContent(graphId, {
        type: 'artefact',
        position_x: nodePosition.x,
        position_y: nodePosition.y,
        width: NODE_SIZES.DEFAULT_WIDTH,
        height: NODE_SIZES.DEFAULT_HEIGHT,
        title: `Table Node`,
        artefact_type: 'table',
        current_data: {},
      }) as { node?: any; content?: any };
      if (!response.node) {
        logger.error('API did not return a node:', response);
        return;
      }
      const newNode: Node = {
        id: response.node.id.toString(),
        type: 'tableNode',
        position: { x: response.node.position_x, y: response.node.position_y },
        data: { 
          label: response.node.title, 
          category: 'Polyvalent', 
          type: 'table', 
          content: response.node.content,
          artefactId: response.content?.id, // Set the artefact ID from the response
          chatSessionId: chatSessionId,
          isLoading: chatSessionId ? true : false,
        },
        style: {
          width: response.node.width,
          height: response.node.height,
        },
      };
      setNodes((nds) => [...nds, newNode]);
    } catch (err) {
      logger.error('Failed to create table node:', err);
    }
  }, [graphId, setNodes, apiClient]);

  const addTableNodeFromChat = useCallback(async (chatSessionId: string, position?: { x: number; y: number }) => {
    if (!graphId) {
      logger.warn("No graphId, aborting table node creation from chat");
      return;
    }
    const nodePosition = position || generateRandomPosition();
    try {
      const response = await apiClient.createNodeWithContent(graphId, {
        type: 'artefact',
        position_x: nodePosition.x,
        position_y: nodePosition.y,
        width: NODE_SIZES.DEFAULT_WIDTH,
        height: NODE_SIZES.DEFAULT_HEIGHT,
        title: `Table from Chat`,
        artefact_type: 'table',
        current_data: {},
      }) as { node?: any; content?: any };
      if (!response.node) {
        logger.error('API did not return a node:', response);
        return;
      }
      const newNode: Node = {
        id: response.node.id.toString(),
        type: 'tableNode',
        position: { x: response.node.position_x, y: response.node.position_y },
        data: { 
          label: response.node.title, 
          category: 'Polyvalent', 
          type: 'table', 
          content: '',
          artefactId: response.content?.id, // Set the artefact ID from the response
          chatSessionId: chatSessionId,
          isLoading: true,
        },
        style: {
          width: response.node.width,
          height: response.node.height,
        },
      };
      setNodes((nds) => [...nds, newNode]);
    } catch (err) {
      logger.error('Failed to create table node from chat:', err);
    }
  }, [graphId, setNodes, apiClient]);

  const addGraphNode = useCallback(async (position?: { x: number; y: number }) => {
    if (!graphId) {
      logger.warn("No graphId, aborting graph node creation");
      return;
    }
    const nodePosition = position || generateRandomPosition();
    try {
      const response = await apiClient.createNodeWithContent(graphId, {
        type: 'artefact',
        position_x: nodePosition.x,
        position_y: nodePosition.y,
        width: NODE_SIZES.DEFAULT_WIDTH,
        height: NODE_SIZES.DEFAULT_HEIGHT,
        title: `Graph Node`,
        artefact_type: 'graph',
        current_data: {},
      }) as { node?: any; content?: any };
      if (!response.node) {
        logger.error('API did not return a node:', response);
        return;
      }
      const newNode: Node = {
        id: response.node.id.toString(),
        type: 'graphNode',
        position: { x: response.node.position_x, y: response.node.position_y },
        data: {
          label: response.node.title,
          category: 'Polyvalent',
          type: 'graph',
          artefactId: response.content?.id, // ensure we keep a stable artefact to update during streaming
        },
        style: {
          width: response.node.width,
          height: response.node.height,
        },
      };
      setNodes((nds) => [...nds, newNode]);
    } catch (err) {
      logger.error('Failed to create graph node:', err);
    }
  }, [graphId, setNodes, apiClient]);

  // React Flow onDelete handler also uses this
  const onDelete = useCallback(
    ({ nodes: deletedNodes, edges: deletedEdges }: { nodes: Node[], edges: any[] }) => {
      deleteSelectedNodesAndEdges(deletedNodes, deletedEdges);
    },
    [deleteSelectedNodesAndEdges]
  );

  const clearFlow = useCallback(async () => {
    setNodes([]);
    edgeManager.clearAllEdges();
    setSelectedNodes([]);
  }, [setNodes, edgeManager]);

  const downloadFlow = useCallback(() => {
    exportFlowData(nodes, edgeManager.edges);
  }, [nodes, edgeManager.edges]);

  const setNodesAndEdges = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    setNodes(newNodes);
    if (edgeManager) {
      edgeManager.setEdges(newEdges);
    }
  }, [setNodes, edgeManager]);

  // Utility: Fetch a single edge (for debugging or future use)


  return {
    nodes,
    edges: edgeManager.edges,
    selectedNodes,
    selectedEdges: edgeManager.selectedEdges,
    hasSelection,
    onNodesChange: onNodesChangeWithLog,
    onEdgesChange: edgeManager.onEdgesChange,
    onConnect,
    onDelete,
    onSelectionChange,
    isValidConnection,
    addChatNode,
    addPDFNode,
    addWebsiteNode,
    addYouTubeNode,
    addInstagramNode,
    addDocumentNode,
    addDocumentNodeFromChat,
    addTableNode,
    addTableNodeFromChat,
    addGraphNode,
    deleteSelected,
    clearFlow,
    downloadFlow,
    edgeManager,
    setNodes,
    setEdges: edgeManager.setEdges,
    setNodesAndEdges,
  };
} 