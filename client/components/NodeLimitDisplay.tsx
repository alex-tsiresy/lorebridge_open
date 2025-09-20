import React from 'react';
import { Crown } from 'lucide-react';
import { useUserLimits } from '@/lib/useUserLimits';

interface NodeLimitDisplayProps {
  currentNodeCount?: number;
  className?: string;
}

export const NodeLimitDisplay: React.FC<NodeLimitDisplayProps> = ({ 
  currentNodeCount, 
  className = '' 
}) => {
  const { 
    maxNodesPerBoard, 
    getNodeLimitMessage, 
    isProUser, 
    loading 
  } = useUserLimits();

  if (loading) return null;

  // Use provided count or 0 as fallback
  const nodeCount = currentNodeCount || 0;
  const isNearLimit = !isProUser && nodeCount >= maxNodesPerBoard - 2;
  const isAtLimit = !isProUser && nodeCount >= maxNodesPerBoard;

  return (
    <div className={`text-xs flex items-center gap-1 ${className}`}>
      {isProUser ? (
        <div className="flex items-center gap-1 text-amber-600">
          <Crown className="h-3 w-3" />
          <span>Pro</span>
        </div>
      ) : (
        <div className={`flex items-center gap-1 ${
          isAtLimit 
            ? 'text-red-600' 
            : isNearLimit 
            ? 'text-orange-600' 
            : 'text-gray-600'
        }`}>
          <span>
            {nodeCount}/{maxNodesPerBoard === Infinity ? '∞' : maxNodesPerBoard} nodes
          </span>
        </div>
      )}
    </div>
  );
};