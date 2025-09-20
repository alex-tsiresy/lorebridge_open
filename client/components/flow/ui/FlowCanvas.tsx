"use client";

import React, { memo, useMemo, useEffect, useState, useRef, useCallback } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  Node,
  Edge,
  Connection,
  OnNodesChange,
  OnEdgesChange,
  OnSelectionChangeParams,
  ConnectionLineComponent,
  ConnectionMode,
  getBezierPath,
  ReactFlowInstance,
} from '@xyflow/react';
import { nodeTypes } from '../nodes';
import { edgeTypes } from '../edges';
import { BACKGROUND_CONFIG, CONNECTION_LINE_CONFIG } from '../constants';

interface FlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: (connection: Connection) => void;
  onDelete: (elements: { nodes: Node[], edges: Edge[] }) => void;
  onSelectionChange: (params: OnSelectionChangeParams) => void;
  isValidConnection: (edge: Edge | Connection) => boolean;
  onDragOver: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
}

// Memoized custom connection line component for better performance
const CustomConnectionLine: ConnectionLineComponent = memo(({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
}) => {
  const [edgePath] = useMemo(() => getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: toX,
    targetY: toY,
    targetPosition: toPosition,
  }), [fromX, fromY, toX, toY, fromPosition, toPosition]);

  return (
    <g>
      {/* Shadow path for better visibility */}
      <path
        fill="none"
        stroke="rgba(0,0,0,0.1)"
        strokeWidth={CONNECTION_LINE_CONFIG.style.strokeWidth + 4}
        strokeDasharray={CONNECTION_LINE_CONFIG.style.strokeDasharray}
        d={edgePath}
        transform="translate(1,1)"
      />
      {/* Main connection line */}
      <path
        fill="none"
        stroke={CONNECTION_LINE_CONFIG.style.stroke}
        strokeWidth={CONNECTION_LINE_CONFIG.style.strokeWidth + 2}
        strokeDasharray={CONNECTION_LINE_CONFIG.style.strokeDasharray}
        d={edgePath}
      />

    </g>
  );
});

CustomConnectionLine.displayName = 'CustomConnectionLine';

export const FlowCanvas = memo(({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onDelete,
  onSelectionChange,
  isValidConnection,
  onDragOver,
  onDrop,
}: FlowCanvasProps) => {
  // Check if we're on a mobile device or in landscape mode
  const [isMobile, setIsMobile] = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const hasInitiallyFitted = useRef(false);
  const nodesRef = useRef(nodes);
  
  // Keep nodes ref updated
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    const checkIsMobile = () => {
      const isSmallScreen = window.innerWidth < 768;
      const isLandscape = window.innerHeight < 500; // Landscape/short screen detection
      setIsMobile(isSmallScreen || isLandscape);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  // Helper function to perform fitView
  const performFitView = useCallback((instance: ReactFlowInstance) => {
    if (!hasInitiallyFitted.current) {
      hasInitiallyFitted.current = true;
      setTimeout(() => {
        instance.fitView({
          padding: 0.1,
          minZoom: 0.1,
          maxZoom: 1.2,
          duration: 200,
        });
      }, 100);
    }
  }, []);

  // Handle React Flow initialization - more performance-friendly than useReactFlow
  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
    // Try to fit view if nodes are already available
    if (nodesRef.current.length > 0) {
      performFitView(instance);
    }
  }, [performFitView]);

  // Fit view when nodes become available (if instance is already ready)
  useEffect(() => {
    if (nodes.length > 0 && reactFlowInstance.current) {
      performFitView(reactFlowInstance.current);
    }
  }, [nodes.length, performFitView]);

  // Memoize nodeTypes and edgeTypes to prevent unnecessary re-renders
  const memoizedNodeTypes = useMemo(() => nodeTypes, []);
  const memoizedEdgeTypes = useMemo(() => edgeTypes, []);

  return (
    <div className="w-full h-full relative rounded-lg overflow-hidden border border-gray-200 shadow-sm">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDelete={onDelete}
        onSelectionChange={onSelectionChange}
        isValidConnection={isValidConnection}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onInit={onInit}
        nodeTypes={memoizedNodeTypes}
        edgeTypes={memoizedEdgeTypes}
        connectionLineComponent={CustomConnectionLine}
        connectionLineStyle={CONNECTION_LINE_CONFIG.style}
        connectionRadius={30}
        snapToGrid={true}
        snapGrid={[15, 15]}
        className="w-full h-full"
        multiSelectionKeyCode="Shift"
        deleteKeyCode="Delete"
        selectNodesOnDrag={false}
        connectionMode={ConnectionMode.Loose}
        noWheelClassName="nowheel"
        minZoom={0.1}
        // Performance optimizations
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
        zoomOnScroll={true}
        zoomActivationKeyCode="Control"
        panOnScroll={false}
        zoomOnPinch={true}
        zoomOnDoubleClick={true}
        preventScrolling={false}
        panOnDrag={true}
      >
        {!isMobile && <Controls className="react-flow-controls-dark" />}
        {showMinimap && (
          <MiniMap 
            className="!bottom-20 md:!bottom-4 max-h-[500px]:!bottom-28"
            nodeStrokeWidth={3}
            nodeColor={(node) => {
              switch (node.type) {
                case 'chatNode': return '#3b82f6';
                case 'pdfNode': return '#10b981';
                case 'websiteNode': return '#8b5cf6';
                case 'youtubeNode': return '#ef4444';
                case 'instagramNode': return '#ec4899';
                case 'documentNode': return '#3b82f6';
                case 'tableNode': return '#059669';
                case 'graphNode': return '#7c3aed';
                default: return '#6b7280';
              }
            }}
          />
        )}
        <Background 
          variant={BACKGROUND_CONFIG.variant}
          gap={BACKGROUND_CONFIG.gap}
          size={BACKGROUND_CONFIG.size}
        />
      </ReactFlow>
      
      {/* Floating Minimap Toggle Button */}
      <button
        onClick={() => setShowMinimap(!showMinimap)}
        className={`absolute top-2 right-2 sm:top-4 sm:right-4 z-10
                   w-8 h-8 sm:w-10 sm:h-10 rounded-full shadow-lg border border-gray-300
                   flex items-center justify-center transition-all duration-200
                   ${showMinimap 
                     ? 'bg-blue-500 text-white hover:bg-blue-600' 
                     : 'bg-white/90 backdrop-blur-sm text-gray-600 hover:bg-white/95'
                   }`}
        title={showMinimap ? "Hide minimap" : "Show minimap"}
      >
        <svg 
          className="w-4 h-4 sm:w-5 sm:h-5" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" 
          />
        </svg>
      </button>
    </div>
  );
});

FlowCanvas.displayName = 'FlowCanvas'; 