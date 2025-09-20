// Arrowhead markers removed
import { EdgeConfig, EdgeType } from './types';

// Edge style presets
export const EDGE_STYLES = {
  DEFAULT: {
    stroke: '#374151',
    strokeWidth: 4,
    strokeDasharray: '5,5',
    animated: true,
  },
  HIGHLIGHT_OUTGOING: {
    stroke: '#f59e0b',
    strokeWidth: 5,
    strokeDasharray: undefined,
    animated: true,
  },
  HIGHLIGHT_INCOMING: {
    stroke: '#10b981',
    strokeWidth: 5,
    strokeDasharray: undefined,
    animated: true,
  },
  DATA_FLOW: {
    stroke: '#3b82f6',
    strokeWidth: 3,
    strokeDasharray: undefined,
    animated: true,
  },
  CONTROL_FLOW: {
    stroke: '#ef4444',
    strokeWidth: 2,
    strokeDasharray: '10,5',
    animated: true,
  },
  DEPENDENCY: {
    stroke: '#f59e0b',
    strokeWidth: 2,
    strokeDasharray: '2,2',
    animated: true,
  },
  SELECTED: {
    stroke: '#3b82f6',
    strokeWidth: 4,
    strokeDasharray: '5,5',
    animated: true,
  },
  CONNECTING: {
    stroke: '#3b82f6',
    strokeWidth: 3,
    strokeDasharray: '10,5',
    animated: true,
  },
} as const;

// Edge behavior presets
export const EDGE_BEHAVIORS = {
  DEFAULT: {
    selectable: true,
    deletable: true,
    reconnectable: true,
    bidirectional: false,
  },
  READ_ONLY: {
    selectable: true,
    deletable: false,
    reconnectable: false,
    bidirectional: false,
  },
  BIDIRECTIONAL: {
    selectable: true,
    deletable: true,
    reconnectable: true,
    bidirectional: true,
  },
} as const;

// Complete edge configurations
export const EDGE_CONFIGS: Record<EdgeType, EdgeConfig> = {
  default: {
    type: 'default',
    style: EDGE_STYLES.DEFAULT,
    behavior: EDGE_BEHAVIORS.DEFAULT,
  },
  dataFlow: {
    type: 'dataFlow',
    style: EDGE_STYLES.DATA_FLOW,
    behavior: EDGE_BEHAVIORS.DEFAULT,
    validation: () => true,
  },
  controlFlow: {
    type: 'controlFlow',
    style: EDGE_STYLES.CONTROL_FLOW,
    behavior: EDGE_BEHAVIORS.DEFAULT,
    validation: () => true,
  },
  dependency: {
    type: 'dependency',
    style: EDGE_STYLES.DEPENDENCY,
    behavior: EDGE_BEHAVIORS.READ_ONLY,
    validation: () => true,
  },
  custom: {
    type: 'custom',
    style: EDGE_STYLES.DEFAULT,
    behavior: EDGE_BEHAVIORS.DEFAULT,
    validation: () => true,
  },
} as const;

// Connection line configuration
export const CONNECTION_LINE_CONFIG = {
  type: 'labeledEdge',
  style: {
    ...EDGE_STYLES.CONNECTING,
    strokeWidth: 5,
  },
} as const;

// Edge animation settings
export const EDGE_ANIMATIONS = {
  FLOW_SPEED: 1,
  PULSE_DURATION: 2000,
  FADE_DURATION: 300,
} as const; 