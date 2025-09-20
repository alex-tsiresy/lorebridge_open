import { useMemo, useCallback, useRef } from 'react';

interface NodeContentData {
  content: string;
  type: string;
  id: string;
  isLoading?: boolean;
  error?: string | null;
}

interface UseNodeContentOptimizationProps {
  nodeData: NodeContentData;
  maxContentLength?: number;
  enableVirtualization?: boolean;
}

export const useNodeContentOptimization = ({
  nodeData,
  maxContentLength = 10000,
  enableVirtualization = true
}: UseNodeContentOptimizationProps) => {
  const contentCache = useRef<Map<string, { content: string; timestamp: number }>>(new Map());
  const cacheTimeout = 5 * 60 * 1000; // 5 minutes

  // Memoize content processing
  const processedContent = useMemo(() => {
    const { content, type, id } = nodeData;
    
    // Check cache first
    const cached = contentCache.current.get(id);
    if (cached && Date.now() - cached.timestamp < cacheTimeout) {
      return cached.content;
    }

    // Process content based on type and length
    let processed = content;
    
    if (enableVirtualization && content.length > maxContentLength) {
      processed = content.substring(0, maxContentLength) + '\n\n*[Content truncated for performance]*';
    }

    // Cache the processed content
    contentCache.current.set(id, {
      content: processed,
      timestamp: Date.now()
    });

    // Clean up old cache entries
    const now = Date.now();
    for (const [key, value] of contentCache.current.entries()) {
      if (now - value.timestamp > cacheTimeout) {
        contentCache.current.delete(key);
      }
    }

    return processed;
  }, [nodeData.content, nodeData.id, nodeData.type, maxContentLength, enableVirtualization]);

  // Memoize content rendering decision
  const shouldRenderContent = useMemo(() => {
    if (nodeData.isLoading) return false;
    if (nodeData.error) return false;
    return processedContent.length > 0;
  }, [nodeData.isLoading, nodeData.error, processedContent]);

  // Memoize content type for rendering optimization
  const contentType = useMemo(() => {
    if (processedContent.includes('```')) return 'code';
    if (processedContent.includes('|')) return 'table';
    if (processedContent.includes('http')) return 'links';
    return 'text';
  }, [processedContent]);

  // Clear cache for specific node
  const clearCache = useCallback((nodeId: string) => {
    contentCache.current.delete(nodeId);
  }, []);

  // Clear all cache
  const clearAllCache = useCallback(() => {
    contentCache.current.clear();
  }, []);

  return {
    processedContent,
    shouldRenderContent,
    contentType,
    clearCache,
    clearAllCache,
    isCached: contentCache.current.has(nodeData.id)
  };
}; 