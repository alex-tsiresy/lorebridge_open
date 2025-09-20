"use client";

import React, { useState, useEffect } from "react";
import { LogOut, LayoutGrid, Heart, Clock, User } from "lucide-react";
import { useClerk, useUser } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import * as NavigationMenu from '@radix-ui/react-navigation-menu';
import * as Collapsible from '@radix-ui/react-collapsible';
import * as Separator from '@radix-ui/react-separator';
import { cn } from "@/lib/utils";

import { WhiteBoardView } from "./WhiteBoardView";
import UserProfile from "./UserProfile";
import BoardsView from "./BoardsView";
import { TrialBanner } from "./TrialBanner";
import { FavoritesView } from "./FavoritesView";
import { RecentView } from "./RecentView";
import { useApiClient } from "@/lib/useApiClient";
import { logger } from '@/lib/logger';

// Stylish global grid overlay copied from `client/app/page.tsx`
function StylishGridOverlay() {
  const GRID_SIZE_PX = 100; // keep lines and dots perfectly aligned
  const lineColor = 'rgba(30,64,175,0.08)';
  const dotColor = 'rgba(196, 68, 222, 0.18)';
  return (
    <div
      className="absolute inset-0 pointer-events-none z-0"
      aria-hidden
      style={{
        backgroundImage: `
          radial-gradient(circle at 50% 50%, ${dotColor} 2.4px, transparent 2.5px),
          linear-gradient(to right, ${lineColor} 1px, transparent 1px),
          linear-gradient(to bottom, ${lineColor} 1px, transparent 1px),
          radial-gradient(ellipse at 20% 10%, rgba(99,102,241,0.08), transparent 50%),
          radial-gradient(ellipse at 80% 60%, rgba(59,130,246,0.06), transparent 50%)
        `,
        backgroundSize: `${GRID_SIZE_PX}px ${GRID_SIZE_PX}px, ${GRID_SIZE_PX}px ${GRID_SIZE_PX}px, ${GRID_SIZE_PX}px ${GRID_SIZE_PX}px, auto, auto`,
        backgroundPosition: '0 0, 0 0, 0 0, 0 0, 0 0',
        backgroundRepeat: 'repeat',
        backgroundBlendMode: 'normal, normal, normal, soft-light, soft-light',
      }}
    />
  );
}

interface NavigationItem {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navigationItems: NavigationItem[] = [
  { label: "Boards", value: "boards", icon: LayoutGrid },
  { label: "Favorites", value: "favorites", icon: Heart },
  { label: "Recent", value: "recent", icon: Clock },
];

// Animation variants for fast, modern transitions
const pageVariants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  in: {
    opacity: 1,
    y: 0,
  },
  out: {
    opacity: 0,
    y: -8,
  },
};

const pageTransition = {
  type: "tween" as const,
  ease: "easeOut" as const,
  duration: 0.15,
};

const contentVariants = {
  initial: {
    opacity: 0,
    scale: 0.98,
  },
  animate: {
    opacity: 1,
    scale: 1,
  },
  exit: {
    opacity: 0,
    scale: 0.98,
  },
};

const whiteboardVariants = {
  initial: {
    opacity: 0,
    scale: 0.9,
  },
  animate: {
    opacity: 1,
    scale: 1,
  },
  exit: {
    opacity: 0,
    scale: 0.9,
  },
};

// Enhanced breakpoint utilities for consistent card proportions
const useBreakpoint = () => {
  const [breakpoint, setBreakpoint] = useState<'mobile' | 'tablet' | 'desktop' | 'wide'>('desktop');
  const [containerWidth, setContainerWidth] = useState<number>(1200);

  useEffect(() => {
    const checkBreakpoint = () => {
      const width = window.innerWidth;
      setContainerWidth(width);
      
      if (width < 480) {
        setBreakpoint('mobile');
      } else if (width < 768) {
        setBreakpoint('tablet');
      } else if (width < 1440) {
        setBreakpoint('desktop');
      } else {
        setBreakpoint('wide');
      }
    };
    
    checkBreakpoint();
    window.addEventListener('resize', checkBreakpoint);
    return () => window.removeEventListener('resize', checkBreakpoint);
  }, []);

  return { breakpoint, containerWidth };
};

export function DashboardLayout() {
  const [activeItem, setActiveItem] = useState("boards");
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const { breakpoint, containerWidth } = useBreakpoint();
  const { signOut } = useClerk();
  const { user } = useUser();
  const apiClient = useApiClient();

  const isDesktop = breakpoint === 'desktop' || breakpoint === 'wide';

  // Calculate responsive padding and spacing based on container width and breakpoint
  const getResponsiveSpacing = () => {
    switch (breakpoint) {
      case 'mobile':
        return {
          padding: 'p-3',
          maxWidth: 'max-w-full',
          gap: 'gap-3'
        };
      case 'tablet':
        return {
          padding: 'p-4 sm:p-6',
          maxWidth: 'max-w-6xl',
          gap: 'gap-4'
        };
      case 'desktop':
        return {
          padding: 'p-6 lg:p-8',
          maxWidth: 'max-w-7xl',
          gap: 'gap-6'
        };
      case 'wide':
        return {
          padding: 'p-8 xl:p-10',
          maxWidth: 'max-w-7xl xl:max-w-screen-2xl',
          gap: 'gap-8'
        };
      default:
        return {
          padding: 'p-4 sm:p-6 lg:p-10',
          maxWidth: 'max-w-7xl',
          gap: 'gap-4'
        };
    }
  };

  const spacing = getResponsiveSpacing();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      logger.error("Error signing out:", error);
    }
  };

  const handleGraphSelect = async (graphId: string) => {
    try {
      setIsTransitioning(true);
      // Record graph access when selected
      await apiClient.recordGraphAccess(graphId);
      setWhiteboardOpen(true);
      setSelectedGraphId(graphId);
    } catch (error) {
      logger.error("Failed to record graph access:", error);
      // Still open the graph even if access recording fails
      setWhiteboardOpen(true);
      setSelectedGraphId(graphId);
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleViewChange = (newView: string) => {
    setIsTransitioning(true);
    setActiveItem(newView);
    setWhiteboardOpen(false);
    setSelectedGraphId(null);
    // Reset transition state after animation
    setTimeout(() => setIsTransitioning(false), 150);
  };

  // Function to render the appropriate content based on active item with consistent spacing
  const renderContent = () => {
    const commonContainerClasses = "flex flex-1 min-h-screen w-full";

    switch (activeItem) {
      case "boards":
        return whiteboardOpen && selectedGraphId ? (
          <motion.div
            key="whiteboard"
            variants={whiteboardVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full h-full"
          >
            <WhiteBoardView graphId={selectedGraphId} onBack={() => { setWhiteboardOpen(false); setSelectedGraphId(null); }} />
          </motion.div>
        ) : (
          <motion.div
            key="boards"
            variants={contentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            className={commonContainerClasses}
          >
            <div className={`flex-1 ${spacing.padding}`}>
              <div className={`${spacing.maxWidth} mx-auto`}>
                <BoardsView onSelect={handleGraphSelect} spacing={spacing} />
              </div>
            </div>
          </motion.div>
        );
      case "favorites":
        return (
          <motion.div
            key="favorites"
            variants={contentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            className={commonContainerClasses}
          >
            <div className={`flex-1 ${spacing.padding}`}>
              <div className={`${spacing.maxWidth} mx-auto`}>
                <FavoritesView onSelect={handleGraphSelect} spacing={spacing} />
              </div>
            </div>
          </motion.div>
        );
      case "recent":
        return (
          <motion.div
            key="recent"
            variants={contentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            className={commonContainerClasses}
          >
            <div className={`flex-1 ${spacing.padding}`}>
              <div className={`${spacing.maxWidth} mx-auto`}>
                <RecentView onSelect={handleGraphSelect} spacing={spacing} />
              </div>
            </div>
          </motion.div>
        );
      case "profile":
        return (
          <motion.div
            key="profile"
            variants={contentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            className={commonContainerClasses}
          >
            <div className={`flex-1 ${spacing.padding}`}>
              <div className={`${spacing.maxWidth} mx-auto`}>
                <UserProfile />
              </div>
            </div>
          </motion.div>
        );
      default:
        return whiteboardOpen && selectedGraphId ? (
          <motion.div
            key="whiteboard-default"
            variants={whiteboardVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full h-full"
          >
            <WhiteBoardView graphId={selectedGraphId} onBack={() => { setWhiteboardOpen(false); setSelectedGraphId(null); }} />
          </motion.div>
        ) : (
          <motion.div
            key="boards-default"
            variants={contentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
            className={commonContainerClasses}
          >
            <div className={`flex-1 ${spacing.padding}`}>
              <div className={`${spacing.maxWidth} mx-auto`}>
                <BoardsView onSelect={handleGraphSelect} spacing={spacing} />
              </div>
            </div>
          </motion.div>
        );
    }
  };

  // If whiteboard is open, render it as a standalone full-screen view with animation
  if (whiteboardOpen && selectedGraphId) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full h-full"
      >
        <WhiteBoardView graphId={selectedGraphId} onBack={() => { setWhiteboardOpen(false); setSelectedGraphId(null); }} />
      </motion.div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-white relative overflow-hidden">
      {/* Global stylish grid overlay */}
      <StylishGridOverlay />
      {/* Desktop Sidebar */}
      <Collapsible.Root 
        open={sidebarOpen} 
        onOpenChange={setSidebarOpen}
        className="hidden lg:block"
      >
        <motion.div
          className="fixed left-0 top-0 h-full px-3 lg:px-4 py-4 flex flex-col bg-white border-r border-gray-200 flex-shrink-0 z-50 overflow-hidden"
          animate={{
            width: sidebarOpen ? "280px" : "80px",
          }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          onMouseEnter={() => setSidebarOpen(true)}
          onMouseLeave={() => setSidebarOpen(false)}
        >
          {/* Logo */}
          <div 
            className="flex items-center mb-6 lg:mb-8"
          >
            <div className="flex items-center w-full -mx-3 lg:-mx-4">
              <Link href="/" className="flex items-center gap-1 lg:gap-2 hover:opacity-80 transition-opacity">
                <div className="w-20 flex items-center justify-center">
                  <div className="h-12 lg:h-16 w-12 lg:w-16 flex items-center justify-center">
                    <Image 
                      src="/logo_small.png" 
                      alt="LoreBridge icon" 
                      width={48}
                      height={48}
                      className="h-10 w-10 object-contain"
                    />
                  </div>
                </div>
                {sidebarOpen && (
                  <span
                    className="-ml-2 lg:-ml-3 text-lg lg:text-2xl font-semibold text-gray-900"
                  >
                    lorebridge
                  </span>
                )}
              </Link>
            </div>
          </div>

          {/* Navigation Menu */}
          <NavigationMenu.Root orientation="vertical" className="flex-1">
            <NavigationMenu.List className="flex flex-col gap-1 lg:gap-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.value}>
                    <NavigationMenu.Item value={item.value}>
                      <NavigationMenu.Link asChild>
                        <button
                          onClick={() => handleViewChange(item.value)}
                          disabled={isTransitioning}
                          className={cn(
                            "flex items-center justify-start gap-2 lg:gap-3 group/sidebar py-2 lg:py-3 px-2 lg:px-3 rounded-none transition-all duration-200 w-full text-left custom-hover",
                            activeItem === item.value ? "custom-active" : ""
                          )}
                        >
                          <Icon className="h-4 lg:h-5 w-4 lg:w-5 flex-shrink-0 text-gray-500" />
                          {sidebarOpen && (
                            <span
                              className="text-gray-900 text-xs lg:text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0"
                            >
                              {item.label}
                            </span>
                          )}
                        </button>
                      </NavigationMenu.Link>
                    </NavigationMenu.Item>
                  </div>
                );
              })}
            </NavigationMenu.List>
          </NavigationMenu.Root>

          {/* User Profile and Logout */}
          <motion.div 
            className="pt-4 flex flex-col items-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, delay: 0.1 }}
          >
            <Separator.Root className="my-2 bg-gray-200 h-px w-full" />
            <button
              onClick={() => handleViewChange("profile")}
              disabled={isTransitioning}
              className={cn(
                "flex items-center space-x-2 lg:space-x-3 py-2 w-full rounded-lg transition-all duration-200 text-left custom-hover",
                activeItem === "profile" ? "custom-active" : ""
              )}
            >
              <div className="h-6 lg:h-8 w-6 lg:w-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden ml-1 lg:ml-2">
                {user?.imageUrl ? (
                  <Image 
                    src={user.imageUrl} 
                    alt="User avatar" 
                    width={32}
                    height={32}
                    className="h-full w-full rounded-full object-cover object-center"
                  />
                ) : (
                  <User className="h-3 lg:h-4 w-3 lg:w-4 text-gray-600" />
                )}
              </div>
              {sidebarOpen && (
                <motion.div className="flex flex-col">
                  <span className="text-xs lg:text-sm font-medium text-gray-900">
                    {user?.firstName || user?.username || user?.emailAddresses[0]?.emailAddress || "User"}
                  </span>
                  <span className="text-xs text-gray-500 hidden lg:block">
                    {user?.emailAddresses[0]?.emailAddress || "User"}
                  </span>
                </motion.div>
              )}
            </button>
            <button
              onClick={handleSignOut}
              disabled={isTransitioning}
              className={cn(
                "flex items-center justify-start gap-2 lg:gap-3 group/sidebar py-2 lg:py-3 px-2 lg:px-3 rounded-lg transition-all duration-200 text-red-600 hover:bg-red-50 hover:text-red-600 mt-2 w-full text-left",
                ""
              )}
            >
              <LogOut className="h-4 lg:h-5 w-4 lg:w-5 flex-shrink-0" />
              {sidebarOpen && (
                <motion.span className="text-xs lg:text-sm whitespace-pre">
                  Logout
                </motion.span>
              )}
            </button>
          </motion.div>
        </motion.div>
      </Collapsible.Root>

      {/* Top Bar for Mobile and Tablet */}
      <motion.div 
        className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200"
        initial={{ y: -50 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.15 }}
      >
        {/* Mobile Top Bar */}
        <div className="sm:hidden">
          <div className="h-14 px-3 py-2 flex items-center justify-between">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 flex items-center justify-center">
                  <Image 
                    src="/logo_small.png" 
                    alt="LoreBridge icon" 
                    width={32}
                    height={32}
                    className="h-7 w-7 object-contain"
                  />
                </div>
                <span className="text-lg font-semibold text-gray-900">lorebridge</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleViewChange("profile")}
                  disabled={isTransitioning}
                  className={`p-2 rounded-lg transition-colors ${
                    activeItem === "profile" 
                      ? "text-blue-600 bg-blue-50" 
                      : "text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                  }`}
                  title="Profile"
                >
                  <User className="h-4 w-4" />
                </button>
                <button
                  onClick={handleSignOut}
                  disabled={isTransitioning}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
          
          {/* Mobile Navigation Tabs */}
          <div className="px-3 pb-2">
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                    <motion.button
                    key={item.value}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleViewChange(item.value)}
                    disabled={isTransitioning}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all duration-200",
                      activeItem === item.value 
                        ? "bg-white text-gray-900 shadow-sm" 
                          : "text-gray-600 hover:text-gray-900"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden xs:inline">{item.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tablet Top Bar */}
        <div className="hidden sm:block">
          <div className="h-16 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 flex items-center justify-center">
                  <Image 
                    src="/logo_small.png" 
                    alt="LoreBridge icon" 
                    width={40}
                    height={40}
                    className="h-9 w-9 object-contain"
                  />
                </div>
                <span className="text-xl font-semibold text-gray-900">lorebridge</span>
              </div>
              
              {/* Tablet Navigation */}
              <div className="flex space-x-1">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <motion.button
                      key={item.value}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleViewChange(item.value)}
                      disabled={isTransitioning}
                      className={cn(
                        "flex items-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200",
                        activeItem === item.value 
                          ? "bg-gray-100 text-gray-900" 
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Tablet User Profile */}
            <div className="flex items-center space-x-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleViewChange("profile")}
                disabled={isTransitioning}
                className={cn(
                  "flex items-center space-x-2 py-2 px-3 rounded-lg transition-all duration-200",
                  activeItem === "profile" ? "bg-gray-100" : "hover:bg-gray-50"
                )}
              >
                <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {user?.imageUrl ? (
                    <Image 
                      src={user.imageUrl} 
                      alt="User avatar" 
                      width={32}
                      height={32}
                      className="h-full w-full rounded-full object-cover object-center"
                    />
                  ) : (
                    <User className="h-4 w-4 text-gray-600" />
                  )}
                </div>
                <span className="text-sm font-medium text-gray-900 hidden md:block">
                  {user?.firstName || user?.username || user?.emailAddresses[0]?.emailAddress || "User"}
                </span>
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSignOut}
                disabled={isTransitioning}
                className={cn(
                  "p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                )}
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <motion.div 
        className="flex-1 flex flex-col relative z-10"
        animate={{
          marginLeft: isDesktop ? (sidebarOpen ? "280px" : "80px") : "0px"
        }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        layout
      >
        {/* Top spacing for mobile/tablet top bar */}
        <div className="lg:hidden h-20 sm:h-20" />
        
        {/* Trial Banner - shows at top of dashboard when on trial */}
        <motion.div
                      initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15, delay: 0.05 }}
        >
          <TrialBanner className="mx-3 lg:mx-6 mt-3 lg:mt-6" />
        </motion.div>
        
        <div className="flex-1 relative min-h-0 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeItem}
              variants={pageVariants}
              initial="initial"
              animate="in"
              exit="out"
              transition={pageTransition}
              className="w-full h-full overflow-auto"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
          
          {/* Loading overlay during transitions */}
          <AnimatePresence>
            {isTransitioning && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-10"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
                  className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
} 