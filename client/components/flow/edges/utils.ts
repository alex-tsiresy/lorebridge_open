import { Edge } from '@xyflow/react';
import { EDGE_STYLES } from './constants';
import { EdgeType, FlowEdgeData } from './types';

// Edge selection utilities
export function selectEdge(edge: Edge): Edge {
  const edgeData = edge.data as unknown as FlowEdgeData | undefined;
  const direction = edgeData?.highlightDirection;
  const stylePreset = direction === 'outgoing'
    ? EDGE_STYLES.HIGHLIGHT_OUTGOING
    : direction === 'incoming'
      ? EDGE_STYLES.HIGHLIGHT_INCOMING
      : EDGE_STYLES.SELECTED;

  return {
    ...edge,
    style: {
      ...edge.style,
      stroke: stylePreset.stroke,
      strokeWidth: stylePreset.strokeWidth,
      strokeDasharray: stylePreset.strokeDasharray,
    },
    animated: stylePreset.animated,
  };
}

export function deselectEdge(edge: Edge, originalType: EdgeType = 'default'): Edge {
  const config = originalType === 'dataFlow' ? EDGE_STYLES.DATA_FLOW :
                originalType === 'controlFlow' ? EDGE_STYLES.CONTROL_FLOW :
                originalType === 'dependency' ? EDGE_STYLES.DEPENDENCY :
                EDGE_STYLES.DEFAULT;
  
  return {
    ...edge,
    style: {
      ...edge.style,
      stroke: config.stroke,
      strokeWidth: config.strokeWidth,
      strokeDasharray: config.strokeDasharray,
    },
    animated: config.animated,
  };
}

// Edge styling utilities
export function updateEdgeStyle(
  edges: Edge[],
  edgeId: string,
  styleUpdate: Partial<Edge['style']>
): Edge[] {
  return edges.map(edge =>
    edge.id === edgeId
      ? { ...edge, style: { ...edge.style, ...styleUpdate } }
      : edge
  );
}

export function updateEdgesSelection(
  edges: Edge[],
  selectedEdgeIds: string[]
): Edge[] {
  let changed = false;
  const next = edges.map(edge => {
    const isSelected = selectedEdgeIds.includes(edge.id);
    const edgeData = edge.data as unknown as FlowEdgeData;
    const edgeType = edgeData?.type || 'default';
    
    if (isSelected) {
      const styled = selectEdge(edge);
      if (styled !== edge) changed = true;
      return styled;
    } else {
      // When deselecting, preserve the original animation state
      const deselectededge = deselectEdge(edge, edgeType);
      // Keep the original animated state if it was animated before selection
      const restored = {
        ...deselectededge,
        animated: edge.animated || deselectededge.animated,
      };
      if (restored !== edge) changed = true;
      return restored;
    }
  });
  return changed ? next : edges;
}

// Edge filtering utilities
export function filterEdgesByType(edges: Edge[], edgeType: EdgeType): Edge[] {
  return edges.filter(edge => {
    const data = edge.data as unknown as FlowEdgeData;
    return data?.type === edgeType;
  });
}

export function filterEdgesByNode(edges: Edge[], nodeId: string): Edge[] {
  return edges.filter(edge => 
    edge.source === nodeId || edge.target === nodeId
  );
}

export function filterEdgesByHandle(
  edges: Edge[],
  nodeId: string,
  handleId: string,
  handleType: 'source' | 'target'
): Edge[] {
  return edges.filter(edge => {
    if (handleType === 'source') {
      return edge.source === nodeId && edge.sourceHandle === handleId;
    } else {
      return edge.target === nodeId && edge.targetHandle === handleId;
    }
  });
}

// Edge transformation utilities
export function duplicateEdge(edge: Edge, newId?: string): Edge {
  return {
    ...edge,
    id: newId || `${edge.id}-copy-${Date.now()}`,
  };
}

export function reverseEdge(edge: Edge): Edge {
  return {
    ...edge,
    id: `${edge.id}-reversed`,
    source: edge.target,
    target: edge.source,
    sourceHandle: edge.targetHandle,
    targetHandle: edge.sourceHandle,
  };
}

// Edge data utilities
export function getEdgeData(edge: Edge): FlowEdgeData | null {
  return edge.data as unknown as FlowEdgeData || null;
}

export function updateEdgeData(
  edge: Edge,
  dataUpdate: Partial<FlowEdgeData>
): Edge {
  const currentData = getEdgeData(edge) || { type: 'default' as const };
  return {
    ...edge,
    data: { ...currentData, ...dataUpdate },
  };
}

// Edge relationship utilities
export function getConnectedNodes(edges: Edge[], nodeId: string): {
  sources: string[];
  targets: string[];
} {
  const sources = edges
    .filter(edge => edge.target === nodeId)
    .map(edge => edge.source);
  
  const targets = edges
    .filter(edge => edge.source === nodeId)
    .map(edge => edge.target);
  
  return { sources, targets };
}

export function areNodesConnected(
  edges: Edge[],
  sourceId: string,
  targetId: string
): boolean {
  return edges.some(edge =>
    edge.source === sourceId && edge.target === targetId
  );
}

export function getEdgesBetweenNodes(
  edges: Edge[],
  nodeId1: string,
  nodeId2: string
): Edge[] {
  return edges.filter(edge =>
    (edge.source === nodeId1 && edge.target === nodeId2) ||
    (edge.source === nodeId2 && edge.target === nodeId1)
  );
}

// Edge animation utilities
export function animateEdge(edge: Edge, animated: boolean = true): Edge {
  return {
    ...edge,
    animated,
  };
}

export function pulseEdge(edges: Edge[], edgeId: string, duration: number = 2000): Edge[] {
  const updatedEdges = updateEdgeStyle(edges, edgeId, {
    strokeWidth: 6,
    stroke: '#10b981',
  });
  
  // Reset after duration (this would typically be handled by a timer in the component)
  setTimeout(() => {
    const originalEdge = edges.find(e => e.id === edgeId);
    if (originalEdge) {
      updateEdgeStyle(updatedEdges, edgeId, originalEdge.style || {});
    }
  }, duration);
  
  return updatedEdges;
}

// Edge statistics utilities
export function getEdgeStats(edges: Edge[]): {
  total: number;
  byType: Record<string, number>;
  animated: number;
  selected: number;
} {
  const stats = {
    total: edges.length,
    byType: {} as Record<string, number>,
    animated: 0,
    selected: 0,
  };
  
  edges.forEach(edge => {
    const data = getEdgeData(edge);
    const type = data?.type || 'default';
    
    stats.byType[type] = (stats.byType[type] || 0) + 1;
    
    if (edge.animated) stats.animated++;
    if (edge.selected) stats.selected++;
  });
  
  return stats;
}

// Edge cleanup utilities
export function removeOrphanedEdges(edges: Edge[], nodeIds: string[]): Edge[] {
  return edges.filter(edge =>
    nodeIds.includes(edge.source) && nodeIds.includes(edge.target)
  );
}

export function removeDuplicateEdges(edges: Edge[]): Edge[] {
  const seen = new Set<string>();
  
  return edges.filter(edge => {
    const key = `${edge.source}-${edge.target}-${edge.sourceHandle}-${edge.targetHandle}`;
    
    if (seen.has(key)) {
      return false;
    }
    
    seen.add(key);
    return true;
  });
}

// Edge export utilities
export function exportEdgesAsJSON(edges: Edge[]): string {
  return JSON.stringify(edges, null, 2);
}

export function exportEdgesSummary(edges: Edge[]): {
  edges: Array<{
    id: string;
    type: string;
    source: string;
    target: string;
    data?: FlowEdgeData | null;
  }>;
  stats: ReturnType<typeof getEdgeStats>;
} {
  return {
    edges: edges.map(edge => ({
      id: edge.id,
      type: getEdgeData(edge)?.type || 'default',
      source: edge.source,
      target: edge.target,
      data: getEdgeData(edge),
    })),
    stats: getEdgeStats(edges),
  };
} 