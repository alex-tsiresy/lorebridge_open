import { useAuth, useUser } from "@clerk/nextjs";
import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { apiClient } from './api';
import { logger } from '@/lib/logger';

// Utility function to safely process tool output data
const processToolOutput = (data: any): ToolStep | null => {
  try {
    if (typeof data === "object" && data.searchParameters && data.organic) {
      return {
        type: 'web_search_call',
        query: data.searchParameters.q || data.searchParameters.query || 'Unknown query',
        status: 'completed',
        results: Array.isArray(data.organic)
          ? data.organic.map((item: any) => ({
              title: item.title || item.name || 'No title',
              url: item.link || item.url || item.href || '',
              snippet: item.snippet || item.description || '',
            }))
          : [],
      };
    }
    // Handle RAG results
    if (typeof data === "object" && data.type === "rag_result") {
      return {
        type: 'rag_result',
        method: data.method || 'unknown',
        chunks_used: data.chunks_used || 0,
        context_tokens: data.context_tokens || 0,
        relevant_chunks: Array.isArray(data.relevant_chunks)
          ? data.relevant_chunks.map((chunk: any) => ({
              text: chunk.text || '',
              similarity_score: chunk.similarity_score || 0,
              chunk_id: chunk.chunk_id || '',
              metadata: chunk.metadata || {},
            }))
          : [],
        answer: data.answer || '',
        status: 'completed',
      };
    }
    // Handle other tool types (like PDF tools)
    if (typeof data === "object" && data.type === "tool_call") {
      return {
        type: 'tool_call',
        status: 'completed',
        results: [],
      };
    }
    return null;
  } catch (error) {
    logger.error("[ToolOutput] Error processing tool output:", error, data);
    return null;
  }
};

export interface ToolStep {
  type: string;
  query?: string;
  status?: string;
  url?: string;
  title?: string;
  snippet?: string;
  results?: Array<{
    title?: string;
    url?: string;
    snippet?: string;
  }>;
  // RAG-specific fields
  method?: string;
  chunks_used?: number;
  context_tokens?: number;
  relevant_chunks?: Array<{
    text: string;
    similarity_score: number;
    chunk_id: string;
    metadata?: any;
  }>;
  answer?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "context";
  content: string;
  timestamp: Date;
  toolOutput?: ToolStep[];
}

interface UseChatAPIOptions {
  model?: string;
  sessionId?: string;
  temperature?: number;
}

interface ApiChatMessage {
  id: number;
  session_id: string;
  role: "user" | "assistant" | "context";
  content: string;
  timestamp: string;
  tool_output: any;
}

export function useChatAPI(options: UseChatAPIOptions = {}) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamedMessage, setStreamedMessage] = useState("");
  const [toolOutput, setToolOutput] = useState<any>(null);
  const [streamedToolOutput, setStreamedToolOutput] = useState<any>(null);
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  const [activeToolInfo, setActiveToolInfo] = useState<Message['toolOutput'] | null>(undefined);
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const handleNewContextMessage = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { sessionId, message } = customEvent.detail;

      if (options.sessionId === sessionId && message) {
        const newMessage: Message = {
          id: message.id.toString(),
          role: message.role.toLowerCase() as 'user' | 'assistant' | 'context',
          content: message.content,
          timestamp: new Date(message.timestamp),
        };
        setMessages((prev) => [...prev, newMessage]);
      }
    };

    window.addEventListener('new-context-message', handleNewContextMessage);
    return () => {
      window.removeEventListener('new-context-message', handleNewContextMessage);
    };
  }, [options.sessionId]);

  // Session ID persistence
  const getSessionId = () => {
    // 1. This is the most important part for the WhiteBoardView
    if (options.sessionId) {
      return options.sessionId;
    }

    // 2. This part below only runs if `options.sessionId` is NOT provided
    if (typeof window === "undefined") return "";
    let sessionId = localStorage.getItem("chat_session_id") || "";
    if (!sessionId) {
      sessionId = uuidv4();
      localStorage.setItem("chat_session_id", sessionId);
      // Session ID logging removed for security
    } else {
      // Session ID logging removed for security
    }
    return sessionId;
  };

  const loadExistingMessages = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const existingMessages = await apiClient.getChatMessages(sessionId) as ApiChatMessage[];
      const convertedMessages: Message[] = existingMessages.map((msg) => {
        let toolOutput: ToolStep[] | undefined = undefined;
        if (msg.tool_output && Array.isArray(msg.tool_output)) {
          toolOutput = msg.tool_output.map((output: any) => {
            const processed = processToolOutput(output);
            return processed || output; // Return processed tool output or original if not a web search
          }).filter(Boolean); // Remove any null results
        }
        return {
          id: msg.id.toString(),
          role: msg.role.toLowerCase() as "user" | "assistant" | "context",
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          toolOutput: toolOutput,
        };
      });
      setMessages(convertedMessages);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      logger.error("Failed to load existing messages:", errorMessage);
      setError(`Failed to load chat history.`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (options.sessionId && user) {
      loadExistingMessages(options.sessionId);
    } else if (!options.sessionId) {
      setMessages([]);
    }
  }, [options.sessionId, user, loadExistingMessages]);

  // Clear streaming state when the final message appears in the messages array
  useEffect(() => {
    if (pendingMessageId && streamedMessage) {
      // Check if the final message with matching content has been added
      const finalMessageExists = messages.some(msg => 
        msg.id === pendingMessageId && 
        msg.content === streamedMessage
      );
      
      if (finalMessageExists) {
        // Final message is now rendered, safe to clear streaming state
        setStreamedMessage("");
        setActiveToolInfo(undefined);
        setPendingMessageId(null);
      }
    }
  }, [messages, pendingMessageId, streamedMessage]);

  // Send message and stream response from Langchain backend only
  const sendMessage = useCallback(
    async (input: string) => {
      if (!input.trim() || isLoading) return;
      if (!user) {
        setError("User not loaded");
        return;
      }
      setIsLoading(true);
      setError(null);
      setStreamedMessage("");
      setToolOutput(null);
      setStreamedToolOutput(null);
      setActiveToolInfo(undefined);
      setPendingMessageId(null);

      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: input.trim(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Generate a consistent assistant message id for this turn
      const assistantMessageId = `assistant-${Date.now()}`;

      // Prepare payload for FastAPI
      const session_id = getSessionId();
      const user_id = user.id;
      const model = options.model || "gpt-4o";
      const temperature = options.temperature || 0.7;
      const payload: {
        session_id: string;
        user_id: string;
        messages: { role: "user" | "assistant" | "context"; content: string }[];
        model: string;
        temperature?: number;
      } = {
        session_id,
        user_id,
        messages: [...messages, userMessage].map((m) => ({ role: m.role, content: m.content })),
        model,
        temperature,
      };

      // Payload logging removed for security

      // Get Clerk token
      let token: string | null = null;
      try {
        token = await getToken();
      } catch (err) {
        setError("Failed to get auth token");
        setIsLoading(false);
        return;
      }
      if (!token) {
        setError("No auth token available");
        setIsLoading(false);
        return;
      }

      // Use API base which now goes through Next.js streaming route
      const { getApiBase } = await import('./apiBase');
      const apiBase = getApiBase({ allowLocalhost: true });

      // Ensure user exists in DB before sending chat
      try {
        const userCheckResponse = await fetch(`${apiBase || ''}/api/v1/users/me/`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!userCheckResponse.ok) {
          logger.error(`User check failed with status: ${userCheckResponse.status}`);
        }
      } catch (err) {
        logger.error("Failed to ensure user in DB before chat:", err);
        // Optionally, you can set an error or continue
      }

      // Streaming fetch to Langchain backend only
      if (controllerRef.current) controllerRef.current.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      // Persist last non-empty toolSteps during streaming
      let lastToolSteps: ToolStep[] = [];
      try {
        const endpoint = "/api/v1/langchain-chat";
        const res = await fetch(
          (apiBase || '') + endpoint,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          }
        );
        if (!res.body) throw new Error("No response body");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        let buffer = "";
        let assistantMessageContent = "";
        let toolSteps: ToolStep[] = [];

        // Helper to safely parse JSON strings
        function tryParseJSON(str: string) {
          try {
            return JSON.parse(str);
          } catch {
            return str;
          }
        }

        while (!done) {
          const { value, done: doneReading } = await reader.read();
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() || "";
            for (const line of lines) {
              if (!line.trim()) continue;
              if (line.startsWith("data:")) {
                const data = line.slice(5).trim();
                if (data === "[DONE]") {
                  setIsLoading(false);
                  break;
                }
                try {
                  const event = JSON.parse(data);
                  // Event logging removed for security
                  
                  // Handle tool output events
                  if (event.type === "tool_output" && event.content) {
                    // Tool output logging removed for security
                    const toolStep = processToolOutput(event.content);
                    if (toolStep) {
                      toolSteps.push(toolStep);
                      lastToolSteps = [...toolSteps];
                      setActiveToolInfo([toolStep]);
                      // Tool step logging removed for security
                    }
                  }
                  // Handle the new streaming format from langchain_llm.py
                  else if (event.type === "token" && event.content) {
                    // The new format streams the full token object
                    const tokenData = event.content;
                    
                    // Check if this is a message with content
                    if (tokenData.message && tokenData.message.content) {
                      const content = tokenData.message.content;
                      // Token content logging removed for security
                      
                      // Check if this is a tool output (JSON object with searchParameters)
                      const toolStep = processToolOutput(content);
                      if (toolStep) {
                        toolSteps.push(toolStep);
                        lastToolSteps = [...toolSteps];
                        setActiveToolInfo([toolStep]);
                        // Tool step logging removed for security
                      } else if (typeof content === "string") {
                        // It's regular text content
                        assistantMessageContent += content;
                        setStreamedMessage((prev) => prev + content);
                        // Text content logging removed for security
                      } else {
                        // Handle other content types
                        // Content type logging removed for security
                      }
                    }
                  }
                  
                  if (event.type === "error") {
                    setError(event.error || "Streaming error");
                    // For errors, set loading to false immediately since no message finalization is needed
                    setIsLoading(false);
                  }
                } catch (err) {
                  logger.error("[Langchain] JSON parse error:", err, data);
                }
              }
            }
          }
          done = doneReading;
        }
        // If the stream ended without a response.completed event, finalize the message
        if (assistantMessageContent) {
          // Use last non-empty toolSteps if toolSteps is empty
          const finalToolSteps = toolSteps.length > 0 ? toolSteps : (lastToolSteps.length > 0 ? lastToolSteps : undefined);
          
          // Create the final message with the accumulated streaming content
          const finalMessage = {
            id: assistantMessageId,
            role: "assistant" as const,
            content: assistantMessageContent,
            timestamp: new Date(),
            toolOutput: finalToolSteps,
          };
          
          // Add the final message to the messages array
          setMessages((prev) => [...prev, finalMessage]);
          
          // Set pending message ID so useEffect can clear streaming state when safe
          setPendingMessageId(assistantMessageId);
          
          toolSteps = [];
          lastToolSteps = [];
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setError(err.message || "Streaming error");
      } finally {
        setIsLoading(false);
      }
    },
    [user, getToken, isLoading, messages, options.model, options.temperature]
  );

  const cancelStream = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
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
  };
} 