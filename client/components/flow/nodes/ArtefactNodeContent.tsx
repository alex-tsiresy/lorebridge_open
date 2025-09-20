"use client";

import React from "react";
import { Package } from "lucide-react";
import { NodeData } from '../types';
import { NODE_COLORS } from '../constants';
import { getNodeHeaderStyle, getNodeContentStyle, getStickyNoteStyle } from '../utils';
import { FullScreenButton } from '../ui/FullScreenButton';

interface ArtefactNodeContentProps {
  nodeId: string;
  nodeData: NodeData;
  selected: boolean;
}

export function ArtefactNodeContent({ nodeId, nodeData, selected }: ArtefactNodeContentProps) {
  const headerStyle = getNodeHeaderStyle('ARTEFACT');
  const contentStyle = getNodeContentStyle('ARTEFACT');
  const containerStyle = getStickyNoteStyle('ARTEFACT', selected);

  return (
    <div className={containerStyle.className} style={containerStyle.style}>
      <div className="h-full flex flex-col relative z-10">
        <div className={headerStyle.className} style={headerStyle.style}>
          <div className="text-sm font-semibold flex items-center justify-between" style={{ color: NODE_COLORS.ARTEFACT.textColor }}>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              {nodeData.label}
            </div>
            <FullScreenButton nodeId={nodeId} />
          </div>
          <div className="text-xs font-semibold mt-0.5" style={{ color: NODE_COLORS.ARTEFACT.textColor, opacity: 0.8 }}>Polyvalent</div>
        </div>
        <div className="flex-1 flex items-center justify-center font-semibold text-lg p-4" style={contentStyle.style}>
          Pyvalent Artefact
        </div>
      </div>
    </div>
  );
} 