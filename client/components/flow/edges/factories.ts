import { Connection } from '@xyflow/react';
import { EDGE_CONFIGS } from './constants';
import { CreatedEdge, EdgeType, FlowEdgeData, EdgeOperationResult } from './types';

// Generate unique edge ID
export function generateEdgeId(source: string, target: string, sourceHandle?: string, targetHandle?: string): string {
  const handles = sourceHandle && targetHandle ? `-${sourceHandle}-${targetHandle}` : '';
  return `e${source}-${target}${handles}-${Date.now()}`;
}

// Base edge factory
export function createBaseEdge(
  connection: Connection,
  edgeType: EdgeType = 'default',
  data?: FlowEdgeData
): CreatedEdge {
  const config = EDGE_CONFIGS[edgeType];
  const edgeId = generateEdgeId(
    connection.source,
    connection.target,
    connection.sourceHandle || undefined,
    connection.targetHandle || undefined
  );

  return {
    id: edgeId,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle || 'right-source',
    targetHandle: connection.targetHandle || 'left-target',
    type: 'labeledEdge',
    animated: true, // Always animate edges
    style: {
      stroke: config.style.stroke,
      strokeWidth: config.style.strokeWidth,
      strokeDasharray: config.style.strokeDasharray,
    },
    data: (data
      ? { ...data, label: typeof data.label === 'string' ? data.label : '' }
      : { type: edgeType, label: '' }
    ) as Record<string, unknown>,
  };
}

// Specific edge factories
export function createDataFlowEdge(
  connection: Connection,
  options?: { bandwidth?: number; latency?: number; label?: string }
): EdgeOperationResult {
  try {
    const data: FlowEdgeData = {
      type: 'dataFlow',
      bandwidth: options?.bandwidth,
      latency: options?.latency,
      label: options?.label || 'Data Flow',
    };

    const edge = createBaseEdge(connection, 'dataFlow', data);
    // Override type to use labeled edge
    edge.type = 'labeledEdge';
    
    return {
      success: true,
      edge,
      message: 'Data flow edge created successfully',
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to create data flow edge: ${error}`,
    };
  }
}

export function createControlFlowEdge(
  connection: Connection,
  options?: { condition?: string; label?: string }
): EdgeOperationResult {
  try {
    const data: FlowEdgeData = {
      type: 'controlFlow',
      condition: options?.condition,
      label: options?.label || 'Control Flow',
    };

    const edge = createBaseEdge(connection, 'controlFlow', data);
    // Override type to use labeled edge
    edge.type = 'labeledEdge';
    
    return {
      success: true,
      edge,
      message: 'Control flow edge created successfully',
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to create control flow edge: ${error}`,
    };
  }
}

export function createDependencyEdge(
  connection: Connection,
  options?: { strength?: 'weak' | 'strong'; label?: string }
): EdgeOperationResult {
  try {
    const data: FlowEdgeData = {
      type: 'dependency',
      strength: options?.strength || 'strong',
      label: options?.label || 'Dependency',
    };

    const edge = createBaseEdge(connection, 'dependency', data);
    // Override type to use labeled edge
    edge.type = 'labeledEdge';
    
    return {
      success: true,
      edge,
      message: 'Dependency edge created successfully',
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to create dependency edge: ${error}`,
    };
  }
}

export function createCustomEdge(
  connection: Connection,
  customData?: Record<string, unknown>,
  customStyle?: { stroke?: string; strokeWidth?: number; strokeDasharray?: string; }
): EdgeOperationResult {
  try {
    const data: FlowEdgeData = {
      type: 'custom',
      customProps: customData,
      label: typeof customData?.label === 'string' ? customData.label : 'Custom Edge',
    };

    let edge = createBaseEdge(connection, 'custom', data);
    
    // Apply custom styling if provided
    if (customStyle) {
      edge = {
        ...edge,
        style: {
          ...edge.style,
          ...customStyle,
        },
      };
    }
    
    // Override type to use labeled edge
    edge.type = 'labeledEdge';
    
    return {
      success: true,
      edge,
      message: 'Custom edge created successfully',
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to create custom edge: ${error}`,
    };
  }
}

// Wrapper for default edge to match return type
export function createDefaultEdge(connection: Connection): EdgeOperationResult {
  try {
    const data: FlowEdgeData = {
      type: 'custom',
      label: '',
    };
    const edge = createBaseEdge(connection, 'default', data);
    // Override type to use labeled edge
    edge.type = 'labeledEdge';
    return {
      success: true,
      edge,
      message: 'Default edge created successfully',
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to create default edge: ${error}`,
    };
  }
}

// Edge factory registry for dynamic creation
export const edgeFactories = {
  default: createDefaultEdge,
  dataFlow: createDataFlowEdge,
  controlFlow: createControlFlowEdge,
  dependency: createDependencyEdge,
  custom: createCustomEdge,
} as const;

// Generic edge creator that uses the factory registry
export function createEdgeByType(
  edgeType: EdgeType,
  connection: Connection
): EdgeOperationResult {
  const factory = edgeFactories[edgeType];
  
  if (!factory) {
    return {
      success: false,
      message: `Unknown edge type: ${edgeType}`,
    };
  }

  if (edgeType === 'default') {
    return factory(connection);
  }

  return factory(connection);
} 