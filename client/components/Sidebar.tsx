"use client";

import React, { useState, createContext, useContext, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import { Slot } from '@radix-ui/react-slot';
import * as Separator from '@radix-ui/react-separator';
import { 
  Menu, 
  X, 
  User,
  PenTool,
  LayoutGrid,
  Heart,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  breakpoint: 'mobile' | 'tablet' | 'desktop';
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

// Breakpoint utilities
const useBreakpoint = () => {
  const [breakpoint, setBreakpoint] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');

  useEffect(() => {
    const checkBreakpoint = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setBreakpoint('mobile');
      } else if (width < 1024) {
        setBreakpoint('tablet');
      } else {
        setBreakpoint('desktop');
      }
    };
    
    checkBreakpoint();
    window.addEventListener('resize', checkBreakpoint);
    return () => window.removeEventListener('resize', checkBreakpoint);
  }, []);

  return breakpoint;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const [openState, setOpenState] = useState(false);
  const breakpoint = useBreakpoint();

  const isMobile = breakpoint === 'mobile';
  const isTablet = breakpoint === 'tablet';
  const isDesktop = breakpoint === 'desktop';

  // On mobile, use props if provided (for controlled open state)
  // On desktop, always use internal state for hover-based expansion/collapse
  const open = isMobile && openProp !== undefined ? openProp : openState;
  const setOpen = isMobile && setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, breakpoint }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
  const { children, className } = props;
  return (
    <DesktopSidebar {...props}>
      {children as React.ReactNode}
    </DesktopSidebar>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, breakpoint } = useSidebar();
  const isTablet = breakpoint === 'tablet';
  
  return (
    <motion.div
      className={cn(
        "fixed left-0 top-0 h-full px-3 lg:px-4 py-4 hidden lg:flex lg:flex-col bg-white border-r border-gray-200 flex-shrink-0 z-50",
        className
      )}
      animate={{
        width: open ? (isTablet ? "240px" : "280px") : "64px",
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

interface NavigationItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const SidebarLink = ({
  item,
  className,
  onClick,
  asChild = false,
  ...props
}: {
  item: NavigationItem;
  className?: string;
  onClick?: () => void;
  asChild?: boolean;
}) => {
  const Icon = item.icon;
  const { open, breakpoint } = useSidebar();
  const isMobile = breakpoint === 'mobile';
  const Comp = asChild ? Slot : "button";
  
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "flex items-center justify-start gap-2 lg:gap-3 group/sidebar py-2 lg:py-3 px-2 lg:px-3 rounded-lg transition-all duration-200 w-full text-left custom-hover",
        className
      )}
      {...props}
    >
      <Icon className="h-4 lg:h-5 w-4 lg:w-5 flex-shrink-0 text-gray-500" />
      {(open || isMobile) && (
        <motion.span
          className="text-gray-900 text-xs lg:text-sm group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0"
        >
          {item.label}
        </motion.span>
      )}
    </Comp>
  );
};

export const Logo = () => {
  const { open, breakpoint } = useSidebar();
  const isMobile = breakpoint === 'mobile';
  
  return (
    <div className="flex items-center mb-6 lg:mb-8">
      <div className="flex items-center justify-start w-full">
        {(open || isMobile) ? (
          <Image 
            src="/logo.png" 
            alt="LoreBridge logo" 
            width={400}
            height={60}
            className="h-12 lg:h-16 w-full max-w-none object-contain transition-all duration-200"
          />
        ) : (
          <div className="h-12 lg:h-16 w-12 lg:w-16 flex items-center justify-center">
            <Image 
              src="/logo_small.png" 
              alt="LoreBridge icon" 
              width={64}
              height={64}
              className="h-12 lg:h-16 w-12 lg:w-16 object-contain"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export const UserProfileSidebar = ({ 
  onClick, 
  isActive 
}: { 
  onClick?: () => void;
  isActive?: boolean;
}) => {
  const { user } = useUser();
  const { open, breakpoint } = useSidebar();
  const isMobile = breakpoint === 'mobile';
  
  return (
    <>
      <Separator.Root className="my-2 bg-gray-200 h-px" />
      <button
        onClick={onClick}
        className={cn(
          "flex items-center space-x-2 lg:space-x-3 py-2 w-full rounded-lg transition-all duration-200 text-left custom-hover",
          isActive ? "custom-active" : "",
          onClick ? "cursor-pointer" : ""
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
        {(open || isMobile) && (
          <motion.div className="flex flex-col">
            <span className="text-xs lg:text-sm font-medium text-gray-900">
              {user?.firstName || user?.username || "Creator"}
            </span>
            <span className="text-xs text-gray-500 hidden lg:block">
              {user?.emailAddresses[0]?.emailAddress || "User"}
            </span>
          </motion.div>
        )}
      </button>
    </>
  );
};

export const navigationItems: NavigationItem[] = [
  { label: "Boards", href: "/whiteboard", icon: LayoutGrid },
  { label: "Favorites", href: "/favorites", icon: Heart },
  { label: "Recent", href: "/recent", icon: Clock },
]; 