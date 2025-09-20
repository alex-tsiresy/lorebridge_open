"use client";

import React, { type CSSProperties, memo, useMemo } from 'react';
import {
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
  type EdgeProps,
} from '@xyflow/react';

interface LabeledEdgeData {
  label?: string;
  type?: string;
}

export const LabeledEdge = memo(({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = useMemo(() => getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  }), [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition]);

  const edgeData = data as LabeledEdgeData | undefined;
  const label = edgeData?.label || '';

  return (
    <>
      <BaseEdge path={edgePath} style={style as CSSProperties} />
      {label && label.trim() !== '' && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 12,
              pointerEvents: 'all',
            }}
            className="nodrag nopan bg-white px-2 py-1 rounded border border-gray-300 shadow-sm text-gray-700 font-medium"
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

LabeledEdge.displayName = 'LabeledEdge'; 