"use client";

import React from "react";
import { ChatComponent } from "@/components/ChatComponent";
import { ChatProvider } from "@/components/flow/context/ChatContext";

export default function ChatPage() {
  return (
    <div className="flex flex-1 bg-gray-50">
      <div className="flex-1 p-6 md:p-10">
        <div className="max-w-4xl mx-auto h-full">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Chat Assistant</h1>
            <p className="text-gray-600">
              Interact with our AI assistant to help with your lore, stories, and worldbuilding projects.
            </p>
          </div>
          
          <div className="h-[600px] lg:h-[700px]">
            <ChatProvider>
              <ChatComponent />
            </ChatProvider>
          </div>
        </div>
      </div>
    </div>
  );
} 