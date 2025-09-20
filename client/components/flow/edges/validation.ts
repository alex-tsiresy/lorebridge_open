import { Edge, Node as FlowNode } from '@xyflow/react';
import { Connection, EdgeValidationRule } from './types';
import { EDGE_CONFIGS } from './constants';

// Core validation rules
export const CORE_VALIDATION_RULES: EdgeValidationRule[] = [
  {
    name: 'no-self-connection',
    validate: (connection) => connection.source !== connection.target,
    message: 'Cannot connect a node to itself',
  },
  {
    name: 'require-handles',
    validate: (connection) => 
      Boolean(connection.sourceHandle && connection.targetHandle),
    message: 'Source and target handles are required',
  },
  {
    name: 'valid-handle-format',
    validate: (connection) => {
      const handlePattern = /^(top|bottom|left|right)-(source|target)$/;
      return Boolean(
        connection.sourceHandle?.match(handlePattern) &&
        connection.targetHandle?.match(handlePattern)
      );
    },
    message: 'Invalid handle format',
  },
];

// Advanced validation rules
export const ADVANCED_VALIDATION_RULES: EdgeValidationRule[] = [
  {
    name: 'no-duplicate-connections',
    validate: (connection, existingEdges?: Edge[]) => {
      if (!existingEdges) return true;
      // Only allow one edge between any two nodes, regardless of handle
      return !existingEdges.some(edge => 
        edge.source === connection.source && 
        edge.target === connection.target
      );
    },
    message: 'Only one edge is allowed between any two nodes',
  },
  {
    name: 'max-connections-per-handle',
    validate: (connection, existingEdges?: Edge[], maxConnections = 5) => {
      if (!existingEdges) return true;
      
      const sourceConnections = existingEdges.filter(edge =>
        edge.source === connection.source && 
        edge.sourceHandle === connection.sourceHandle
      );
      
      const targetConnections = existingEdges.filter(edge =>
        edge.target === connection.target && 
        edge.targetHandle === connection.targetHandle
      );
      
      return sourceConnections.length < maxConnections && 
             targetConnections.length < maxConnections;
    },
    message: 'Maximum connections per handle exceeded',
  },
];

// Custom rule: Only allow edges from data source to non-data source
const CATEGORY_EDGE_RULE: EdgeValidationRule = {
  name: 'category-edge-restriction',
  validate: (
    connection: Edge | Connection,
    _existingEdges?: Edge[],
    _maxConnections?: number,
    nodes?: FlowNode[]
  ) => {
    if (!nodes) return true;
    const sourceNode = nodes.find((n: FlowNode) => n.id === connection.source);
    const targetNode = nodes.find((n: FlowNode) => n.id === connection.target);
    if (!sourceNode || !targetNode) return true;
    const sourceCategory = sourceNode.data?.category;
    const targetCategory = targetNode.data?.category;
    // Only allow: source is Data source, target is NOT Data source
    if (sourceCategory === 'Data source' && targetCategory === 'Polyvalent') return true;
    if (sourceCategory === 'Polyvalent' && targetCategory === 'Polyvalent') return true;
    // All other cases are not allowed
    return false;
  },
  message: 'Only edges from Data source to non-Data source nodes are allowed.',
};

// Validation context
export interface ValidationContext {
  existingEdges?: Edge[];
  nodes?: FlowNode[];
  customRules?: EdgeValidationRule[];
  maxConnectionsPerHandle?: number;
}

// Edge validator class for extensible validation
export class EdgeValidator {
  private rules: EdgeValidationRule[] = [];
  private nodes?: FlowNode[];
  
  constructor(context?: ValidationContext) {
    // Add core rules
    this.rules.push(...CORE_VALIDATION_RULES);
    
    // Add advanced rules
    this.rules.push(...ADVANCED_VALIDATION_RULES);
    
    // Add custom rules if provided
    if (context?.customRules) {
      this.rules.push(...context.customRules);
    }
    
    // Always add category rule
    this.rules.push(CATEGORY_EDGE_RULE);
    
    this.nodes = context?.nodes;
  }
  
  // Add a new validation rule
  addRule(rule: EdgeValidationRule): void {
    this.rules.push(rule);
  }
  
  // Remove a validation rule by name
  removeRule(ruleName: string): void {
    this.rules = this.rules.filter(rule => rule.name !== ruleName);
  }
  
  // Validate a connection
  validate(
    connection: Edge | Connection, 
    context?: ValidationContext
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const nodes = context?.nodes || this.nodes;
    
    for (const rule of this.rules) {
      try {
        const isValid = rule.validate(
          connection, 
          context?.existingEdges,
          context?.maxConnectionsPerHandle,
          nodes
        );
        
        if (!isValid) {
          errors.push(rule.message);
        }
      } catch (error) {
        errors.push(`Validation rule '${rule.name}' failed: ${error}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }
  
  // Quick validation (returns boolean only)
  isValid(connection: Edge | Connection, context?: ValidationContext): boolean {
    return this.validate(connection, context).isValid;
  }
}

// Node type compatibility validation
export function validateNodeTypeCompatibility(
  sourceNodeType: string,
  targetNodeType: string,
  edgeType: string = 'default'
): boolean {
  const config = EDGE_CONFIGS[edgeType as keyof typeof EDGE_CONFIGS];
  
  if (config?.validation) {
    return config.validation(sourceNodeType, targetNodeType);
  }
  
  // Default: allow all connections
  return true;
}

// Utility functions for common validations
export function canConnect(
  connection: Connection,
  existingEdges: Edge[],
  nodes?: FlowNode[]
): { canConnect: boolean; reason?: string } {
  const validator = new EdgeValidator({ existingEdges, nodes });
  const result = validator.validate(connection);
  
  return {
    canConnect: result.isValid,
    reason: result.errors.join(', '),
  };
}

// Check if a specific handle can accept more connections
export function canHandleAcceptConnection(
  nodeId: string,
  handleId: string,
  handleType: 'source' | 'target',
  existingEdges: Edge[],
  maxConnections: number = 10
): boolean {
  const connections = existingEdges.filter(edge => {
    if (handleType === 'source') {
      return edge.source === nodeId && edge.sourceHandle === handleId;
    } else {
      return edge.target === nodeId && edge.targetHandle === handleId;
    }
  });
  
  return connections.length < maxConnections;
}

// Create a pre-configured validator for common use cases
export function createStandardValidator(existingEdges: Edge[]): EdgeValidator {
  return new EdgeValidator({ existingEdges });
} 