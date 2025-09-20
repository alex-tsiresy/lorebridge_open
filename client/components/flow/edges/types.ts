import { Edge, Connection as ReactFlowConnection, Node as FlowNode } from '@xyflow/react';

// Base edge data interface
export interface BaseEdgeData {
  label?: string;
  description?: string;
  // Runtime-only UI flag used to highlight edges by direction when a node is selected
  highlightDirection?: 'incoming' | 'outgoing';
}

// Specific edge data types
export interface DataFlowEdgeData extends BaseEdgeData {
  type: 'dataFlow';
  bandwidth?: number;
  latency?: number;
}

export interface ControlFlowEdgeData extends BaseEdgeData {
  type: 'controlFlow';
  condition?: string;
}

export interface DependencyEdgeData extends BaseEdgeData {
  type: 'dependency';
  strength?: 'weak' | 'strong';
}

export interface CustomEdgeData extends BaseEdgeData {
  type: 'custom';
  customProps?: Record<string, unknown>;
}

// Union type for all edge data
export type FlowEdgeData = DataFlowEdgeData | ControlFlowEdgeData | DependencyEdgeData | CustomEdgeData;

// Edge type definitions
export type EdgeType = 'dataFlow' | 'controlFlow' | 'dependency' | 'custom' | 'default';

// Edge style configuration
export interface EdgeStyleConfig {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  animated?: boolean;
}

// Edge behavior configuration
export interface EdgeBehaviorConfig {
  selectable?: boolean;
  deletable?: boolean;
  reconnectable?: boolean;
  bidirectional?: boolean;
}

// Complete edge configuration
export interface EdgeConfig {
  type: EdgeType;
  style: EdgeStyleConfig;
  behavior: EdgeBehaviorConfig;
  validation?: (sourceNodeType: string, targetNodeType: string) => boolean;
}

// Edge factory result
export interface CreatedEdge extends Omit<Edge, 'data'> {
  data?: Record<string, unknown>;
}

// Edge operation results
export interface EdgeOperationResult {
  success: boolean;
  message?: string;
  edge?: CreatedEdge;
}

// Edge validation rules
export interface EdgeValidationRule {
  name: string;
  validate: (
    edge: Edge | ReactFlowConnection,
    existingEdges?: Edge[],
    maxConnectionsPerHandle?: number,
    nodes?: FlowNode[]
  ) => boolean;
  message: string;
}

// Use React Flow's Connection type directly
export type Connection = ReactFlowConnection; 