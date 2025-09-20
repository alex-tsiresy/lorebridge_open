"use client";

import React from 'react';
import { EdgeType } from '../edges';

interface EdgeTypeSelectorProps {
  activeEdgeType: EdgeType;
  onEdgeTypeChange: (type: EdgeType) => void;
  availableTypes?: EdgeType[];
  className?: string;
}

const EDGE_TYPE_LABELS: Record<EdgeType, string> = {
  default: 'Default',
  dataFlow: 'Data Flow',
  controlFlow: 'Control Flow',
  dependency: 'Dependency',
  custom: 'Custom',
};

const EDGE_TYPE_COLORS: Record<EdgeType, string> = {
  default: '#374151',
  dataFlow: '#3b82f6',
  controlFlow: '#ef4444',
  dependency: '#f59e0b',
  custom: '#8b5cf6',
};

export function EdgeTypeSelector({
  activeEdgeType,
  onEdgeTypeChange,
  availableTypes = ['default', 'dataFlow', 'controlFlow', 'dependency', 'custom'],
  className = '',
}: EdgeTypeSelectorProps) {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <span className="text-sm font-medium text-gray-700">Edge Type:</span>
      <div className="flex items-center space-x-1">
        {availableTypes.map((type) => (
          <button
            key={type}
            onClick={() => onEdgeTypeChange(type)}
            className={`
              px-3 py-1 text-xs font-medium rounded-md border transition-all
              ${
                activeEdgeType === type
                  ? 'bg-blue-100 border-blue-300 text-blue-800'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }
            `}
            style={{
              borderLeftColor: EDGE_TYPE_COLORS[type],
              borderLeftWidth: '3px',
            }}
          >
            {EDGE_TYPE_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
} 