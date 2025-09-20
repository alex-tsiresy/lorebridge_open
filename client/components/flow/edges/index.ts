// Types
export * from './types';

// Constants
export * from './constants';

// Factories
export * from './factories';

// Validation
export * from './validation';

// Utilities
export * from './utils';

// Hooks
export { useEdgeManager } from './hooks/useEdgeManager';

// Re-export commonly used items for convenience
export { EDGE_CONFIGS, EDGE_STYLES, EDGE_BEHAVIORS } from './constants';
export { EdgeValidator, createStandardValidator } from './validation';
export { createEdgeByType, edgeFactories } from './factories';
export type { EdgeType, FlowEdgeData, EdgeConfig, EdgeOperationResult } from './types';

// Component exports
export { LabeledEdge } from './LabeledEdge';

// Edge types registry for ReactFlow
import { LabeledEdge } from './LabeledEdge';
export const edgeTypes = {
  labeledEdge: LabeledEdge,
} as const; 