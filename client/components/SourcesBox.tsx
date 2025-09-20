import React from "react";

interface SourcesBoxProps {
  annotations: any[];
}

const SourcesBox: React.FC<SourcesBoxProps> = ({ annotations }) => {
  if (!annotations || !annotations.length) return null;
  return (
    <div className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2">
      <div className="font-semibold mb-1 flex items-center gap-1">
        <svg className="inline h-4 w-4 text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect width="8" height="4" x="8" y="2" rx="1" /></svg>
        Sources:
      </div>
      <ul className="list-disc list-inside">
        {annotations.filter((a: any) => a.type === 'url_citation').map((a: any, i: number) => (
          <li key={i}>
            <a href={a.url_citation.url} target="_blank" rel="noopener noreferrer" className="underline text-blue-700">
              {a.url_citation.title || a.url_citation.url}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SourcesBox; 