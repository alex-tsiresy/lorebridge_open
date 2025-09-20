"use client";

import React, { useState, useRef, useEffect } from "react";
import ChatHeader from "./ChatHeader";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import { useChat } from "./flow/context/ChatContext";

interface ChatComponentProps {
  sessionId?: string;
  stickyNoteStyle?: {
    className: string;
    style: React.CSSProperties;
  };
  selected?: boolean;
}

export const ChatComponent = ({ stickyNoteStyle }: ChatComponentProps) => {
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
  
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [collapsedToolOutputs, setCollapsedToolOutputs] = useState<{ [msgId: string]: boolean }>({});
  const [collapsedAnswers, setCollapsedAnswers] = useState<{ [msgId: string]: boolean }>({});

  // Ensure web search and RAG steps are shown by default
  useEffect(() => {
    const newCollapsed: { [msgId: string]: boolean } = {};
    messages.forEach((message) => {
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
    messages.forEach((message) => {
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
  const lastAssistantMessage = messages.filter(m => m.role === 'assistant').slice(-1)[0];
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
  }, [messages, isLoading]);

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
  }, [isLoading, streamedMessage]);

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

  // Apply sticky note styling if provided, otherwise use default
  const containerClassName = stickyNoteStyle 
    ? `flex flex-col h-full ${stickyNoteStyle.className}` 
    : "flex flex-col h-full bg-white border border-gray-200 rounded-lg shadow-sm";
  
  const containerStyle = stickyNoteStyle?.style || {};

  // Add corner fold effect for sticky note
  const cornerFoldStyle = stickyNoteStyle ? {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    width: '16px',
    height: '16px',
    background: 'linear-gradient(-45deg, transparent 46%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.08) 54%, transparent 54%)',
    pointerEvents: 'none' as const,
    clipPath: 'polygon(100% 0, 0 100%, 100% 100%)',
    zIndex: 20,
  } : undefined;

  return (
    <div className={containerClassName} style={containerStyle}>
      {/* Corner fold effect for sticky note */}
      {cornerFoldStyle && <div style={cornerFoldStyle} />}
      
      <ChatHeader
        enableWebSearch={enableWebSearch}
        setEnableWebSearch={setEnableWebSearch}
        isLoading={isLoading}
        clearChat={clearChat}
        cancelStream={cancelStream}
        model={model}
        setModel={setModel}
        temperature={temperature}
        setTemperature={setTemperature}
      />
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
      <ChatInput
        input={input}
        setInput={setInput}
        handleSend={handleSend}
        handleKeyPress={handleKeyPress}
        isLoading={isLoading}
        inputRef={inputRef as React.RefObject<HTMLTextAreaElement>}
      />
    </div>
  );
}; 