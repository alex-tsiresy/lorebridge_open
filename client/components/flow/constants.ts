import { Node, Edge, BackgroundVariant } from '@xyflow/react';

// Node sizing constants - Updated for larger default and minimum sizes
export const NODE_SIZES = {
  DEFAULT_WIDTH: 960,  // Doubled from 480
  DEFAULT_HEIGHT: 960, // Doubled from 480
  MIN_WIDTH: 800,      // Doubled from 400
  MIN_HEIGHT: 800,     // Doubled from 400
  MAX_WIDTH: 2400,     // Doubled from 1200
  MAX_HEIGHT: 2400,    // Doubled from 1200
} as const;

// Resizing performance constants
export const RESIZE_CONFIG = {
  DEBOUNCE_TIME: 100,  // Reduced from 200ms for better responsiveness
  BATCH_SIZE: 10,      // Max updates to batch together
  VALIDATION_ENABLED: true,
} as const;

// Standardized NodeResizer configuration function
export const getNodeResizerConfig = (nodeType: keyof typeof NODE_COLORS, zoom: number = 1) => ({
  minWidth: NODE_SIZES.MIN_WIDTH,
  minHeight: NODE_SIZES.MIN_HEIGHT,
  maxWidth: NODE_SIZES.MAX_WIDTH,
  maxHeight: NODE_SIZES.MAX_HEIGHT,
  keepAspectRatio: false,
  handleStyle: {
    width: `${16 / zoom}px`,
    height: `${16 / zoom}px`,
    backgroundColor: '#ffffff',
    border: `${2 / zoom}px solid ${NODE_COLORS[nodeType].border}`,
    borderRadius: '3px',
    transition: 'all 0.2s ease-in-out',
    cursor: 'nw-resize',
    boxShadow: `0 ${2 / zoom}px ${8 / zoom}px rgba(0, 0, 0, 0.15)`,
  }
});

// Special configurations for specific node types that need different constraints
export const getSpecialNodeResizerConfig = (nodeType: keyof typeof NODE_COLORS, zoom: number = 1, specialConfig?: Partial<ReturnType<typeof getNodeResizerConfig>>) => ({
  ...getNodeResizerConfig(nodeType, zoom),
  ...specialConfig,
});

// Handle styles and sizing
export const HANDLE_CONFIG = {
  MIN_SIZE: 12,
  MAX_SIZE: 24,
  DEFAULT_SIZE: 16,
  BORDER_WIDTH: 2,
  HOVER_SIZE: 20,
  ACTIVE_SIZE: 22,
} as const;

// Sticky note styling constants
export const STICKY_NOTE_CONFIG = {
  SHADOW: '8px 8px 25px rgba(0, 0, 0, 0.5), 4px 4px 15px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
  HOVER_SHADOW: '12px 12px 35px rgba(0, 0, 0, 0.6), 6px 6px 20px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
  BORDER_RADIUS: '0px', // Sharp edges for sticky note
  CORNER_FOLD_SIZE: '16px',
  RESIZE_MARKING_COLOR: 'rgba(0, 0, 0, 0.15)',
  RESIZE_MARKING_SIZE: '8px',
  MARKING_INTERVAL: '20px',
} as const;

// Miro-like resize styling
export const RESIZER_CONFIG = {
  HANDLE_SIZE: 12,
  HANDLE_BORDER_WIDTH: 2,
  HANDLE_COLOR: '#3b82f6',
  HANDLE_BACKGROUND: '#ffffff',
  HANDLE_HOVER_COLOR: '#1d4ed8',
  HANDLE_HOVER_BACKGROUND: '#f8fafc',
  HANDLE_ACTIVE_COLOR: '#1e40af',
  HANDLE_ACTIVE_BACKGROUND: '#f1f5f9',
  HANDLE_SHADOW: '0 2px 8px rgba(0, 0, 0, 0.15)',
  HANDLE_HOVER_SHADOW: '0 4px 12px rgba(0, 0, 0, 0.25)',
  HANDLE_ACTIVE_SHADOW: '0 6px 16px rgba(0, 0, 0, 0.35)',
  HANDLE_BORDER_RADIUS: '0px', // Sharp edges for consistency
  HANDLE_TRANSITION: 'all 0.2s ease-in-out',
} as const;

// Colors for different node types - Updated for sticky note appearance with light but intense colors
export const NODE_COLORS = {
  CHAT: {
    border: '#1e40af',
    background: '#dbeafe', // Light blue sticky note
    handle: '#1e40af',
    headerBg: '#bfdbfe',
    headerText: '#1e3a8a',
    textColor: '#1e3a8a',
  },
  PDF: {
    border: '#15803d',
    background: '#dcfce7', // Light green sticky note
    handle: '#15803d',
    headerBg: '#bbf7d0',
    headerText: '#14532d',
    textColor: '#14532d',
  },
  WEBSITE: {
    border: '#7c3aed',
    background: '#ede9fe', // Light purple sticky note
    handle: '#7c3aed',
    headerBg: '#ddd6fe',
    headerText: '#5b21b6',
    textColor: '#5b21b6',
  },
  YOUTUBE: {
    border: '#b91c1c',
    background: '#fecaca', // Light red sticky note
    handle: '#b91c1c',
    headerBg: '#fca5a5',
    headerText: '#7f1d1d',
    textColor: '#7f1d1d',
  },
  INSTAGRAM: {
    border: '#be185d',
    background: '#fce7f3', // Light pink sticky note
    handle: '#be185d',
    headerBg: '#fbcfe8',
    headerText: '#831843',
    textColor: '#831843',
  },
  ARTEFACT: {
    border: '#a16207',
    background: '#fef3c7', // Light yellow sticky note
    handle: '#a16207',
    headerBg: '#fde68a',
    headerText: '#78350f',
    textColor: '#78350f',
  },
  DOCUMENT: {
    border: '#1d4ed8',
    background: '#dbeafe', // Light blue sticky note
    handle: '#1d4ed8',
    headerBg: '#bfdbfe',
    headerText: '#1e3a8a',
    textColor: '#1e3a8a',
  },
  TABLE: {
    border: '#047857',
    background: '#d1fae5', // Light emerald sticky note
    handle: '#047857',
    headerBg: '#a7f3d0',
    headerText: '#064e3b',
    textColor: '#064e3b',
  },
  GRAPH: {
    border: '#6d28d9',
    background: '#ede9fe', // Light violet sticky note
    handle: '#6d28d9',
    headerBg: '#ddd6fe',
    headerText: '#4c1d95',
    textColor: '#4c1d95',
  },
} as const;

// Edge styling
export const EDGE_STYLES = {
  DEFAULT: {
    strokeDasharray: '5,5',
    strokeWidth: 2,
    stroke: '#374151',
  },
  SELECTED: {
    strokeDasharray: '5,5',
    strokeWidth: 4,
    stroke: '#3b82f6',
  },
  CONNECTING: {
    strokeWidth: 3,
    stroke: '#3b82f6',
    strokeDasharray: '10,5',
  },
  MARKER: {
    /* removed arrow markers */
  },
  SELECTED_MARKER: {
    /* removed arrow markers */
  },
  CONNECTING_MARKER: {
    /* removed arrow markers */
  },
} as const;

// Connection line configuration
export const CONNECTION_LINE_CONFIG = {
  type: 'smoothstep',
  style: EDGE_STYLES.CONNECTING,
} as const;

// PDF node sizing calculations
export const PDF_NODE_PADDING = {
  HEADER: 40,
  PDF_VIEWER_HEADER: 80,
  CONTROLS: 60,
  BORDER: 40,
} as const;

// Background configuration
export const BACKGROUND_CONFIG = {
  variant: BackgroundVariant.Dots,
  gap: 40, // Increased spacing between dots (default is 20)
  size: 2, // Size of individual dots
} as const;

// Initial flow data
export const INITIAL_NODES: Node[] = [];

export const INITIAL_EDGES: Edge[] = []; 