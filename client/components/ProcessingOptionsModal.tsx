"use client";

import React, { useState } from 'react';

type Option = {
  id: string;
  title: string;
  intent: string;
  description: string;
  relevance_score?: number;
  estimated_complexity?: 'low' | 'medium' | 'high';
};

interface ProcessingOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: Option[];
  onSelect: (option: Option) => void;
  detectedSubjects?: string[];
  outputType: 'table' | 'markdown' | 'mermaid';
  isNodeSelected?: boolean;
  nodeId?: string;
  inline?: boolean;
}

export function ProcessingOptionsModal({ isOpen, onClose, options, onSelect, detectedSubjects, outputType, isNodeSelected = false, nodeId, inline = false }: ProcessingOptionsModalProps) {
  const [customDescription, setCustomDescription] = useState<string>("");
  if (!isOpen) return null;

  const optionsListClass = inline ? 'space-y-2' : 'space-y-2 max-h-96 overflow-y-auto';

  const body = (
    <div className="text-sm text-gray-700">
      <div className="mb-2">Output: <span className="font-medium capitalize">{outputType}</span></div>
      <div className="mb-3">
        <label className="block text-xs text-gray-500 mb-1">Or describe your own option</label>
        <div className="grid grid-cols-1 gap-2">
          <textarea
            className="w-full border rounded-md p-2 text-sm outline-none focus:ring-2 focus:ring-gray-300 resize-none overflow-auto"
            rows={5}
            placeholder="Describe the action (e.g., Compare A vs B by cost/performance)"
            value={customDescription}
            onChange={(e) => setCustomDescription(e.target.value)}
          />
          <div className="flex justify-end">
            <button
              onClick={() => {
                if (!isNodeSelected && nodeId) {
                  const evt = new CustomEvent('select-node', { detail: { nodeId } });
                  window.dispatchEvent(evt);
                  return;
                }
                const desc = customDescription.trim();
                if (!desc) return;
                const now = Date.now();
                const titleGuess = desc.length > 80 ? desc.slice(0, 77) + '…' : desc;
                const customOption: any = {
                  id: `custom_${now}`,
                  title: titleGuess,
                  description: desc,
                  infer_intent: true,
                  is_custom: true,
                };
                onSelect(customOption);
              }}
              className="px-3 py-1.5 text-sm rounded bg-gray-900 text-white hover:bg-black disabled:opacity-40"
            >
              Use this option
            </button>
          </div>
        </div>
      </div>
      {detectedSubjects && detectedSubjects.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-gray-500">Detected subjects:</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {detectedSubjects.map((s) => (
              <span key={s} className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs">{s}</span>
            ))}
          </div>
        </div>
      )}
      <div className={optionsListClass}>
        {options.map((opt) => (
          <button
            key={opt.id}
            onClick={() => {
              if (!isNodeSelected && nodeId) {
                const evt = new CustomEvent('select-node', { detail: { nodeId } });
                window.dispatchEvent(evt);
                return;
              }
              onSelect(opt);
            }}
            className={`w-full text-left border rounded-lg p-3 hover:bg-gray-50`}
          >
            <div className="flex items-center justify-between">
              <div className="font-medium text-gray-900">{opt.title}</div>
              {typeof opt.relevance_score === 'number' && (
                <span className="text-xs text-gray-500">{Math.round(opt.relevance_score * 100)}%</span>
              )}
            </div>
            <div className="text-xs text-gray-600 mt-1">{opt.intent}</div>
            <div className="text-sm text-gray-700 mt-1">{opt.description}</div>
          </button>
        ))}
        {options.length === 0 && (
          <div className="text-sm text-gray-500">No options available.</div>
        )}
      </div>
    </div>
  );

  if (inline) {
    return (
      <div className="w-full h-full overflow-hidden">
        <div className="bg-white rounded-lg border shadow-sm h-full max-h-full flex flex-col">
          <div className="px-4 py-2 border-b flex items-center justify-between flex-shrink-0">
            <div className="font-semibold text-gray-900">Choose how to proceed</div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Cancel and remove node">✕</button>
          </div>
          <div className="px-4 py-3 flex-1 min-h-0 overflow-auto">
            {body}
          </div>
          <div className="px-4 py-2 border-t flex justify-end flex-shrink-0">
            <button onClick={onClose} className="px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200 text-gray-800">Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl my-8">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div className="font-semibold text-gray-900">Choose how to proceed</div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Cancel and remove node">✕</button>
        </div>
        <div className="px-5 py-3">
          {body}
        </div>
        <div className="px-5 py-3 border-t flex justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded bg-gray-100 hover:bg-gray-200 text-gray-800">Cancel</button>
        </div>
      </div>
    </div>
  );
}


