"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo, memo } from "react";
import Image from "next/image";
import { FlowToolbar } from './flow/ui/FlowToolbar';
import { FlowCanvas } from './flow/ui/FlowCanvas';
import { FullScreenOverlay } from './flow/ui/FullScreenOverlay';
import { FullScreenProvider } from './flow/context/FullScreenContext';
import { ConnectionProvider } from './flow/context/ConnectionContext';
import { useFlowManager } from './flow/hooks/useFlowManager';
import { useResponsiveSize } from './flow/hooks/useResponsiveSize';
import { NODE_SIZES } from './flow/constants';
import { useApiClient } from '@/lib/useApiClient';
import { Node, Edge, ReactFlowProvider, useReactFlow, MarkerType } from '@xyflow/react';
import { NodeLimitDisplay } from './NodeLimitDisplay';

// Types for API responses
interface NodeResponse {
  id: string;
  graph_id: number;
  type: string;
  content_id?: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  title: string;
}

interface EdgeResponse {
  id: string;
  graph_id: number;
  source_node_id: string;
  target_node_id: string;
  type: string;
  source_handle?: string;
  target_handle?: string;
}

interface GraphResponse {
  id: number;
  user_id: number;
  name: string;
  created_at?: string;
  emoji?: string;
  colors?: string;
}

import '@xyflow/react/dist/style.css';

interface WhiteBoardViewProps {
  graphId?: string;
  onBack?: () => void;
}

// Utility functions for deep equality with memoization
const areNodesEqual = (a: Node[], b: Node[]): boolean => {
  if (a.length !== b.length) return false;
  return a.every((node, i) => {
    const nodeA = JSON.stringify(node);
    const nodeB = JSON.stringify(b[i]);
    return nodeA === nodeB;
  });
};

const areEdgesEqual = (a: Edge[], b: Edge[]): boolean => {
  if (a.length !== b.length) return false;
  return a.every((edge, i) => {
    const edgeA = JSON.stringify(edge);
    const edgeB = JSON.stringify(b[i]);
    return edgeA === edgeB;
  });
};

interface FlowContentProps {
  flowManager: ReturnType<typeof useFlowManager>;
  graphName: string;
  onBack?: () => void;
  graphId?: string;
  loadGraph: () => void;
  graphEmoji?: string;
  graphColor?: string | null;
}

const FlowContent: React.FC<FlowContentProps> = memo(({ 
  flowManager, 
  graphName, 
  onBack, 
  graphId, 
  loadGraph, 
  graphEmoji, 
  graphColor 
}) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const { button, buttonIcon, text, padding, gap, emoji } = useResponsiveSize();
  const {
    nodes,
    edges,
    hasSelection,
    onNodesChange,
    onEdgesChange,
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
    addTableNode,
    addGraphNode,
    deleteSelected,
    clearFlow,
    downloadFlow,
  } = flowManager;

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const dropPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Center the node at the drop position by offsetting by half width/height
      const centeredPosition = {
        x: dropPosition.x - NODE_SIZES.DEFAULT_WIDTH / 2,
        y: dropPosition.y - NODE_SIZES.DEFAULT_HEIGHT / 2,
      };

      switch (type) {
        case 'chat':
          addChatNode(centeredPosition);
          break;
        case 'pdf':
          addPDFNode(centeredPosition);
          break;
        case 'website':
          addWebsiteNode(centeredPosition);
          break;
        case 'youtube':
          addYouTubeNode(centeredPosition);
          break;
        case 'instagram':
          addInstagramNode(centeredPosition);
          break;
        case 'document':
          addDocumentNode(centeredPosition);
          break;
        case 'table':
          addTableNode(centeredPosition);
          break;
        case 'graph':
          addGraphNode(centeredPosition);
          break;
        default:
          break;
      }
    },
    [screenToFlowPosition, addChatNode, addPDFNode, addWebsiteNode, addYouTubeNode, addInstagramNode, addDocumentNode, addTableNode, addGraphNode]
  );

  const onTouchDrop = useCallback(
    (event: CustomEvent) => {
      const { nodeType, clientX, clientY } = event.detail;

      if (!nodeType) {
        return;
      }

      const dropPosition = screenToFlowPosition({
        x: clientX,
        y: clientY,
      });

      // Center the node at the drop position by offsetting by half width/height
      const centeredPosition = {
        x: dropPosition.x - NODE_SIZES.DEFAULT_WIDTH / 2,
        y: dropPosition.y - NODE_SIZES.DEFAULT_HEIGHT / 2,
      };

      switch (nodeType) {
        case 'chat':
          addChatNode(centeredPosition);
          break;
        case 'pdf':
          addPDFNode(centeredPosition);
          break;
        case 'website':
          addWebsiteNode(centeredPosition);
          break;
        case 'youtube':
          addYouTubeNode(centeredPosition);
          break;
        case 'instagram':
          addInstagramNode(centeredPosition);
          break;
        case 'document':
          addDocumentNode(centeredPosition);
          break;
        case 'table':
          addTableNode(centeredPosition);
          break;
        case 'graph':
          addGraphNode(centeredPosition);
          break;
        default:
          break;
      }
    },
    [screenToFlowPosition, addChatNode, addPDFNode, addWebsiteNode, addYouTubeNode, addInstagramNode, addDocumentNode, addTableNode, addGraphNode]
  );

  // Add event listener for touch drop events
  useEffect(() => {
    const wrapper = reactFlowWrapper.current;
    if (!wrapper) return;

    const handleTouchDrop = (event: Event) => {
      onTouchDrop(event as CustomEvent);
    };

    wrapper.addEventListener('touchDrop', handleTouchDrop);

    return () => {
      wrapper.removeEventListener('touchDrop', handleTouchDrop);
    };
  }, [onTouchDrop]);

  // Memoize the header component to prevent unnecessary re-renders
  const headerComponent = useMemo(() => (
    <div className={`absolute top-2 left-2 z-10 flex items-center ${gap}
                    pt-safe-top pl-safe-left pr-safe-right`}>
      {onBack && (
        <button
          className={`${button} flex items-center justify-center 
                     rounded-full bg-white/90 backdrop-blur-sm border border-gray-300 
                     shadow-lg hover:bg-white/95 hover:shadow-xl transition-all duration-200 
                     cursor-pointer`}
          onClick={onBack}
        >
          <svg 
            className={`${buttonIcon} text-gray-700`}
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      <div className={`flex items-center ${gap}`}>
        <div 
          className={`flex items-center ${gap} ${padding} 
                     shadow-lg backdrop-blur-sm min-w-0`}
          style={{
            backgroundColor: graphColor ? 
              graphColor.replace('rgb(', 'rgba(').replace(')', ', 0.15)') : 
              'rgba(255, 255, 255, 0.9)',
            border: graphColor ? 
              `1px solid ${graphColor.replace('rgb(', 'rgba(').replace(')', ', 0.05)')}` : 
              '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '0.25rem',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)'
          }}
        >
          <div 
            className={`${emoji} flex items-center justify-center 
                       shadow-md backdrop-blur-md flex-shrink-0`}
            style={{
              backgroundColor: graphColor ? 
                graphColor.replace('rgb(', 'rgba(').replace(')', ', 0.1)') : 
                'rgba(255, 255, 255, 0.4)',
              backdropFilter: 'blur(20px) saturate(180%)',
              border: graphColor ? 
                `1px solid ${graphColor.replace('rgb(', 'rgba(').replace(')', ', 0.03)')}` : 
                '1px solid rgba(255, 255, 255, 0.15)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              borderRadius: '0.25rem'
            }}
          >
            <span className={text}>{graphEmoji || "📋"}</span>
          </div>
          <h1 className={`${text} font-semibold text-black truncate min-w-0 max-w-[150px] sm:max-w-[200px]`}>
            {graphName}
          </h1>
        </div>
      </div>
    </div>
  ), [onBack, graphColor, graphEmoji, graphName, button, buttonIcon, text, padding, gap, emoji]);

  // Memoize the mobile toolbar component
  const mobileToolbarComponent = useMemo(() => (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 
                    max-h-[500px]:bottom-16 max-h-[500px]:left-1/2 max-h-[500px]:-translate-x-1/2
                    z-20 md:hidden">
      <div className="flex flex-col items-center space-y-2">
        <NodeLimitDisplay currentNodeCount={nodes.length} className="text-center" />
        <FlowToolbar
          onClearFlow={clearFlow}
          onDownloadFlow={downloadFlow}
          onDeleteSelected={async () => { await deleteSelected(); }}
          hasSelection={hasSelection}
          orientation="horizontal"
          graphColor={graphColor}
          currentNodeCount={nodes.length}
        />
      </div>
    </div>
  ), [clearFlow, downloadFlow, deleteSelected, hasSelection, graphColor, nodes.length]);

  // Memoize the desktop toolbar component
  const desktopToolbarComponent = useMemo(() => (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 hidden md:block">
      <div className="flex flex-col items-center space-y-2">
        <NodeLimitDisplay currentNodeCount={nodes.length} className="text-center" />
        <FlowToolbar
          onClearFlow={clearFlow}
          onDownloadFlow={downloadFlow}
          onDeleteSelected={async () => { await deleteSelected(); }}
          hasSelection={hasSelection}
          orientation="vertical"
          graphColor={graphColor}
          currentNodeCount={nodes.length}
        />
      </div>
    </div>
  ), [clearFlow, downloadFlow, deleteSelected, hasSelection, graphColor, nodes.length]);
  
  return (
    <div className="relative w-full h-screen bg-gray-50 
                    overflow-hidden
                    min-h-[100vh] min-h-[100dvh]" 
         ref={reactFlowWrapper}>
      {headerComponent}

      {mobileToolbarComponent}
      {desktopToolbarComponent}

      {/* Flow Canvas */}
      <div className="w-full h-full">
        <FlowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDelete={onDelete}
          onSelectionChange={onSelectionChange}
          isValidConnection={isValidConnection}
          onDragOver={onDragOver}
          onDrop={onDrop}
        />
      </div>

      {/* Edge Type Selection Modal */}

    </div>
  );
});

FlowContent.displayName = 'FlowContent';

export function WhiteBoardView({ graphId, onBack }: WhiteBoardViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [graphName, setGraphName] = useState("Untitled Board");
  const [graphEmoji, setGraphEmoji] = useState("📋");
  const [graphColor, setGraphColor] = useState<string | null>(null);
  const apiClient = useApiClient();
  const [initialNodes, setInitialNodes] = useState<Node[] | undefined>(undefined);
  const [initialEdges, setInitialEdges] = useState<Edge[] | undefined>(undefined);

  // Create initial flow data - this must be stable
  const initialFlowData = useMemo(() => {
    if (initialNodes && initialEdges) {
      return { nodes: initialNodes, edges: initialEdges };
    }
    return undefined;
  }, [initialNodes, initialEdges]);

  // Call useFlowManager with stable data - this must be called unconditionally
  const flowManager = useFlowManager(initialFlowData, graphId);
  
  const { setNodesAndEdges, nodes, edges } = flowManager;
  
  // Create a stable reference for the loadGraph function with better error handling
  const loadGraph = useCallback(async () => {
    if (!graphId) return;

    setLoading(true);
    setError(null);
    
    try {
      // Load graph metadata and nodes in parallel for better performance
      const [graph, dbNodes, dbEdges] = await Promise.all([
        apiClient.getGraph(graphId) as Promise<GraphResponse>,
        apiClient.listNodes(graphId) as Promise<NodeResponse[]>,
        apiClient.listEdges(graphId) as Promise<EdgeResponse[]>, // Fetch edges here
      ]);
      
      setGraphName(graph.name);
      setGraphEmoji(graph.emoji || "📋");
      setGraphColor(graph.colors || null);

      // Create a lookup map for node properties (type and content_id)
      const nodeLookup = new Map<string, { type: string; content_id?: string; }>();
      dbNodes.forEach(node => {
        nodeLookup.set(node.id, { type: node.type, content_id: node.content_id });
      });

      // Map to store chatSessionId for artefact nodes if connected
      const artefactChatConnections = new Map<string, string>(); // Map<artefactNodeId, chatSessionId>

      dbEdges.forEach(edge => {
        const sourceNodeInfo = nodeLookup.get(edge.source_node_id);
        const targetNodeInfo = nodeLookup.get(edge.target_node_id);

        // Check if it's a chat node connected to an artefact/document/table/graph node
        if (sourceNodeInfo?.type === 'chat' && 
            (targetNodeInfo?.type === 'artefact' || targetNodeInfo?.type === 'document' || targetNodeInfo?.type === 'table' || targetNodeInfo?.type === 'graph')) {
          if (sourceNodeInfo.content_id) { // Chat's content_id is its chatSessionId
            artefactChatConnections.set(edge.target_node_id, sourceNodeInfo.content_id);
          }
        }
      });
      
      // Convert database nodes to flow nodes with better error handling
      const flowNodes: Node[] = await Promise.all(dbNodes.map(async (dbNode: NodeResponse) => {
        let nodeType = 'defaultNode';
        let nodeData: any = { label: dbNode.title };

        // Inject chatSessionId if an existing connection is found
        const connectedChatSessionId = artefactChatConnections.get(dbNode.id);

        if (dbNode.type === 'asset' && dbNode.content_id) {
          try {
            const assetContent: any = await apiClient.getAsset(graphId, String(dbNode.content_id));
            switch (assetContent.type) {
              case 'youtube':
                nodeType = 'youtubeNode';
                nodeData = {
                  label: dbNode.title,
                  type: 'youtube',
                  category: 'Data source',
                  url: assetContent.source,
                  content_id: String(dbNode.content_id),
                  transcript: assetContent.transcript,
                  graph_id: String(graphId),
                };
                break;
              case 'instagram':
                nodeType = 'instagramNode';
                nodeData = {
                  label: dbNode.title,
                  type: 'instagram',
                  category: 'Data source',
                  url: assetContent.source,
                  content_id: String(dbNode.content_id),
                  transcript: assetContent.transcript,
                  graph_id: String(graphId),
                };
                break;
              case 'pdf':
                nodeType = 'pdfNode';
                nodeData = {
                  label: dbNode.title,
                  type: 'pdf',
                  category: 'Data source',
                  url: assetContent.source,
                  content_id: String(dbNode.content_id),
                  graphId: String(graphId)
                };
                break;
              case 'website':
                nodeType = 'websiteNode';
                nodeData = {
                  label: dbNode.title,
                  type: 'website',
                  category: 'Data source',
                  url: assetContent.source,
                  graph_id: String(graphId),
                  content_id: String(dbNode.content_id),
                  is_placeholder: !assetContent.extracted_text,
                };
                break;
              case 'video':
              default:
                nodeType = 'videoNode';
                nodeData = {
                  label: dbNode.title,
                  type: 'video',
                  category: 'Data source',
                  url: assetContent.source
                };
                break;
            }
          } catch (err) {
            // Fallback to generic asset node if asset fetch fails
            nodeType = 'pdfNode';
            nodeData = {
              label: dbNode.title,
              type: 'pdf',
              category: 'Data source'
            };
          }
        } else if (dbNode.type === 'chat') { // Handle chat nodes outside the asset block
          if (dbNode.content_id) {
            nodeType = 'chatNode';
            nodeData = {
              label: dbNode.title,
              type: 'chat',
              category: 'Polyvalent',
              content_id: dbNode.content_id,
              chatSessionId: dbNode.content_id, // Ensure chat nodes also have chatSessionId
            };
          }
        } else if (dbNode.type === 'artefact') { // Handle artefact nodes (document, table, graph)
          let artefactType = 'artefact';
          let artefactContent: any = undefined;
          if (dbNode.content_id) {
            try {
              artefactContent = await apiClient.getArtefact(dbNode.content_id);
              artefactType = artefactContent.type;
            } catch (err) {
              // fallback to generic artefact
            }
          }
          if (artefactType === 'document') {
            nodeType = 'documentNode';
            nodeData = {
              label: dbNode.title,
              type: 'document',
              category: 'Polyvalent',
              artefactId: dbNode.content_id,
              content: artefactContent?.current_data?.markdown || '',
              // Pass processing options from database to enable modal persistence
              processingOptions: artefactContent?.processing_options,
              selectedProcessingOption: artefactContent?.selected_processing_option,
              processingOutputType: artefactContent?.processing_output_type,
              // Only pass chatSessionId if there's no existing content to prevent regeneration
              chatSessionId: !artefactContent?.current_data?.markdown ? connectedChatSessionId : undefined,
            };
          } else if (artefactType === 'table') {
            nodeType = 'tableNode';
            nodeData = {
              label: dbNode.title,
              type: 'table',
              category: 'Polyvalent',
              artefactId: dbNode.content_id,
              content: artefactContent?.current_data?.table_json || '',
              // Pass processing options from database to enable modal persistence
              processingOptions: artefactContent?.processing_options,
              selectedProcessingOption: artefactContent?.selected_processing_option,
              processingOutputType: artefactContent?.processing_output_type,
              // Only pass chatSessionId if there's no existing content to prevent regeneration
              chatSessionId: !artefactContent?.current_data?.table_json ? connectedChatSessionId : undefined,
            };
          } else if (artefactType === 'graph') {
            // Properly map graph artefacts to graph nodes so GraphNodeContent can load mermaid
            nodeType = 'graphNode';
            nodeData = {
              label: dbNode.title,
              type: 'graph',
              category: 'Polyvalent',
              artefactId: dbNode.content_id,
              content: artefactContent?.current_data?.mermaid || '',
              // Pass processing options from database to enable modal persistence
              processingOptions: artefactContent?.processing_options,
              selectedProcessingOption: artefactContent?.selected_processing_option,
              processingOutputType: artefactContent?.processing_output_type,
              // Only pass chatSessionId if there's no existing content to prevent regeneration
              chatSessionId: !artefactContent?.current_data?.mermaid ? connectedChatSessionId : undefined,
            };
          } else {
            // Fallback to a generic artefact node
            nodeType = 'artefactNode';
            nodeData = {
              label: dbNode.title,
              type: 'artefact',
              category: 'Data source',
              artefactId: dbNode.content_id,
              // Pass processing options from database to enable modal persistence
              processingOptions: artefactContent?.processing_options,
              selectedProcessingOption: artefactContent?.selected_processing_option,
              processingOutputType: artefactContent?.processing_output_type,
              // Don't pass chatSessionId for generic artefacts to prevent unwanted regeneration
              chatSessionId: undefined,
            };
          }
        }
        
        return {
          id: dbNode.id.toString(),
          type: nodeType,
          position: { x: dbNode.position_x, y: dbNode.position_y },
          data: nodeData,
          style: {
            width: dbNode.width,
            height: dbNode.height,
          },
        };
      }));
      
      // Convert database edges to flow edges (no change to this part)
      const flowEdges: Edge[] = dbEdges.map((dbEdge: EdgeResponse) => ({
        id: dbEdge.id.toString(),
        source: dbEdge.source_node_id.toString(),
        target: dbEdge.target_node_id.toString(),
        type: 'labeledEdge',
        sourceHandle: dbEdge.source_handle || null,
        targetHandle: dbEdge.target_handle || null,
        data: {
          type: 'custom',
          label: '',
        },
        animated: true,
        style: {
          stroke: '#374151',
          strokeWidth: 4,
          strokeDasharray: '5,5',
        },
        markerEnd: {
          type: MarkerType.Arrow,
          width: 24,
          height: 24,
          color: '#374151',
        },
      }));
      
      setInitialNodes(flowNodes);
      setInitialEdges(flowEdges);
      
      // Only update if nodes or edges actually changed
      if (!areNodesEqual(nodes, flowNodes) || !areEdgesEqual(edges, flowEdges)) {
        setNodesAndEdges(flowNodes, flowEdges);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load graph');
    } finally {
      setLoading(false);
    }
  }, [graphId, setNodesAndEdges, apiClient, nodes, edges]);

  // Load graph data when component mounts or graphId changes
  useEffect(() => {
    loadGraph();
  }, [graphId]);

  // Memoize loading and error states
  const loadingComponent = useMemo(() => (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading board...</p>
      </div>
    </div>
  ), []);

  const errorComponent = useMemo(() => (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Go Back
        </button>
      </div>
    </div>
  ), [error, onBack]);

  if (loading) {
    return loadingComponent;
  }

  if (error) {
    return errorComponent;
  }

  return (
    <FullScreenProvider>
      <ReactFlowProvider>
        <ConnectionProvider>
          <FlowContent 
            flowManager={flowManager}
            graphName={graphName}
            onBack={onBack}
            graphId={graphId}
            loadGraph={loadGraph}
            graphEmoji={graphEmoji}
            graphColor={graphColor}
          />
          <FullScreenOverlay />
        </ConnectionProvider>
      </ReactFlowProvider>
    </FullScreenProvider>
  );
} 