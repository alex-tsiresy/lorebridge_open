import { useEffect, useState } from 'react';

export const useResponsiveSize = () => {
  const [sizes, setSizes] = useState({
    button: 'w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8',
    buttonIcon: 'w-3 h-3 sm:w-4 sm:h-4 md:w-4 md:h-4',
    toolbarButton: 'w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 lg:w-10 lg:h-10',
    toolbarIcon: 'h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 lg:h-5 lg:w-5',
    emoji: 'h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6',
    text: 'text-xs sm:text-sm md:text-base',
    padding: 'px-2 py-1 sm:px-3 sm:py-2',
    gap: 'gap-1 sm:gap-2'
  });
  
  useEffect(() => {
    const updateSizes = () => {
      const vh = window.innerHeight;
      
      if (vh <= 500) {
        setSizes({
          button: 'w-5 h-5',
          buttonIcon: 'w-2.5 h-2.5',
          toolbarButton: 'w-6 h-6',
          toolbarIcon: 'h-2.5 w-2.5',
          emoji: 'h-3 w-3',
          text: 'text-xs',
          padding: 'px-1.5 py-0.5',
          gap: 'gap-1'
        });
      } else if (vh <= 600) {
        setSizes({
          button: 'w-5 h-5',
          buttonIcon: 'w-3 h-3',
          toolbarButton: 'w-7 h-7',
          toolbarIcon: 'h-3 w-3',
          emoji: 'h-3.5 w-3.5',
          text: 'text-xs',
          padding: 'px-2 py-1',
          gap: 'gap-1'
        });
      } else if (vh <= 700) {
        setSizes({
          button: 'w-6 h-6',
          buttonIcon: 'w-3 h-3',
          toolbarButton: 'w-8 h-8',
          toolbarIcon: 'h-3.5 w-3.5',
          emoji: 'h-4 w-4',
          text: 'text-xs',
          padding: 'px-2 py-1',
          gap: 'gap-1'
        });
      } else if (vh <= 800) {
        setSizes({
          button: 'w-6 h-6',
          buttonIcon: 'w-3.5 h-3.5',
          toolbarButton: 'w-9 h-9',
          toolbarIcon: 'h-4 w-4',
          emoji: 'h-4 w-4',
          text: 'text-sm',
          padding: 'px-2 py-1',
          gap: 'gap-1.5'
        });
      } else {
        setSizes({
          button: 'w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8',
          buttonIcon: 'w-3 h-3 sm:w-4 sm:h-4 md:w-4 md:h-4',
          toolbarButton: 'w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 lg:w-10 lg:h-10',
          toolbarIcon: 'h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 lg:h-5 lg:w-5',
          emoji: 'h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6',
          text: 'text-xs sm:text-sm md:text-base',
          padding: 'px-2 py-1 sm:px-3 sm:py-2',
          gap: 'gap-1 sm:gap-2'
        });
      }
    };
    
    updateSizes();
    window.addEventListener('resize', updateSizes);
    
    return () => window.removeEventListener('resize', updateSizes);
  }, []);
  
  return sizes;
};