

"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Bot, Globe, Square, Settings, Trash2, MessageCircle, Send, Loader2 } from "lucide-react";
import { useFullScreen } from '../context/FullScreenContext';
import { useReactFlow } from '@xyflow/react';
import { useChat, ChatProvider } from '../context/ChatContext';
import ChatMessages from '../../ChatMessages';
import ChatInput from '../../ChatInput';
import { cn } from "@/lib/utils";
import * as Select from "@radix-ui/react-select";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "@radix-ui/react-icons";

interface FullScreenChatProps {
  nodeId: string;
}

// Internal component that uses the ChatProvider context
function FullScreenChatContent({ nodeId }: FullScreenChatProps) {
  const { setFullScreenNodeId } = useFullScreen();
  const { getNode } = useReactFlow();
  
  // Use the ChatProvider context - this will be the same session as the ChatNode
  const {
    messages,
    isLoading,
    error,
    streamedMessage,
    activeToolInfo,
    enableWebSearch,
    setEnableWebSearch,
    sendMessage,
    cancelStream,
    clearChat,
    model,
    setModel,
    temperature,
    setTemperature,
  } = useChat();
  
  // Local state for immediate UI responsiveness
  const [localModel, setLocalModel] = useState(model);
  const [localTemperature, setLocalTemperature] = useState(temperature);
  const [localEnableWebSearch, setLocalEnableWebSearch] = useState(enableWebSearch);
  
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [collapsedToolOutputs, setCollapsedToolOutputs] = useState<{ [msgId: string]: boolean }>({});
  const [collapsedAnswers, setCollapsedAnswers] = useState<{ [msgId: string]: boolean }>({});

  // Sync session state to local state when session changes
  useEffect(() => {
    setLocalModel(model);
  }, [model]);
  
  useEffect(() => {
    setLocalTemperature(temperature);
  }, [temperature]);
  
  useEffect(() => {
    setLocalEnableWebSearch(enableWebSearch);
  }, [enableWebSearch]);

  // Sync local state changes back to session with different strategies per control type
  useEffect(() => {
    // Model changes can be debounced since they're discrete selections
    const timeoutId = setTimeout(() => {
      if (localModel !== model) {
        setModel(localModel);
      }
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [localModel, model, setModel]);

  // For temperature slider, use a longer debounce to prevent spam during dragging
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (Math.abs(localTemperature - temperature) > 0.01) { // Only sync if meaningful change
        setTemperature(localTemperature);
      }
    }, 300); // Longer debounce for slider
    return () => clearTimeout(timeoutId);
  }, [localTemperature, temperature, setTemperature]);

  useEffect(() => {
    // Boolean toggle can sync immediately
    if (localEnableWebSearch !== enableWebSearch) {
      setEnableWebSearch(localEnableWebSearch);
    }
  }, [localEnableWebSearch, enableWebSearch, setEnableWebSearch]);

  // Ensure web search and RAG steps are shown by default
  useEffect(() => {
    const newCollapsed: { [msgId: string]: boolean } = {};
    messages.forEach((message: any) => {
      if (
        message.role === 'assistant' &&
        Array.isArray(message.toolOutput) &&
        (message.toolOutput.some((step: any) => step.type === 'web_search_call') ||
         message.toolOutput.some((step: any) => step.type === 'rag_result'))
      ) {
        newCollapsed[message.id] = false;
        // Also show RAG summary by default
        if (message.toolOutput.some((step: any) => step.type === 'rag_result')) {
          newCollapsed[`${message.id}-rag`] = false;
        }
      }
    });
    setCollapsedToolOutputs((prev) => ({ ...newCollapsed, ...prev }));
    const newAnswers: { [msgId: string]: boolean } = {};
    messages.forEach((message: any) => {
      if (
        message.role === 'assistant' &&
        Array.isArray(message.toolOutput) &&
        message.toolOutput.some((step: any) => step.type === 'web_search_call')
      ) {
        newAnswers[`${message.id}-all-toolsteps`] = true;
      }
      if (
        message.role === 'assistant' &&
        Array.isArray(message.toolOutput) &&
        message.toolOutput.some((step: any) => step.type === 'rag_result')
      ) {
        newAnswers[`${message.id}-rag-details`] = true;
      }
    });
    setCollapsedAnswers((prev) => ({ ...newAnswers, ...prev }));
  }, [messages]);

  const assistantMessageIdRef = useRef<string | null>(null);
  const lastAssistantMessage = messages.filter((m: any) => m.role === 'assistant').slice(-1)[0];
  useEffect(() => {
    if (isLoading && !assistantMessageIdRef.current) {
      const nowId = `assistant-${Date.now()}`;
      assistantMessageIdRef.current = nowId;
    }
    if (!isLoading) {
      assistantMessageIdRef.current = null;
    }
  }, [isLoading, messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Optimized scroll management - less aggressive during streaming
  useEffect(() => {
    // Only scroll on new messages, not on every streamed token
    if (!isLoading) {
      scrollToBottom();
    }
  }, [messages]);

  // Gentle auto-scroll during streaming - throttled to prevent interference
  useEffect(() => {
    if (isLoading && streamedMessage) {
      // Use a longer delay and throttle scrolling during streaming
      const timeoutId = setTimeout(() => {
        // Use instant scroll during streaming to reduce performance impact
        messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      }, 500); // Increased delay to reduce frequency
      return () => clearTimeout(timeoutId);
    }
  }, [isLoading]); // Only depend on isLoading, not streamedMessage to reduce frequency

  // Scroll when tool outputs are expanded/collapsed
  useEffect(() => {
    if (
      Object.values(collapsedAnswers).some((v) => v === false) ||
      Object.values(collapsedToolOutputs).some((v) => v === false)
    ) {
      // Use a delay to ensure content is rendered before scrolling
      setTimeout(() => {
        scrollToBottom();
      }, 200);
    }
  }, [collapsedAnswers, collapsedToolOutputs]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClose = () => {
    setFullScreenNodeId(null);
  };

  const models = ["gpt-4.1-mini", "gpt-4.1", "gpt-4o", "o4-mini"];
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="fullscreen-overlay">
      <div className="h-full w-full flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 bg-gray-50/95 backdrop-blur border-r border-gray-200 flex flex-col">
          {/* Sidebar Header */}
          <div className="p-6 border-b border-gray-200 bg-white/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100">
                  <MessageCircle className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Chat Assistant</h2>
                  <p className="text-sm text-gray-500">AI-powered conversation</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 bg-gray-100 hover:bg-gray-200 transition-colors duration-200"
                title="Close full screen"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Settings Section */}
          <div className="flex-1 p-6 space-y-6 overflow-y-auto">
            {/* Model Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <Bot className="h-4 w-4 mr-2" />
                Model
              </label>
              <Select.Root 
                value={localModel} 
                onValueChange={setLocalModel} 
                disabled={isLoading}
              >
                <Select.Trigger className="w-full inline-flex items-center justify-between px-4 py-3 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 min-h-[48px]">
                  <Select.Value placeholder="Select a model..." className="font-medium" />
                  <Select.Icon className="ml-2">
                    <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content 
                    className="overflow-hidden bg-white shadow-xl border border-gray-200 min-w-[240px]" 
                    style={{ zIndex: 99999, position: 'fixed' }}
                    position="popper"
                    side="bottom"
                    align="start"
                    sideOffset={4}
                  >
                    <Select.ScrollUpButton className="flex items-center justify-center h-6 bg-white cursor-default">
                      <ChevronUpIcon />
                    </Select.ScrollUpButton>
                    <Select.Viewport className="p-1">
                      {models.map((m) => (
                        <Select.Item
                          key={m}
                          value={m}
                          className="text-sm text-gray-900 flex items-center min-h-[40px] pl-8 pr-3 py-2 relative select-none data-[disabled]:text-gray-500 data-[highlighted]:outline-none data-[highlighted]:bg-blue-50 data-[highlighted]:text-blue-900 cursor-pointer transition-colors duration-150"
                        >
                          <Select.ItemIndicator className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 flex items-center justify-center">
                            <CheckIcon className="w-3 h-3 text-blue-600" />
                          </Select.ItemIndicator>
                          <Select.ItemText className="font-medium">{m}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                    <Select.ScrollDownButton className="flex items-center justify-center h-6 bg-white cursor-default">
                      <ChevronDownIcon />
                    </Select.ScrollDownButton>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>

            {/* Temperature Control */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <Settings className="h-4 w-4 mr-2" />
                Temperature: {localTemperature}
              </label>
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={localTemperature}
                  onChange={(e) => setLocalTemperature(parseFloat(e.target.value))}
                  disabled={isLoading}
                  className="w-full h-2 bg-gray-200 appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Focused</span>
                  <span>Balanced</span>
                  <span>Creative</span>
                </div>
              </div>
            </div>

            {/* Web Search Toggle */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <Globe className="h-4 w-4 mr-2" />
                Web Search
              </label>
              <button
                onClick={() => setLocalEnableWebSearch(!localEnableWebSearch)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 border transition-all duration-200",
                  localEnableWebSearch
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                )}
                disabled={isLoading}
              >
                <span className="text-sm font-medium">
                  {localEnableWebSearch ? "Enabled" : "Disabled"}
                </span>
                <div className={cn(
                  "w-12 h-6 transition-colors duration-200 relative",
                  localEnableWebSearch ? "bg-blue-500" : "bg-gray-300"
                )}>
                  <div className={cn(
                    "absolute top-0.5 w-5 h-5 bg-white transition-transform duration-200",
                    localEnableWebSearch ? "translate-x-6" : "translate-x-0.5"
                  )} />
                </div>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6">
            
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden relative bg-white">
            <div className="px-6 py-8 pb-32">
              <div className="max-w-4xl mx-auto">
                <ChatMessages
                  messages={messages}
                  isLoading={isLoading}
                  error={error}
                  streamedMessage={streamedMessage}
                  activeToolInfo={activeToolInfo ?? []}
                  collapsedToolOutputs={collapsedToolOutputs}
                  setCollapsedToolOutputs={setCollapsedToolOutputs}
                  collapsedAnswers={collapsedAnswers}
                  setCollapsedAnswers={setCollapsedAnswers}
                  messagesEndRef={messagesEndRef as React.RefObject<HTMLDivElement>}
                  assistantMessageIdRef={assistantMessageIdRef}
                  lastAssistantMessage={lastAssistantMessage}
                />
              </div>
            </div>
          </div>
          
          {/* Floating Chat Input Area */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10">
            <div className="w-[600px]">
              {/* Floating Stop Button - Above Input */}
              {isLoading && cancelStream && (
                <div className="flex justify-center mb-2">
                  <button
                    onClick={cancelStream}
                    className="p-3 bg-red-500 hover:bg-red-600 text-white shadow-lg transition-all duration-200 hover:scale-105"
                    title="Stop Generation"
                  >
                    <Square className="h-5 w-5" />
                  </button>
                </div>
              )}
              
              {/* Floating Input */}
              <div className="bg-white/95 backdrop-blur-sm border border-gray-200 shadow-lg overflow-hidden">
                <div className="p-4">
                  <div className="flex space-x-2">
                    <div className="flex-1 relative">
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Type your message..."
                        className="w-full px-4 py-3 border-0 bg-transparent resize-none focus:outline-none text-gray-900 placeholder-gray-500 scrollbar-hide"
                        rows={1}
                        style={{ 
                          minHeight: '48px', 
                          maxHeight: '120px', 
                          height: 'auto',
                          scrollbarWidth: 'none',
                          msOverflowStyle: 'none'
                        }}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = 'auto';
                          target.style.height = target.scrollHeight + 'px';
                        }}
                        disabled={isLoading}
                      />
                    </div>
                    <button
                      onClick={handleSend}
                      disabled={!input.trim() || isLoading}
                      className={cn(
                        "p-2 text-blue-500 hover:text-blue-600 transition-all duration-200 focus:outline-none",
                        (!input.trim() || isLoading) && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {isLoading ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : (
                        <Send className="h-6 w-6" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main component that uses the ChatProvider registry to get the same provider instance
export function FullScreenChat({ nodeId }: FullScreenChatProps) {
  const { getNode } = useReactFlow();
  const node = getNode(nodeId);
  const nodeData = node?.data as any;
  
  // Use the exact same sessionId logic as ChatNode to ensure perfect synchronization
  const sessionId = nodeData?.content_id || `chat-node-${nodeId}`;
  
  // The ChatProvider now uses shared state through ChatSessionManager
  // This ensures we get the exact same state that the ChatNode is using, 
  // including streaming state like isLoading, streamedMessage, and activeToolInfo
  return (
    <ChatProvider sessionId={sessionId}>
      <FullScreenChatContent nodeId={nodeId} />
    </ChatProvider>
  );
} 