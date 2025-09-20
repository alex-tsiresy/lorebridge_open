import { useState, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useFullScreen } from '../context/FullScreenContext';
import { logger } from '@/lib/logger';

export const useNodeClickHandler = (nodeId: string) => {
  const { fitView } = useReactFlow();
  const { setFullScreenNodeId } = useFullScreen();
  
  // Triple-click tracking
  const [clickCount, setClickCount] = useState(0);
  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null);

  // Handle double-click to focus node and triple-click to enter full screen
  const handleClick = () => {
    const newClickCount = clickCount + 1;
    setClickCount(newClickCount);

    // Clear existing timer
    if (clickTimer) {
      clearTimeout(clickTimer);
    }

    if (newClickCount === 2) {
      // Double-click: focus on the node
      logger.log('🔄 DOUBLE-CLICK FOCUS:', { nodeId });
      fitView({ 
        nodes: [{ id: nodeId }], 
        duration: 800,
        padding: 0.2 
      });
      
      // Set timer for potential third click
      const timer = setTimeout(() => {
        setClickCount(0);
        setClickTimer(null);
      }, 400);
      setClickTimer(timer);
    } else if (newClickCount === 3) {
      // Triple-click: enter full screen
      logger.log('🔄 TRIPLE-CLICK FULLSCREEN:', { nodeId });
      setFullScreenNodeId(nodeId);
      setClickCount(0);
      setClickTimer(null);
    } else {
      // First click: set timer to reset if no follow-up clicks
      const timer = setTimeout(() => {
        setClickCount(0);
        setClickTimer(null);
      }, 400);
      setClickTimer(timer);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (clickTimer) {
        clearTimeout(clickTimer);
      }
    };
  }, [clickTimer]);

  return { handleClick };
}; 