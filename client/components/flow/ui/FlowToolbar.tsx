"use client";

import React from "react";
import { MessageSquare, FileText, Globe, Youtube, Trash2, Table, BarChart2 } from "lucide-react";
import { ToolbarProps } from '../types';
import { useResponsiveSize } from '../hooks/useResponsiveSize';
import { useUserLimits } from '@/lib/useUserLimits';
import { logger } from '@/lib/logger';

const onDragStart = (event: React.DragEvent, nodeType: string) => {
  event.dataTransfer.setData('application/reactflow', nodeType);
  event.dataTransfer.effectAllowed = 'move';
};

const onTouchStart = (event: React.TouchEvent, nodeType: string) => {
  const touch = event.touches[0];
  const element = event.currentTarget as HTMLElement;
  
  // Store the node type on the element for later retrieval
  element.setAttribute('data-node-type', nodeType);
  
  // Store initial touch position
  element.setAttribute('data-start-x', touch.clientX.toString());
  element.setAttribute('data-start-y', touch.clientY.toString());
  
  // Only prevent default for the toolbar button, not the canvas
  event.stopPropagation();
};

const onTouchMove = (event: React.TouchEvent) => {
  const touch = event.touches[0];
  const element = event.currentTarget as HTMLElement;
  
  const startX = parseInt(element.getAttribute('data-start-x') || '0');
  const startY = parseInt(element.getAttribute('data-start-y') || '0');
  
  // Only start drag behavior if touch has moved significantly
  const deltaX = Math.abs(touch.clientX - startX);
  const deltaY = Math.abs(touch.clientY - startY);
  
  if (deltaX > 5 || deltaY > 5) {
    // Add visual feedback for drag
    element.style.opacity = '0.7';
    element.style.transform = 'scale(1.1)';
    // Only prevent default when we're actually dragging a toolbar item
    event.preventDefault();
  }
  
  event.stopPropagation();
};

const onTouchEnd = (event: React.TouchEvent) => {
  const element = event.currentTarget as HTMLElement;
  const nodeType = element.getAttribute('data-node-type');
  
  // Reset visual feedback
  element.style.opacity = '';
  element.style.transform = '';
  
  if (!nodeType) return;
  
  const touch = event.changedTouches[0];
  const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
  
  if (dropTarget) {
    // Find the closest flow canvas or drop zone
    const flowCanvas = dropTarget.closest('.react-flow__renderer') || 
                      dropTarget.closest('[data-testid="rf__wrapper"]') ||
                      dropTarget.closest('.react-flow');
    
    if (flowCanvas) {
      // Dispatch a custom event that the parent can listen to
      const customEvent = new CustomEvent('touchDrop', {
        detail: {
          nodeType,
          clientX: touch.clientX,
          clientY: touch.clientY,
        },
        bubbles: true,
      });
      
      flowCanvas.dispatchEvent(customEvent);
    }
  }
  
  // Clean up attributes
  element.removeAttribute('data-node-type');
  element.removeAttribute('data-start-x');
  element.removeAttribute('data-start-y');
};

export function FlowToolbar({
  onClearFlow,
  onDownloadFlow,
  onDeleteSelected,
  hasSelection,
  orientation = 'vertical',
  graphColor,
  currentNodeCount
}: ToolbarProps) {
  const isHorizontal = orientation === 'horizontal';
  const { toolbarButton: buttonSizeClass, toolbarIcon: iconSizeClass } = useResponsiveSize();
  const { canCreateNode, getNodeLimitMessage, isProUser } = useUserLimits();

  // Check if user can create nodes
  const canCreate = canCreateNode(undefined, currentNodeCount);
  const buttonClass = (baseClass: string) => 
    canCreate 
      ? baseClass 
      : `${baseClass} opacity-50 cursor-not-allowed`;

  const handleNodeDrag = (event: React.DragEvent, nodeType: string) => {
    if (!canCreate) {
      event.preventDefault();
      alert(getNodeLimitMessage() + (!isProUser ? " Upgrade to Pro for unlimited nodes." : ""));
      return;
    }
    onDragStart(event, nodeType);
  };

  const handleNodeTouch = (event: React.TouchEvent, nodeType: string) => {
    if (!canCreate) {
      alert(getNodeLimitMessage() + (!isProUser ? " Upgrade to Pro for unlimited nodes." : ""));
      return;
    }
    onTouchStart(event, nodeType);
  };
  
  return (
    <div 
      className={`shadow-2xl backdrop-blur-sm max-w-fit
                  ${isHorizontal 
                    ? 'p-2 flex flex-row space-x-2 space-y-0' 
                    : 'p-2 flex flex-col space-y-2 space-x-0'
                  }`}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        borderRadius: '0.25rem',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'
      }}>
      {/* Data Sources */}
      <div className={isHorizontal 
        ? 'flex flex-row space-x-1 space-y-0' 
        : 'flex flex-col space-y-1 space-x-0'
      }>
        <button
          onDragStart={(event) => handleNodeDrag(event, 'pdf')}
          onTouchStart={(event) => handleNodeTouch(event, 'pdf')}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          draggable={canCreate}
          className={buttonClass(`${buttonSizeClass} flex items-center justify-center rounded 
                     bg-green-50 text-green-600 hover:bg-green-100 
                     transition-colors border border-green-200 group relative
                     touch-manipulation`)}
          title={canCreate ? "Add PDF Viewer Node" : getNodeLimitMessage()}
          disabled={!canCreate}
        >
          <FileText className={iconSizeClass} />
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            PDF Viewer
          </div>
        </button>
        <button
          onDragStart={(event) => handleNodeDrag(event, 'website')}
          onTouchStart={(event) => handleNodeTouch(event, 'website')}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          draggable={canCreate}
          className={buttonClass(`${buttonSizeClass} flex items-center justify-center rounded 
                     bg-purple-50 text-purple-600 hover:bg-purple-100 
                     transition-colors border border-purple-200 group relative
                     touch-manipulation`)}
          title={canCreate ? "Add Website Node" : getNodeLimitMessage()}
          disabled={!canCreate}
        >
          <Globe className={iconSizeClass} />
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            Website
          </div>
        </button>
        <button
          onDragStart={(event) => handleNodeDrag(event, 'youtube')}
          onTouchStart={(event) => handleNodeTouch(event, 'youtube')}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          draggable={canCreate}
          className={buttonClass(`${buttonSizeClass} flex items-center justify-center rounded 
                     bg-red-50 text-red-600 hover:bg-red-100 
                     transition-colors border border-red-200 group relative
                     touch-manipulation`)}
          title={canCreate ? "Add YouTube Node" : getNodeLimitMessage()}
          disabled={!canCreate}
        >
          <Youtube className={iconSizeClass} />
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            YouTube
          </div>
        </button>
      </div>

      {/* Divider */}
      <div className={isHorizontal 
        ? 'w-px bg-gray-200 my-2' 
        : 'h-px bg-gray-200 mx-2'
      } />

      {/* Tools */}
      <div className={isHorizontal 
        ? 'flex flex-row space-x-1 space-y-0' 
        : 'flex flex-col space-y-1 space-x-0'
      }>
        <button
          onDragStart={(event) => handleNodeDrag(event, 'chat')}
          onTouchStart={(event) => handleNodeTouch(event, 'chat')}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          draggable={canCreate}
          className={buttonClass(`${buttonSizeClass} flex items-center justify-center rounded 
                     bg-blue-50 text-blue-600 hover:bg-blue-100 
                     transition-colors border border-blue-200 group relative
                     touch-manipulation`)}
          title={canCreate ? "Add Chat Node" : getNodeLimitMessage()}
          disabled={!canCreate}
        >
          <MessageSquare className={iconSizeClass} />
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            Chat
          </div>
        </button>
        <button
          onDragStart={(event) => handleNodeDrag(event, 'document')}
          onTouchStart={(event) => handleNodeTouch(event, 'document')}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          draggable={canCreate}
          className={buttonClass(`${buttonSizeClass} flex items-center justify-center rounded 
                     bg-indigo-50 text-indigo-600 hover:bg-indigo-100 
                     transition-colors border border-indigo-200 group relative
                     touch-manipulation`)}
          title={canCreate ? "Add Document Node" : getNodeLimitMessage()}
          disabled={!canCreate}
        >
          <FileText className={iconSizeClass} />
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            Document
          </div>
        </button>
        <button
          onDragStart={(event) => handleNodeDrag(event, 'table')}
          onTouchStart={(event) => handleNodeTouch(event, 'table')}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          draggable={canCreate}
          className={buttonClass(`${buttonSizeClass} flex items-center justify-center rounded 
                     bg-emerald-50 text-emerald-600 hover:bg-emerald-100 
                     transition-colors border border-emerald-200 group relative
                     touch-manipulation`)}
          title={canCreate ? "Add Table Node" : getNodeLimitMessage()}
          disabled={!canCreate}
        >
          <Table className={iconSizeClass} />
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            Table
          </div>
        </button>
        <button
          onDragStart={(event) => handleNodeDrag(event, 'graph')}
          onTouchStart={(event) => handleNodeTouch(event, 'graph')}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          draggable={canCreate}
          className={buttonClass(`${buttonSizeClass} flex items-center justify-center rounded 
                     bg-violet-50 text-violet-600 hover:bg-violet-100 
                     transition-colors border border-violet-200 group relative
                     touch-manipulation`)}
          title={canCreate ? "Add Graph Node" : getNodeLimitMessage()}
          disabled={!canCreate}
        >
          <BarChart2 className={iconSizeClass} />
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            Graph
          </div>
        </button>
      </div>

      {/* Divider */}
      <div className={isHorizontal 
        ? 'w-px bg-gray-200 my-2' 
        : 'h-px bg-gray-200 mx-2'
      } />

      {/* Actions */}
      <div className={isHorizontal 
        ? 'flex flex-row space-x-1 space-y-0' 
        : 'flex flex-col space-y-1 space-x-0'
      }>
        <button
          onClick={async () => {
            logger.log('Delete button clicked');
            try {
              await onDeleteSelected();
              logger.log('Delete selected completed');
            } catch (err) {
              logger.error('Failed to delete selected:', err);
            }
          }}
          disabled={!hasSelection}
          className={`${buttonSizeClass} flex items-center justify-center rounded transition-colors group relative
                      touch-manipulation ${
            hasSelection
              ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
              : 'bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed'
          }`}
          title={hasSelection ? "Delete selected elements (Del)" : "Select elements to delete"}
        >
          <Trash2 className={iconSizeClass} />
          <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            Delete
          </div>
        </button>
      </div>
    </div>
  );
} 