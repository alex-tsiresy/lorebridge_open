"use client";

import React from 'react';
import { Package } from 'lucide-react';
import { ArtefactNodeData } from '../types';
import MarkdownRenderer from '../../MarkdownRenderer';

interface FullScreenArtefactProps {
  nodeData: ArtefactNodeData;
}

export function FullScreenArtefact({ nodeData }: FullScreenArtefactProps) {
  return (
    <div className="h-full w-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-yellow-50">
        <div className="text-lg font-medium text-gray-900 flex items-center gap-3">
          <Package className="h-5 w-5" />
          {nodeData.label}
        </div>
        <div className="text-sm text-yellow-600 font-semibold mt-1">Polyvalent</div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-8">
        <div className="fullscreen-prose">
          <MarkdownRenderer content={nodeData.content || 'No artefact content available.'} />
        </div>
      </div>
    </div>
  );
} 