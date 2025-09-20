import { Node, Edge } from '@xyflow/react';
import { RESIZER_CONFIG, NODE_COLORS, STICKY_NOTE_CONFIG } from './constants';

// Sticky note handle styling - positioned more prominently like in the image
// Scale handles inversely with zoom to maintain consistent visual size
export const calculateStickyNoteHandleStyle = (zoom: number, color: string) => {
  const baseSize = 16;
  const baseBorderWidth = 2;
  const scaledSize = baseSize / zoom;
  const scaledBorderWidth = baseBorderWidth / zoom;
  
  return {
    width: `${scaledSize}px`,
    height: `${scaledSize}px`,
    borderWidth: `${scaledBorderWidth}px`,
    borderColor: color,
    backgroundColor: '#ffffff',
    borderStyle: 'solid' as const,
    borderRadius: '0px', // Sharp edges for handles too
    boxShadow: `0 ${2/zoom}px ${6/zoom}px rgba(0,0,0,0.2)`,
    zIndex: 10,
    transition: 'all 0.2s ease-in-out',
    cursor: 'crosshair',
    opacity: 0.8,
    transform: 'scale(1)',
  };
};

export const calculateStickyNoteHoverHandleStyle = (zoom: number, color: string) => {
  const baseSize = 20;
  const baseBorderWidth = 3;
  const scaledSize = baseSize / zoom;
  const scaledBorderWidth = baseBorderWidth / zoom;
  
  return {
    width: `${scaledSize}px`,
    height: `${scaledSize}px`,
    borderWidth: `${scaledBorderWidth}px`,
    borderColor: color,
    backgroundColor: '#ffffff',
    borderStyle: 'solid' as const,
    borderRadius: '0px', // Sharp edges
    boxShadow: `0 ${4/zoom}px ${12/zoom}px rgba(0,0,0,0.3)`,
    zIndex: 15,
    transition: 'all 0.2s ease-in-out',
    cursor: 'crosshair',
    opacity: 1,
    transform: 'scale(1.1)',
  };
};

export const calculateHandleStyle = (zoom: number, color: string) => {
  return calculateStickyNoteHandleStyle(zoom, color);
};

export const calculateHoverHandleStyle = (zoom: number, color: string) => {
  return calculateStickyNoteHoverHandleStyle(zoom, color);
};

export const calculateActiveHandleStyle = (zoom: number, color: string) => {
  const baseSize = 22;
  const baseBorderWidth = 3;
  const scaledSize = baseSize / zoom;
  const scaledBorderWidth = baseBorderWidth / zoom;
  
  return {
    width: `${scaledSize}px`,
    height: `${scaledSize}px`,
    borderWidth: `${scaledBorderWidth}px`,
    borderColor: color,
    backgroundColor: '#f3f4f6',
    borderStyle: 'solid' as const,
    borderRadius: '0px', // Sharp edges
    boxShadow: `0 ${6/zoom}px ${16/zoom}px rgba(0,0,0,0.4)`,
    zIndex: 20,
    transition: 'all 0.2s ease-in-out',
    cursor: 'crosshair',
    opacity: 1,
    transform: 'scale(1.2)',
  };
};

// Sticky note container styling with resize markings
export const getStickyNoteStyle = (nodeType: keyof typeof NODE_COLORS, selected: boolean) => {
  const colors = NODE_COLORS[nodeType];
  
  return {
    className: `sticky-note-container ${selected ? 'selected' : ''}`,
    style: {
      backgroundColor: colors.background,
      borderRadius: STICKY_NOTE_CONFIG.BORDER_RADIUS,
      boxShadow: selected 
        ? '12px 12px 35px rgba(0, 0, 0, 0.6), 6px 6px 20px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)' 
        : '8px 8px 25px rgba(0, 0, 0, 0.5), 4px 4px 15px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
      position: 'relative' as const,
      width: '100%',
      height: '100%',
      minWidth: '400px',
      minHeight: '400px',
      transition: 'all 0.3s ease-in-out',
      // Remove scaling animation, keep natural paper appearance
      transform: 'scale(1)',
      // Add subtle paper texture
      backgroundImage: `
        radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0),
        linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.05) 50%, transparent 50%, transparent 75%, rgba(255,255,255,0.05) 75%),
        linear-gradient(135deg, transparent 25%, rgba(0,0,0,0.02) 25%, rgba(0,0,0,0.02) 50%, transparent 50%, transparent 75%, rgba(0,0,0,0.02) 75%)
      `,
      backgroundSize: '8px 8px, 16px 16px, 12px 12px',
      backgroundBlendMode: 'overlay',
    },
  };
};

// Create resize markings overlay component (as inline styles for now)
export const getResizeMarkingsStyle = () => ({
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  pointerEvents: 'none' as const,
  borderRadius: STICKY_NOTE_CONFIG.BORDER_RADIUS,
  background: `
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 18px,
      ${STICKY_NOTE_CONFIG.RESIZE_MARKING_COLOR} 18px,
      ${STICKY_NOTE_CONFIG.RESIZE_MARKING_COLOR} 20px
    ),
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 18px,
      ${STICKY_NOTE_CONFIG.RESIZE_MARKING_COLOR} 18px,
      ${STICKY_NOTE_CONFIG.RESIZE_MARKING_COLOR} 20px
    )
  `,
  opacity: 0.3,
  mixBlendMode: 'multiply' as const,
});

// Corner fold effect for sticky note
export const getCornerFoldStyle = () => ({
  position: 'absolute' as const,
  top: 0,
  right: 0,
  width: STICKY_NOTE_CONFIG.CORNER_FOLD_SIZE,
  height: STICKY_NOTE_CONFIG.CORNER_FOLD_SIZE,
  background: 'linear-gradient(-45deg, transparent 46%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.08) 54%, transparent 54%)',
  borderTopRightRadius: STICKY_NOTE_CONFIG.BORDER_RADIUS,
  pointerEvents: 'none' as const,
  clipPath: 'polygon(100% 0, 0 100%, 100% 100%)', // Sharp triangular fold
});

// Miro-like resize handle styling
export const getMiroResizerStyle = () => ({
  handleStyle: {
    width: `${RESIZER_CONFIG.HANDLE_SIZE}px`,
    height: `${RESIZER_CONFIG.HANDLE_SIZE}px`,
    border: `${RESIZER_CONFIG.HANDLE_BORDER_WIDTH}px solid ${RESIZER_CONFIG.HANDLE_COLOR}`,
    backgroundColor: RESIZER_CONFIG.HANDLE_BACKGROUND,
    borderRadius: RESIZER_CONFIG.HANDLE_BORDER_RADIUS,
    boxShadow: RESIZER_CONFIG.HANDLE_SHADOW,
    transition: RESIZER_CONFIG.HANDLE_TRANSITION,
    cursor: 'nw-resize',
    zIndex: 1000,
  },
  handleClassName: 'miro-resize-handle',
});

// Node container styling to match GraphCard
export const getNodeContainerStyle = (nodeType: keyof typeof NODE_COLORS, selected: boolean) => {
  return getStickyNoteStyle(nodeType, selected);
};

// Node header styling for sticky notes
export const getNodeHeaderStyle = (nodeType: keyof typeof NODE_COLORS) => {
  const colors = NODE_COLORS[nodeType];
  
  return {
    className: 'px-4 py-3 ',
    style: {
      backgroundColor: colors.headerBg,
      borderColor: colors.border,
      color: colors.textColor,
      fontWeight: '600',
      borderBottomStyle: 'solid' as const,
      borderTopLeftRadius: '0px',
      borderTopRightRadius: '0px',
    },
  };
};

// Content area styling for sticky notes
export const getNodeContentStyle = (nodeType: keyof typeof NODE_COLORS) => {
  const colors = NODE_COLORS[nodeType];
  
  return {
    style: {
      color: colors.textColor,
      backgroundColor: 'transparent',
    },
  };
};

export const generateRandomPosition = () => ({
  x: Math.random() * 400 + 100,
  y: Math.random() * 300 + 100,
});

export const exportFlowData = (nodes: Node[], edges: Edge[]) => {
  const flowData = {
    nodes,
    edges,
    timestamp: new Date().toISOString(),
  };
  
  const dataStr = JSON.stringify(flowData, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
  
  const exportFileDefaultName = 'flow-diagram.json';
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
};

// Helper function to find the closest handle on a target node
export const findClosestHandle = (
	sourceNode: Node,
	targetNode: Node
): string => {
	if (!sourceNode || !targetNode) return 'left-target';

	// Source center
	const sourceX = sourceNode.position.x + (sourceNode.width || 320) / 2;
	const sourceY = sourceNode.position.y + (sourceNode.height || 320) / 2;

	// Target rect and handle anchors
	const tWidth = targetNode.width || 320;
	const tHeight = targetNode.height || 320;
	const tX = targetNode.position.x;
	const tY = targetNode.position.y;
	const tCx = tX + tWidth / 2;
	const tCy = tY + tHeight / 2;

	const targetAnchors: Record<'top-target' | 'bottom-target' | 'left-target' | 'right-target', { x: number; y: number }> = {
		'top-target': { x: tCx, y: tY },
		'bottom-target': { x: tCx, y: tY + tHeight },
		'left-target': { x: tX, y: tCy },
		'right-target': { x: tX + tWidth, y: tCy },
	};

	let bestHandle: keyof typeof targetAnchors = 'left-target';
	let bestDist = Number.POSITIVE_INFINITY;
	for (const [handle, anchor] of Object.entries(targetAnchors) as Array<[keyof typeof targetAnchors, { x: number; y: number }]>) {
		const dx = anchor.x - sourceX;
		const dy = anchor.y - sourceY;
		const dist = Math.hypot(dx, dy);
		if (dist < bestDist) {
			bestDist = dist;
			bestHandle = handle;
		}
	}

	return bestHandle;
};

// Get all available handles for a node
export const getNodeHandles = () => {
  return {
    source: ['top-source', 'left-source', 'right-source', 'bottom-source'],
    target: ['top-target', 'left-target', 'right-target', 'bottom-target']
  };
}; 