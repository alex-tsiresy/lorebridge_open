import React from "react";
import { Database } from "lucide-react";
import { ToolStep } from "../lib/useChatAPI";

interface RAGSummaryProps {
  toolSteps: ToolStep[];
}

const RAGSummary: React.FC<RAGSummaryProps> = ({ toolSteps }) => {
  const ragSteps = toolSteps.filter((step: ToolStep) => 
    step.type === 'rag_result' && (step.chunks_used || (step.relevant_chunks && step.relevant_chunks.length > 0))
  );
  
  if (ragSteps.length === 0) return null;
  
  return (
    <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-900 flex flex-col gap-1">
      <div className="font-semibold flex items-center gap-1 mb-1">
        <Database className="h-4 w-4 text-blue-500" />
        Document Search Steps
      </div>
      <ul className="list-disc list-inside ml-4">
        {ragSteps.map((step: ToolStep, idx: number) => (
          <li key={idx}>
            <span className="font-medium">
              {step.method === 'rag_semantic_search' ? 'Semantic Search' : 
               step.method === 'rag_no_context' ? 'No Context Found' : 
               step.method || 'Document Query'}
            </span>
            {step.chunks_used && (
              <span className="ml-2 italic text-blue-700">
                [{step.chunks_used} chunks, {step.context_tokens} tokens]
              </span>
            )}
            {step.relevant_chunks && step.relevant_chunks.length > 0 && (
              <>
                <span className="ml-2">→ </span>
                <span className="text-blue-700">
                  {step.relevant_chunks.length} relevant sections found
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RAGSummary; 