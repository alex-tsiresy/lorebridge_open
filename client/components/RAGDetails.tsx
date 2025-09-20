import React from "react";
import { FileText, Search, Database } from "lucide-react";
import { ToolStep } from "../lib/useChatAPI";

interface RAGDetailsProps {
  toolSteps: ToolStep[];
}

const RAGDetails: React.FC<RAGDetailsProps> = ({ toolSteps }) => {
  // Filter and validate RAG tool steps
  const validRAGSteps = toolSteps.filter((step: ToolStep) => 
    step.type === 'rag_result' && (step.chunks_used || (step.relevant_chunks && step.relevant_chunks.length > 0))
  );

  if (validRAGSteps.length === 0) {
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-b-lg rounded-tr-lg p-3 text-xs text-blue-900 shadow-sm">
      {validRAGSteps.map((toolStep: ToolStep, idx: number) => (
        <div key={idx} className="mb-3 last:mb-0">
          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-500" />
              <span>
                <span className="font-semibold">Document Search:</span> 
                <span className="ml-2">
                  {toolStep.method === 'rag_semantic_search' ? 'Semantic Search' : 
                   toolStep.method === 'rag_no_context' ? 'No Context Found' : 
                   toolStep.method || 'Document Query'}
                </span>
                {toolStep.chunks_used && (
                  <span className="ml-2 italic">[{toolStep.chunks_used} chunks, {toolStep.context_tokens} tokens]</span>
                )}
              </span>
            </div>
            
            {toolStep.relevant_chunks && Array.isArray(toolStep.relevant_chunks) && toolStep.relevant_chunks.length > 0 && (
              <div className="mt-1">
                <span className="font-semibold">Retrieved Sections:</span>
                <div className="mt-2 space-y-2">
                  {toolStep.relevant_chunks.map((chunk: any, chunkIdx: number) => (
                    <div key={chunkIdx} className="p-2 bg-white border border-blue-100 rounded text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-blue-700">
                          Section {chunkIdx + 1}
                        </span>
                        <span className="text-blue-600">
                          {(chunk.similarity_score * 100).toFixed(1)}% match
                        </span>
                      </div>
                      <div className="text-gray-700 leading-relaxed">
                        {chunk.text.length > 300 
                          ? `${chunk.text.substring(0, 300)}...` 
                          : chunk.text
                        }
                      </div>
                      {chunk.metadata && chunk.metadata.page && (
                        <div className="text-blue-600 text-xs mt-1">
                          Page: {chunk.metadata.page}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {toolStep.answer && (
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                <div className="font-semibold text-green-800 mb-1">Generated Answer:</div>
                <div className="text-green-700 text-sm leading-relaxed">
                  {toolStep.answer}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default RAGDetails; 