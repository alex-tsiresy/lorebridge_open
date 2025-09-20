"use client";

import React, { useState, memo } from "react";
import {
  Handle,
  Position,
  NodeProps,
  NodeResizer,
  useReactFlow,
} from '@xyflow/react';
import { TableNodeData } from '../types';
import { NODE_COLORS, NODE_SIZES } from '../constants';
import { calculateHandleStyle, calculateHoverHandleStyle } from '../utils';
import { TableNodeContent } from './TableNodeContent';
import { useNodeClickHandler } from '../hooks/useNodeClickHandler';
import { useConnection } from '../context/ConnectionContext';
import { getStickyNoteStyle } from '../utils';

export const TableNode = memo(({ id, data, isConnectable, selected }: NodeProps) => {
  const { getZoom } = useReactFlow();
  const zoom = getZoom();
  const { handleClick } = useNodeClickHandler(id);
  const { isHandleNearCursor } = useConnection();
  const nodeData = data as unknown as TableNodeData;
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null);
  
  
  // Memoize handle styles to prevent unnecessary recalculations
  const getHandleStyle = (handleId: string) => {
    const color = NODE_COLORS.TABLE.handle;
    
    const baseStyle = hoveredHandle === handleId 
      ? calculateHoverHandleStyle(zoom, color)
      : calculateHandleStyle(zoom, color);
    
    // Show handle if:
    // 1. Node is selected, OR
    // 2. Creating a connection (all handles visible)
    const shouldShowHandle = selected || isHandleNearCursor(id, handleId);
    
    // Hide handle unless conditions are met
    if (!shouldShowHandle) {
      return { ...baseStyle, opacity: 0, pointerEvents: 'none' as const };
    }
    
    return baseStyle;
  };

  const stickyNoteStyle = getStickyNoteStyle('TABLE', selected);
  
  // Override styling to remove background and shadows for TableNode
  const tableNodeStyle = {
    ...stickyNoteStyle.style,
    backgroundColor: 'transparent',
    boxShadow: 'none',
    backgroundImage: 'none',
  };

  return (
    <div 
      className="w-full h-full relative" 
      style={{ 
        ...tableNodeStyle,
        minWidth: `${NODE_SIZES.MIN_WIDTH}px`, 
        minHeight: `${NODE_SIZES.MIN_HEIGHT}px` 
      }}
      onClick={handleClick}
    >
      <NodeResizer
        color={NODE_COLORS.TABLE.border}
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
          border: `2px solid ${NODE_COLORS.TABLE.border}`,
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
          ...getHandleStyle('top'),
          position: 'absolute',
          left: '50%',
          top: 0,
          transform: 'translate(-50%, -50%)',
        }}
        onMouseEnter={() => setHoveredHandle('top')}
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
          ...getHandleStyle('left'),
          position: 'absolute',
          left: 0,
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        onMouseEnter={() => setHoveredHandle('left')}
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
          ...getHandleStyle('right'),
          position: 'absolute',
          right: 0,
          top: '50%',
          transform: 'translate(50%, -50%)',
        }}
        onMouseEnter={() => setHoveredHandle('right')}
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
          ...getHandleStyle('bottom'),
          position: 'absolute',
          left: '50%',
          bottom: 0,
          transform: 'translate(-50%, 50%)',
        }}
        onMouseEnter={() => setHoveredHandle('bottom')}
        onMouseLeave={() => setHoveredHandle(null)}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="bottom-target"
        isConnectable={isConnectable}
        style={{ opacity: 0, width: '24px', height: '24px', position: 'absolute', left: '50%', bottom: 0, transform: 'translate(-50%, 50%)' }}
      />
      
      {/* Table Content */}
      <div className="w-full h-full relative z-10" style={{ padding: '50px' }}>
        <TableNodeContent 
          nodeId={id}
          nodeData={nodeData}
          selected={selected}
        />
      </div>
    </div>
  );
});

TableNode.displayName = 'TableNode'; 