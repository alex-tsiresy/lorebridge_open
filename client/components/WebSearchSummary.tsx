import React from "react";
import { Globe } from "lucide-react";
import { ToolStep } from "../lib/useChatAPI";

interface WebSearchSummaryProps {
  toolSteps: ToolStep[];
}

const WebSearchSummary: React.FC<WebSearchSummaryProps> = ({ toolSteps }) => {
  const webSearchSteps = toolSteps.filter((step: ToolStep) => 
    step.type === 'web_search_call' && (step.query || (step.results && step.results.length > 0))
  );
  
  
  if (webSearchSteps.length === 0) return null;
  return (
    <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-900 flex flex-col gap-1">
      <div className="font-semibold flex items-center gap-1 mb-1">
        <Globe className="h-4 w-4 text-yellow-500" />
        Web Search Steps
      </div>
      <ul className="list-disc list-inside ml-4">
        {webSearchSteps.map((step: ToolStep, idx: number) => (
          <li key={idx}>
            <span className="font-medium">{step.query ? `"${step.query}"` : 'Search'}</span>
            {step.status && (
              <span className="ml-2 italic text-yellow-700">[{step.status.replace(/_/g, ' ')}]</span>
            )}
            {step.results && Array.isArray(step.results) && step.results.length > 0 && step.results[0].title && (
              <>
                <span className="ml-2">→ </span>
                <a href={step.results[0].url} target="_blank" rel="noopener noreferrer" className="underline text-blue-700">{step.results[0].title}</a>
              </>
            )}
            {!step.results && step.title && (
              <>
                <span className="ml-2">→ </span>
                {step.url ? (
                  <a href={step.url} target="_blank" rel="noopener noreferrer" className="underline text-blue-700">{step.title}</a>
                ) : (
                  <span>{step.title}</span>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default WebSearchSummary; 