"use client";

import React, { useState, memo, useEffect } from "react";
import {
  Handle,
  Position,
  NodeProps,
  NodeResizer,
  useReactFlow,
} from '@xyflow/react';
import { NodeData } from '../types';
import { NODE_COLORS, NODE_SIZES } from '../constants';
import { getStickyNoteStyle, calculateHandleStyle, calculateHoverHandleStyle } from '../utils';
import { ChatProvider } from '../context/ChatContext';
import { ChatComponent } from '../../ChatComponent';
import { FullScreenButton } from '../ui/FullScreenButton';
import { useFullScreen } from '../context/FullScreenContext';
import { useConnection } from '../context/ConnectionContext';
import { useNodeClickHandler } from '../hooks/useNodeClickHandler';
import { logger } from '@/lib/logger';

export const ChatNode = memo(({ data, isConnectable, selected, id }: NodeProps) => {
  const { fullScreenNodeId, setFullScreenNodeId } = useFullScreen();
  const { handleClick } = useNodeClickHandler(id);
  const { getZoom } = useReactFlow();
  const { isHandleNearCursor } = useConnection();
  const nodeData = data as unknown as NodeData & { content_id?: string };
  
  // Handle hover states
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null);
  
  // Memoize handle styles to prevent unnecessary recalculations
  const getHandleStyle = (handleId: string) => {
    const color = NODE_COLORS.CHAT.handle;
    
    // Show handle if:
    // 1. Node is selected, OR
    // 2. Creating a connection (all handles visible)
    const shouldShowHandle = selected || isHandleNearCursor(id, handleId);
    
    const baseStyle = hoveredHandle === handleId 
      ? calculateHoverHandleStyle(zoom, color)
      : calculateHandleStyle(zoom, color);
    
    // Hide handle unless conditions are met
    if (!shouldShowHandle) {
      return { ...baseStyle, opacity: 0, pointerEvents: 'none' as const };
    }
    
    return baseStyle;
  };

  const zoom = getZoom();
  const stickyNoteStyle = getStickyNoteStyle('CHAT', selected);
  
  // Override styling to remove background and shadows for ChatNode
  const chatNodeStyle = {
    ...stickyNoteStyle.style,
    backgroundColor: 'transparent',
    boxShadow: 'none',
    backgroundImage: 'none',
  };

  // Ensure we have a valid sessionId - use node id as fallback if content_id is not available
  const sessionId = nodeData.content_id || `chat-node-${id}`;

  // Handle escape key to exit full screen
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && fullScreenNodeId === id) {
        logger.log('🔄 ESCAPE FULLSCREEN:', { nodeId: id });
        setFullScreenNodeId(null);
      }
    };

    // Only add listener if this node is in full screen
    if (fullScreenNodeId === id) {
      window.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [fullScreenNodeId, id, setFullScreenNodeId]);

  return (
    <ChatProvider sessionId={sessionId}>
      {/* Floating Full Screen Button - positioned above the entire node - only visible when selected */}
      {selected && (
        <div className="absolute -top-32 left-1/2 transform -translate-x-1/2 scale-150 z-30">
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-1">
            <FullScreenButton nodeId={id} />
          </div>
        </div>
      )}
      
      {/* Container with standardized styling */}
      <div 
        className={stickyNoteStyle.className}
        style={{ 
          ...chatNodeStyle,
          minWidth: `${NODE_SIZES.MIN_WIDTH}px`, 
          minHeight: `${NODE_SIZES.MIN_HEIGHT}px` 
        }}
        onClick={handleClick}
      >
        <NodeResizer
          color={NODE_COLORS.CHAT.border}
          isVisible={selected}
          minWidth={NODE_SIZES.MIN_WIDTH}
          minHeight={NODE_SIZES.MIN_HEIGHT}
          maxWidth={NODE_SIZES.MAX_WIDTH}
          maxHeight={NODE_SIZES.MAX_HEIGHT}
          keepAspectRatio={false}
          handleStyle={{
            width: '16px',
            height: '16px',
            backgroundColor: '#ffffff',
            border: `2px solid ${NODE_COLORS.CHAT.border}`,
            borderRadius: '3px',
          }}
        />
        
        {/* Top Handles - both source and target at same position */}
        <Handle
          type="source"
          position={Position.Top}
          id="top-source"
          isConnectable={isConnectable}
          style={{
            ...getHandleStyle('top-source'),
            position: 'absolute',
            left: '50%',
            top: 0,
            transform: 'translate(-50%, -50%)',
          }}
          onMouseEnter={() => setHoveredHandle('top-source')}
          onMouseLeave={() => setHoveredHandle(null)}
        />
        <Handle
          type="target"
          position={Position.Top}
          id="top-target"
          isConnectable={isConnectable}
          style={{ opacity: 0, width: '24px', height: '24px', position: 'absolute', left: '50%', top: 0, transform: 'translate(-50%, -50%)' }}
        />
        
        {/* Left Handles - both source and target at same position */}
        <Handle
          type="source"
          position={Position.Left}
          id="left-source"
          isConnectable={isConnectable}
          style={{
            ...getHandleStyle('left-source'),
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
          onMouseEnter={() => setHoveredHandle('left-source')}
          onMouseLeave={() => setHoveredHandle(null)}
        />
        <Handle
          type="target"
          position={Position.Left}
          id="left-target"
          isConnectable={isConnectable}
          style={{ opacity: 0, width: '24px', height: '24px', position: 'absolute', left: 0, top: '50%', transform: 'translate(-50%, -50%)' }}
        />
        
        {/* Right Handles - both source and target at same position */}
        <Handle
          type="source"
          position={Position.Right}
          id="right-source"
          isConnectable={isConnectable}
          style={{
            ...getHandleStyle('right-source'),
            position: 'absolute',
            right: 0,
            top: '50%',
            transform: 'translate(50%, -50%)',
          }}
          onMouseEnter={() => setHoveredHandle('right-source')}
          onMouseLeave={() => setHoveredHandle(null)}
        />
        <Handle
          type="target"
          position={Position.Right}
          id="right-target"
          isConnectable={isConnectable}
          style={{ opacity: 0, width: '24px', height: '24px', position: 'absolute', right: 0, top: '50%', transform: 'translate(50%, -50%)' }}
        />
        
        {/* Bottom Handles - both source and target at same position */}
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom-source"
          isConnectable={isConnectable}
          style={{
            ...getHandleStyle('bottom-source'),
            position: 'absolute',
            left: '50%',
            bottom: 0,
            transform: 'translate(-50%, 50%)',
          }}
          onMouseEnter={() => setHoveredHandle('bottom-source')}
          onMouseLeave={() => setHoveredHandle(null)}
        />
        <Handle
          type="target"
          position={Position.Bottom}
          id="bottom-target"
          isConnectable={isConnectable}
          style={{ opacity: 0, width: '24px', height: '24px', position: 'absolute', left: '50%', bottom: 0, transform: 'translate(-50%, 50%)' }}
        />

        
        {/* Chat component with sticky note styling */}
        <div className="w-full h-full relative z-10" style={{ padding: '50px' }}>
          <ChatComponent 
            sessionId={sessionId}
            stickyNoteStyle={stickyNoteStyle}
            selected={selected}
          />
        </div>
      </div>
    </ChatProvider>
  );
});

ChatNode.displayName = 'ChatNode'; 