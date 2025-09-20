import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import MarkdownRenderer from './MarkdownRenderer';

interface VirtualizedContentProps {
  content: string;
  maxHeight?: number;
  className?: string;
  onLoadMore?: () => void;
  isLoading?: boolean;
}

const VirtualizedContent: React.FC<VirtualizedContentProps> = memo(({
  content,
  maxHeight = 400,
  className = "",
  onLoadMore,
  isLoading = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldShowExpand, setShouldShowExpand] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Check if content should be truncated
  useEffect(() => {
    if (contentRef.current && containerRef.current) {
      const contentHeight = contentRef.current.scrollHeight;
      const containerHeight = containerRef.current.clientHeight;
      setShouldShowExpand(contentHeight > containerHeight);
    }
  }, [content]);

  const handleExpand = useCallback(() => {
    setIsExpanded(true);
    if (onLoadMore) {
      onLoadMore();
    }
  }, [onLoadMore]);

  const handleCollapse = useCallback(() => {
    setIsExpanded(false);
  }, []);

  // Memoize the content to prevent unnecessary re-renders
  const renderedContent = React.useMemo(() => (
    <MarkdownRenderer content={content} className={className} />
  ), [content, className]);

  return (
    <div 
      ref={containerRef}
      className={`overflow-hidden transition-all duration-300 ${className}`}
      style={{ 
        maxHeight: isExpanded ? 'none' : `${maxHeight}px`,
        position: 'relative'
      }}
    >
      <div ref={contentRef}>
        {renderedContent}
      </div>
      
      {/* Gradient overlay for truncated content */}
      {!isExpanded && shouldShowExpand && (
        <div 
          className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none"
          style={{ maxHeight: '32px' }}
        />
      )}
      
      {/* Expand/Collapse button */}
      {shouldShowExpand && (
        <div className="flex justify-center mt-2">
          <button
            onClick={isExpanded ? handleCollapse : handleExpand}
            className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center gap-1"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Loading...
              </>
            ) : isExpanded ? (
              'Show Less'
            ) : (
              'Show More'
            )}
          </button>
        </div>
      )}
    </div>
  );
});

VirtualizedContent.displayName = 'VirtualizedContent';

export default VirtualizedContent; 