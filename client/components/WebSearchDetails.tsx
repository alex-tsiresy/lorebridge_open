import React from "react";
import { Globe } from "lucide-react";
import { ToolStep } from "../lib/useChatAPI";

interface WebSearchDetailsProps {
  toolSteps: ToolStep[];
}

const WebSearchDetails: React.FC<WebSearchDetailsProps> = ({ toolSteps }) => {
  // Filter and validate tool steps
  const validToolSteps = toolSteps.filter((step: ToolStep) => 
    step.type === 'web_search_call' && (step.query || (step.results && step.results.length > 0))
  );


  if (validToolSteps.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-b-lg rounded-tr-lg p-3 text-xs text-yellow-900 shadow-sm">
        <div className="text-gray-500 italic">No web search results available</div>
      </div>
    );
  }

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-b-lg rounded-tr-lg p-3 text-xs text-yellow-900 shadow-sm">
      {validToolSteps.map((toolStep: ToolStep, idx: number) => (
        <div key={idx} className="mb-3 last:mb-0">
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-900 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-yellow-500" />
              <span>
                <span className="font-semibold">Web Search:</span> {toolStep.query ? `"${toolStep.query}"` : ''}
                {toolStep.status && (
                  <span className="ml-2 italic">[{toolStep.status.replace(/_/g, ' ')}]</span>
                )}
              </span>
            </div>
            {toolStep.title && (
              <div className="mt-1">
                <span className="font-semibold">Result:</span>{' '}
                {toolStep.url ? (
                  <a href={toolStep.url} target="_blank" rel="noopener noreferrer" className="underline text-blue-700">{toolStep.title}</a>
                ) : (
                  <span>{toolStep.title}</span>
                )}
                {toolStep.snippet && (
                  <span className="block text-gray-700 mt-1">{toolStep.snippet}</span>
                )}
              </div>
            )}
            {toolStep.results && Array.isArray(toolStep.results) && toolStep.results.length > 0 && (
              <div className="mt-1">
                <span className="font-semibold">Results:</span>
                <ul className="list-disc list-inside ml-4 mt-1">
                  {toolStep.results.map((res: any, idx: number) => (
                    <li key={idx} className="mb-1">
                      {res.url ? (
                        <a href={res.url} target="_blank" rel="noopener noreferrer" className="underline text-blue-700 font-medium">{res.title || res.url}</a>
                      ) : (
                        <span className="font-medium">{res.title || 'Result'}</span>
                      )}
                      {res.snippet && (
                        <span className="block text-gray-700 mt-0.5">{res.snippet}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default WebSearchDetails; 