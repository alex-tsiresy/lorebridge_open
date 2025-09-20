// Example Markdown for correct nested bullet points:
//
// ### 🏛️ Germany's Political System
//
// - **Type**: Germany is a **federal parliamentary republic**. It combines a strong federal structure with democracy.
// - **Structure**: 
//   - **Federal State**: Consists of 16 states (Länder) with shared governance between federal and state governments.
// - **Parliament**: 
//   - **Chancellor**: The head of government, elected by the Bundestag upon nomination by the President.
//   - **Federal President**: The head of state, with a largely ceremonial role.
// - **Governance**: Emphasizes individual liberty, division of powers, and a strong judiciary.
//
// For more insights, see [Facts About Germany - Political System](https://www.tatsachen-ueber-deutschland.de/en/politics-germany/political-system).
//
// ---
//
// Notes

import React, { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import "highlight.js/styles/github-dark.css";
import { logger } from '@/lib/logger';

// Configure highlight.js to handle unknown languages gracefully  
const highlightOptions = {
  ignoreMissing: true, // Don't throw errors for unknown languages
};

interface Props {
  content: string;
  className?: string;
}

// Memoized markdown components to prevent unnecessary re-renders
const markdownComponents = {
  a: ({ node, ...props }: any) => (
    <a {...props} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline transition-colors" />
  ),
  h1: ({ node, ...props }: any) => <h1 className="text-3xl font-bold mt-4 mb-2 text-gray-900 border-b-2 border-gray-200 pb-1" {...props} />,
  h2: ({ node, ...props }: any) => <h2 className="text-2xl font-semibold mt-3 mb-1 text-gray-800" {...props} />,
  h3: ({ node, ...props }: any) => <h3 className="text-xl font-semibold mt-2 mb-1 text-gray-700" {...props} />,
  h4: ({ node, ...props }: any) => <h4 className="text-lg font-medium mt-2 mb-1 text-gray-600" {...props} />,
  h5: ({ node, ...props }: any) => <h5 className="text-base font-medium mt-1 mb-1 text-gray-600" {...props} />,
  h6: ({ node, ...props }: any) => <h6 className="text-sm font-medium mt-1 mb-1 text-gray-600" {...props} />,
  p: ({ node, ...props }: any) => <p className="mb-2 leading-relaxed" {...props} />,
  li: ({ node, ...props }: any) => <li className="mb-1" {...props} />,
  ul: ({ node, ...props }: any) => <ul className="list-disc pl-6 mb-2 space-y-0" {...props} />,
  ol: ({ node, ...props }: any) => <ol className="list-decimal pl-6 mb-2 space-y-0" {...props} />,
  blockquote: ({ node, ...props }: any) => (
    <blockquote className="border-l-4 border-blue-500 bg-blue-50 pl-4 pr-4 py-2 my-2 italic text-blue-900 rounded-r" {...props} />
  ),
  table: ({ node, ...props }: any) => (
    <div className="overflow-x-auto my-0 rounded-md border border-gray-200 shadow-sm">
      <table className="w-full border-collapse bg-white chatgpt-table" {...props} />
    </div>
  ),
  thead: ({ node, ...props }: any) => (
    <thead className="bg-gray-50 border-b border-gray-200" {...props} />
  ),
  tbody: ({ node, ...props }: any) => (
    <tbody className="divide-y divide-gray-200" {...props} />
  ),
  th: ({ node, ...props }: any) => (
    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 last:border-r-0" {...props} />
  ),
  td: ({ node, ...props }: any) => (
    <td className="px-3 py-2 text-sm text-gray-900 border-r border-gray-200 last:border-r-0 whitespace-pre-wrap" {...props} />
  ),
  tr: ({ node, ...props }: any) => (
    <tr className="hover:bg-gray-50 transition-colors" {...props} />
  ),
  code: ({ node, inline, className, children, ...props }: any) => 
    inline ? (
      <code className="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>
    ) : (
      <code className={`text-gray-100 ${className || ''}`} {...props}>{children}</code>
    ),
  pre: ({ node, ...props }: any) => (
    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4 border border-gray-700" {...props} />
  ),
  hr: ({ node, ...props }: any) => <hr className="my-1 border-t border-gray-200" {...props} />,
  strong: ({ node, ...props }: any) => <strong className="font-semibold text-gray-900" {...props} />,
  em: ({ node, ...props }: any) => <em className="italic text-gray-700" {...props} />,
};

class MarkdownErrorBoundary extends React.Component<React.PropsWithChildren<{ content: string }>, { hasError: boolean }> {
  constructor(props: React.PropsWithChildren<{ content: string }>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, _errorInfo: any) {
    // Log syntax highlighting errors for debugging
    if (error.message?.includes('Unknown language') || error.message?.includes('not registered')) {
      logger.warn('Syntax highlighting error caught:', error.message);
    } else {
      logger.error('Markdown render error:', error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <pre className="bg-gray-100 text-gray-800 p-2 rounded overflow-x-auto border border-gray-300">
          <code>{this.props.content}</code>
        </pre>
      );
    }
    return this.props.children;
  }
}

// Content cache to avoid re-rendering identical content
const contentCache = new Map<string, React.ReactElement>();

const MarkdownRenderer: React.FC<Props> = memo(({ content, className = "" }) => {
  // Memoize the rendered content to avoid unnecessary re-renders
  const renderedContent = useMemo(() => {
    // Check cache first
    if (contentCache.has(content)) {
      return contentCache.get(content)!;
    }

    // For very long content, consider truncating or lazy loading
    const shouldTruncate = content.length > 10000; // 10KB threshold
    const displayContent = shouldTruncate ? content.substring(0, 10000) + "\n\n*[Content truncated for performance]*" : content;

    const element = (
      <MarkdownErrorBoundary content={content}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[]}
          components={markdownComponents}
        >
          {displayContent}
        </ReactMarkdown>
      </MarkdownErrorBoundary>
    );

    // Cache the result for future use (limit cache size)
    if (contentCache.size < 50) {
      contentCache.set(content, element);
    }

    return element;
  }, [content]);

  return (
    <div className={`prose max-w-none markdown-content ${className}`}>
      {renderedContent}
    </div>
  );
});

MarkdownRenderer.displayName = 'MarkdownRenderer';

export default MarkdownRenderer; 