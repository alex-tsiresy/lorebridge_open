"use client";

import React, { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { ChatComponent } from "./ChatComponent";
import { ChatProvider } from "./flow/context/ChatContext";
import { cn } from "@/lib/utils";

export const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 p-4 custom-bg-accent text-white rounded-full shadow-lg hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 custom-ring-accent"
          title="Open AI Chat"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat Widget */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[600px] shadow-2xl rounded-lg overflow-hidden bg-white border border-gray-200">
          {/* Header with close button */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 custom-bg-accent text-white">
            <h3 className="font-semibold">AI Assistant</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
              title="Close chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          {/* Chat Content */}
          <div className="h-[calc(600px-60px)]">
            <ChatProvider>
              <ChatComponent />
            </ChatProvider>
          </div>
        </div>
      )}
    </>
  );
};

interface EmbeddedChatProps {
  className?: string;
  height?: string;
}

export const EmbeddedChat = ({ 
  className, 
  height = "h-[400px]" 
}: EmbeddedChatProps) => {
  return (
    <div className={cn("bg-white rounded-lg shadow-sm border border-gray-200", height, className)}>
      <ChatProvider>
        <ChatComponent />
      </ChatProvider>
    </div>
  );
}; 