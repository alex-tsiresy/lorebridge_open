import React, { RefObject } from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import WebSearchSummary from "./WebSearchSummary";
import WebSearchDetails from "./WebSearchDetails";
import RAGSummary from "./RAGSummary";
import RAGDetails from "./RAGDetails";
import SourcesBox from "./SourcesBox";
import MarkdownRenderer from "./MarkdownRenderer";

import { Message, ToolStep } from "../lib/useChatAPI";
import { logger } from '@/lib/logger';

// Removed custom markdownComponents; handled inside MarkdownRenderer

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface ChatMessagesProps {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  streamedMessage: string;
  activeToolInfo: ToolStep[];
  collapsedToolOutputs: { [msgId: string]: boolean };
  setCollapsedToolOutputs: React.Dispatch<React.SetStateAction<{ [msgId: string]: boolean }>>;
  collapsedAnswers: { [msgId: string]: boolean };
  setCollapsedAnswers: React.Dispatch<React.SetStateAction<{ [msgId: string]: boolean }>>;
  messagesEndRef: RefObject<HTMLDivElement>;
  assistantMessageIdRef: RefObject<string | null>;
  lastAssistantMessage: Message | undefined;
  hideToolOutputs?: boolean;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  isLoading,
  error,
  streamedMessage,
  activeToolInfo,
  collapsedToolOutputs,
  setCollapsedToolOutputs,
  collapsedAnswers,
  setCollapsedAnswers,
  messagesEndRef,
  assistantMessageIdRef,
  lastAssistantMessage,
  hideToolOutputs = false
}) => {
  // Filter out context messages - they should not be displayed in the chat
  const visibleMessages = messages.filter(message => message.role !== 'context');

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 ">
      {visibleMessages.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          <p className="text-lg font-medium">Start a conversation</p>
          <p className="text-sm">Ask me anything</p>
        </div>
      )}
      {visibleMessages.map((message) => {
        const toolSteps = message.toolOutput || [];
        const hasWebSearchToolOutput = toolSteps.some((step: ToolStep) => step.type === 'web_search_call');
        const hasRAGToolOutput = toolSteps.some((step: ToolStep) => step.type === 'rag_result');
        const annotations = undefined;
        const isWebSearchSummaryCollapsed = collapsedToolOutputs[message.id] ?? true;
        const isRAGSummaryCollapsed = collapsedToolOutputs[`${message.id}-rag`] ?? true;
        return (
          <div
            key={message.id}
            className={cn(
              "flex flex-col items-start space-y-1",
              message.role === 'user' ? "items-end" : "items-start"
            )}
          >
            <div className={cn("flex flex-col w-full", message.role === 'user' ? "items-end" : "items-start")}> 
              {message.role === 'user' && (
                <div className="flex-shrink-0 p-2 rounded-lg bg-gray-200 mb-1">
                  <User className="h-4 w-4 text-gray-600" />
                </div>
              )}
              {message.role === 'assistant' && (
                <>
                  {!hideToolOutputs && hasWebSearchToolOutput && (
                    <div className="w-full mb-1">
                      <div className="flex items-center gap-2">
                        <button
                          className="text-xs text-yellow-700 underline focus:outline-none"
                          onClick={() => setCollapsedToolOutputs((prev) => ({ ...prev, [message.id]: !isWebSearchSummaryCollapsed }))}
                        >
                          {isWebSearchSummaryCollapsed ? 'Show web search steps' : 'Hide web search steps'}
                        </button>
                      </div>
                      {!isWebSearchSummaryCollapsed && (
                        <div className="mt-1"><WebSearchSummary toolSteps={toolSteps} /></div>
                      )}
                    </div>
                  )}
                  {!hideToolOutputs && hasRAGToolOutput && (
                    <div className="w-full mb-1">
                      <div className="flex items-center gap-2">
                        <button
                          className="text-xs text-blue-700 underline focus:outline-none"
                          onClick={() => setCollapsedToolOutputs((prev) => ({ ...prev, [`${message.id}-rag`]: !isRAGSummaryCollapsed }))}
                        >
                          {isRAGSummaryCollapsed ? 'Show document search steps' : 'Hide document search steps'}
                        </button>
                      </div>
                      {!isRAGSummaryCollapsed && (
                        <div className="mt-1"><RAGSummary toolSteps={toolSteps} /></div>
                      )}
                    </div>
                  )}

                </>
              )}
              <div
                className={cn(
                  "px-6 py-4 rounded-lg chat-bubble-content",
                  message.role === 'user'
                    ? "custom-bg-accent text-white max-w-xs sm:max-w-md lg:max-w-lg xl:max-w-xl"
                    : "bg-gray-100 text-gray-900 w-full"
                )}
              >
                <MarkdownRenderer content={message.content || ""} />
                <SourcesBox annotations={annotations ?? []} />
                <p className={cn("text-xs mt-1", message.role === 'user' ? "text-blue-100" : "text-gray-500")}>{formatTime(message.timestamp)}</p>
              </div>
            </div>
            {!hideToolOutputs && message.role === 'assistant' && hasWebSearchToolOutput && !isWebSearchSummaryCollapsed && (
              <div className="w-full ml-8 mt-1">
                <button
                  className={cn(
                    "flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-t-lg border border-yellow-200 bg-yellow-100 text-yellow-900 hover:bg-yellow-200 transition-colors focus:outline-none",
                    collapsedAnswers[`${message.id}-all-toolsteps`] ? "rounded-b-lg" : ""
                  )}
                  style={{ minWidth: 120 }}
                  onClick={() => setCollapsedAnswers((prev) => ({ ...prev, [`${message.id}-all-toolsteps`]: !prev[`${message.id}-all-toolsteps`] }))}
                >
                  <span>{collapsedAnswers[`${message.id}-all-toolsteps`] ? '▼' : '▲'}</span>
                  <span>{collapsedAnswers[`${message.id}-all-toolsteps`] ? `Show all web search details` : `Hide all web search details`}</span>
                </button>
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300",
                    collapsedAnswers[`${message.id}-all-toolsteps`] ? "max-h-0" : "max-h-full"
                  )}
                  style={{ transitionProperty: 'max-height' }}
                >
                  <WebSearchDetails toolSteps={toolSteps} />
                </div>
              </div>
            )}
            {!hideToolOutputs && message.role === 'assistant' && hasRAGToolOutput && !isRAGSummaryCollapsed && (
              <div className="w-full ml-8 mt-1">
                <button
                  className={cn(
                    "flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-t-lg border border-blue-200 bg-blue-100 text-blue-900 hover:bg-blue-200 transition-colors focus:outline-none",
                    collapsedAnswers[`${message.id}-rag-details`] ? "rounded-b-lg" : ""
                  )}
                  style={{ minWidth: 120 }}
                  onClick={() => setCollapsedAnswers((prev) => ({ ...prev, [`${message.id}-rag-details`]: !prev[`${message.id}-rag-details`] }))}
                >
                  <span>{collapsedAnswers[`${message.id}-rag-details`] ? '▼' : '▲'}</span>
                  <span>{collapsedAnswers[`${message.id}-rag-details`] ? `Show all document search details` : `Hide all document search details`}</span>
                </button>
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300",
                    collapsedAnswers[`${message.id}-rag-details`] ? "max-h-0" : "max-h-full"
                  )}
                  style={{ transitionProperty: 'max-height' }}
                >
                  <RAGDetails toolSteps={toolSteps} />
                </div>
              </div>
            )}
          </div>
        );
      })}
      {/* Enhanced streaming assistant message with tool info */}
      {/* Show streaming message if loading OR if we have streaming content but no matching final message yet */}
      {(isLoading || (streamedMessage && !visibleMessages.some(msg => 
        msg.role === 'assistant' && 
        msg.content === streamedMessage
      ))) && (() => {
        const streamingId = assistantMessageIdRef.current || (lastAssistantMessage ? lastAssistantMessage.id : 'assistant-streaming');
        const hasWebSearchToolOutput = activeToolInfo && activeToolInfo.length > 0 && activeToolInfo[0].type === 'web_search_call';
        const hasRAGToolOutput = activeToolInfo && activeToolInfo.length > 0 && activeToolInfo[0].type === 'rag_result';
        
        logger.log('🎬 RENDERING STREAMING:', {
          streamedMessageLength: streamedMessage?.length || 0,
          lastChars: streamedMessage?.slice(-30) || 'empty',
          isLoading
        });

        const isWebSearchSummaryCollapsed = collapsedToolOutputs[streamingId] ?? true;
        const isRAGSummaryCollapsed = collapsedToolOutputs[`${streamingId}-rag`] ?? true;
        return (
          <div key={`streaming-${streamingId}-${streamedMessage?.length || 0}`} className="flex flex-col items-start space-y-1">
            {!hideToolOutputs && hasWebSearchToolOutput && (
              <div className="w-full mb-1">
                <div className="flex items-center gap-2">
                  <button
                    className="text-xs text-yellow-700 underline focus:outline-none"
                    onClick={() => setCollapsedToolOutputs((prev) => ({ ...prev, [streamingId]: !isWebSearchSummaryCollapsed }))}
                  >
                    {isWebSearchSummaryCollapsed ? 'Show web search steps' : 'Hide web search steps'}
                  </button>
                </div>
                {!isWebSearchSummaryCollapsed && (
                  <div className="mt-1"><WebSearchSummary toolSteps={activeToolInfo} /></div>
                )}
              </div>
            )}
            {!hideToolOutputs && hasRAGToolOutput && (
              <div className="w-full mb-1">
                <div className="flex items-center gap-2">
                  <button
                    className="text-xs text-blue-700 underline focus:outline-none"
                    onClick={() => setCollapsedToolOutputs((prev) => ({ ...prev, [`${streamingId}-rag`]: !isRAGSummaryCollapsed }))}
                  >
                    {isRAGSummaryCollapsed ? 'Show document search steps' : 'Hide document search steps'}
                  </button>
                </div>
                {!isRAGSummaryCollapsed && (
                  <div className="mt-1"><RAGSummary toolSteps={activeToolInfo} /></div>
                )}
              </div>
            )}

            <div className="flex items-start space-x-3 w-full">
              <div className="px-6 py-4 rounded-lg chat-bubble-content bg-gray-100 text-gray-900 w-full">
                {streamedMessage ? (
                  <>
                    <MarkdownRenderer key={`streaming-content-${streamedMessage.length}`} content={streamedMessage} />
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></div>
                      <span>Streaming response...</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-gray-700 font-semibold animate-pulse text-sm">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse"></div>
                    <span>Thinking...</span>
                  </div>
                )}
              </div>
            </div>
            {!hideToolOutputs && hasWebSearchToolOutput && !isWebSearchSummaryCollapsed && (
              <div className="w-full ml-8 mt-1">
                <button
                  className={cn(
                    "flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-t-lg border border-yellow-200 bg-yellow-100 text-yellow-900 hover:bg-yellow-200 transition-colors focus:outline-none",
                    collapsedAnswers[`${streamingId}-all-toolsteps`] ? "rounded-b-lg" : ""
                  )}
                  style={{ minWidth: 120 }}
                  onClick={() => setCollapsedAnswers((prev) => ({ ...prev, [`${streamingId}-all-toolsteps`]: !prev[`${streamingId}-all-toolsteps`] }))}
                >
                  <span>{collapsedAnswers[`${streamingId}-all-toolsteps`] ? '▼' : '▲'}</span>
                  <span>{collapsedAnswers[`${streamingId}-all-toolsteps`] ? `Show all web search details` : `Hide all web search details`}</span>
                </button>
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300",
                    collapsedAnswers[`${streamingId}-all-toolsteps`] ? "max-h-0" : "max-h-full"
                  )}
                  style={{ transitionProperty: 'max-height' }}
                >
                  <WebSearchDetails toolSteps={activeToolInfo} />
                </div>
              </div>
            )}
            {!hideToolOutputs && hasRAGToolOutput && !isRAGSummaryCollapsed && (
              <div className="w-full ml-8 mt-1">
                <button
                  className={cn(
                    "flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-t-lg border border-blue-200 bg-blue-100 text-blue-900 hover:bg-blue-200 transition-colors focus:outline-none",
                    collapsedAnswers[`${streamingId}-rag-details`] ? "rounded-b-lg" : ""
                  )}
                  style={{ minWidth: 120 }}
                  onClick={() => setCollapsedAnswers((prev) => ({ ...prev, [`${streamingId}-rag-details`]: !prev[`${streamingId}-rag-details`] }))}
                >
                  <span>{collapsedAnswers[`${streamingId}-rag-details`] ? '▼' : '▲'}</span>
                  <span>{collapsedAnswers[`${streamingId}-rag-details`] ? `Show all document search details` : `Hide all document search details`}</span>
                </button>
                <div
                  className={cn(
                    "overflow-hidden transition-all duration-300",
                    collapsedAnswers[`${streamingId}-rag-details`] ? "max-h-0" : "max-h-full"
                  )}
                  style={{ transitionProperty: 'max-height' }}
                >
                  <RAGDetails toolSteps={activeToolInfo} />
                </div>
              </div>
            )}
          </div>
        );
      })()}
      <div ref={messagesEndRef} />
      {error && (
        <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatMessages; 