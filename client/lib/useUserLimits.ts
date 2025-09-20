import { useState, useEffect } from 'react';
import { useSubscription } from './useSubscription';
import { useGraphs } from './useGraphs';

export interface UserLimits {
  maxBoards: number;
  maxNodesPerBoard: number;
  currentBoardCount: number;
  canCreateBoard: boolean;
  canCreateNode: (graphId?: string, currentNodeCount?: number) => boolean;
  getBoardLimitMessage: () => string;
  getNodeLimitMessage: () => string;
  isAtBoardLimit: boolean;
}

export const useUserLimits = () => {
  const { isProUser, isFreeUser, loading: subscriptionLoading } = useSubscription();
  const { graphs, loading: graphsLoading } = useGraphs();
  
  const [userLimits, setUserLimits] = useState<UserLimits>({
    maxBoards: 0,
    maxNodesPerBoard: 0,
    currentBoardCount: 0,
    canCreateBoard: false,
    canCreateNode: () => false,
    getBoardLimitMessage: () => '',
    getNodeLimitMessage: () => '',
    isAtBoardLimit: false,
  });

  const loading = subscriptionLoading || graphsLoading;

  useEffect(() => {
    if (loading) return;

    const maxBoards = isProUser ? Infinity : 3;
    const maxNodesPerBoard = isProUser ? Infinity : 8;
    const currentBoardCount = graphs.length;
    const canCreateBoard = currentBoardCount < maxBoards;
    const isAtBoardLimit = currentBoardCount >= maxBoards;

    const canCreateNode = (_graphId?: string, currentNodeCount?: number) => {
      if (isProUser) return true;
      if (currentNodeCount !== undefined) {
        return currentNodeCount < maxNodesPerBoard;
      }
      // If no count provided, assume we can create (will be checked server-side)
      return true;
    };

    const getBoardLimitMessage = () => {
      if (isProUser) {
        return 'Pro users can create unlimited boards';
      }
      return `Free users are limited to ${maxBoards} boards. You have ${currentBoardCount}/${maxBoards} boards.`;
    };

    const getNodeLimitMessage = () => {
      if (isProUser) {
        return 'Pro users can create unlimited nodes per board';
      }
      return `Free users are limited to ${maxNodesPerBoard} nodes per board.`;
    };

    setUserLimits({
      maxBoards,
      maxNodesPerBoard,
      currentBoardCount,
      canCreateBoard,
      canCreateNode,
      getBoardLimitMessage,
      getNodeLimitMessage,
      isAtBoardLimit,
    });
  }, [isProUser, isFreeUser, graphs, loading]);

  return {
    ...userLimits,
    loading,
    isProUser,
    isFreeUser,
  };
};