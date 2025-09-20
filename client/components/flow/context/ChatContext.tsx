"use client";

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { v4 as uuidv4 } from 'uuid';
import { apiClient } from '../../../lib/api';
import { logger } from '../../../lib/logger';

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

interface ApiChatMessage {
  id: number;
  session_id: string;
  role: "user" | "assistant" | "context";
  content: string;
  timestamp: string;
  tool_output: any;
}

interface ChatContextType {
  // State
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  streamedMessage: string;
  activeToolInfo: Message['toolOutput'] | null;
  enableWebSearch: boolean;
  
  // Actions
  sendMessage: (input: string) => Promise<void>;
  cancelStream: () => void;
  clearChat: () => void;
  setEnableWebSearch: (enabled: boolean) => void;
  setModel: (model: string) => void;
  setTemperature: (temperature: number) => void;
  
  // Configuration
  model: string;
  temperature: number;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Global state manager for shared chat sessions
class ChatSessionManager {
  private static instance: ChatSessionManager;
  private sessions: Map<string, {
    messages: Message[];
    isLoading: boolean;
    error: string | null;
    streamedMessage: string;
    activeToolInfo: Message['toolOutput'] | null;
    enableWebSearch: boolean;
    model: string;
    temperature: number;
    subscribers: Set<Function>;
    messagesLoaded: boolean;
    isLoadingMessages: boolean;
    uiUpdateTimeout?: NodeJS.Timeout;
  }> = new Map();
  
  static getInstance(): ChatSessionManager {
    if (!ChatSessionManager.instance) {
      ChatSessionManager.instance = new ChatSessionManager();
    }
    return ChatSessionManager.instance;
  }
  
  getSession(sessionId: string, model: string = "gpt-4o", temperature: number = 0.7) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        messages: [],
        isLoading: false,
        error: null,
        streamedMessage: "",
        activeToolInfo: null,
        enableWebSearch: false,
        model,
        temperature,
        subscribers: new Set(),
        messagesLoaded: false,
        isLoadingMessages: false,
      });
    }
    return this.sessions.get(sessionId)!;
  }
  
  updateSession(sessionId: string, updates: Partial<{
    messages: Message[];
    isLoading: boolean;
    error: string | null;
    streamedMessage: string;
    activeToolInfo: Message['toolOutput'] | null;
    enableWebSearch: boolean;
    model: string;
    temperature: number;
    messagesLoaded: boolean;
    isLoadingMessages: boolean;
  }>) {
    const session = this.getSession(sessionId);
    Object.assign(session, updates);
    
    // Always notify subscribers, but throttle UI control notifications to prevent spam
    const uiOnlyKeys = ['model', 'temperature', 'enableWebSearch'];
    const hasUIUpdates = Object.keys(updates).some(key => uiOnlyKeys.includes(key));
    const hasNonUIUpdates = Object.keys(updates).some(key => !uiOnlyKeys.includes(key));
    
    if (hasNonUIUpdates) {
      // Immediate notification for important state changes
      session.subscribers.forEach(callback => callback());
    } else if (hasUIUpdates) {
      // Debounced notification for UI control changes to prevent spam but ensure sync
      clearTimeout((session as any).uiUpdateTimeout);
      (session as any).uiUpdateTimeout = setTimeout(() => {
        session.subscribers.forEach(callback => callback());
      }, 200);
    }
  }
  
  subscribe(sessionId: string, callback: Function) {
    const session = this.getSession(sessionId);
    session.subscribers.add(callback);
    
    return () => {
      session.subscribers.delete(callback);
    };
  }
  
  removeSession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session?.uiUpdateTimeout) {
      clearTimeout(session.uiUpdateTimeout);
    }
    this.sessions.delete(sessionId);
  }
}

// Global registry to maintain singleton ChatProvider instances per sessionId
class ChatProviderRegistry {
  private static instance: ChatProviderRegistry;
  private providers: Map<string, React.ComponentType<{ children: React.ReactNode }>> = new Map();
  
  static getInstance(): ChatProviderRegistry {
    if (!ChatProviderRegistry.instance) {
      ChatProviderRegistry.instance = new ChatProviderRegistry();
    }
    return ChatProviderRegistry.instance;
  }
  
  getProvider(sessionId: string, model: string = "gpt-4o", temperature: number = 0.7): React.ComponentType<{ children: React.ReactNode }> {
    if (!this.providers.has(sessionId)) {
      // Create a new provider instance for this sessionId
      const ChatProviderComponent = ({ children }: { children: React.ReactNode }) => {
        return (
          <ChatProviderInternal 
            sessionId={sessionId} 
            model={model} 
            temperature={temperature}
          >
            {children}
          </ChatProviderInternal>
        );
      };
      this.providers.set(sessionId, ChatProviderComponent);
    }
    return this.providers.get(sessionId)!;
  }
  
  removeProvider(sessionId: string) {
    this.providers.delete(sessionId);
  }
}

// Internal ChatProvider implementation
function ChatProviderInternal({ 
  children, 
  sessionId, 
  model: initialModel = "gpt-4o", 
  temperature: initialTemperature = 0.7 
}: {
  children: React.ReactNode;
  sessionId: string;
  model?: string;
  temperature?: number;
}) {
  const { getToken } = useAuth();
  const { user } = useUser();
  
  // Get shared state from session manager
  const sessionManager = ChatSessionManager.getInstance();
  const session = sessionManager.getSession(sessionId, initialModel, initialTemperature);
  
  // Local state for re-rendering when shared state changes
  const [forceUpdate, setForceUpdate] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);
  
  // Subscribe to session updates
  useEffect(() => {
    const unsubscribe = sessionManager.subscribe(sessionId, () => {
      setForceUpdate(prev => prev + 1);
    });
    
    return unsubscribe;
  }, [sessionId, sessionManager]);
  
  // Helper functions to update shared state
  const updateSessionState = useCallback((updates: any) => {
    sessionManager.updateSession(sessionId, updates);
  }, [sessionId, sessionManager]);
  
  // Getters for shared state
  const messages = session.messages;
  const isLoading = session.isLoading;
  const error = session.error;
  const streamedMessage = session.streamedMessage;
  const enableWebSearch = session.enableWebSearch;
  const activeToolInfo = session.activeToolInfo;
  const model = session.model;
  const temperature = session.temperature;
  
  // Setters that update shared state
  const setMessages = useCallback((messages: Message[] | ((prev: Message[]) => Message[])) => {
    const newMessages = typeof messages === 'function' ? messages(session.messages) : messages;
    updateSessionState({ messages: newMessages });
  }, [session.messages, updateSessionState]);
  
  const setIsLoading = useCallback((loading: boolean) => {
    updateSessionState({ isLoading: loading });
  }, [updateSessionState]);
  
  const setError = useCallback((error: string | null) => {
    updateSessionState({ error });
  }, [updateSessionState]);
  
  const setStreamedMessage = useCallback((message: string | ((prev: string) => string)) => {
    const newMessage = typeof message === 'function' ? message(session.streamedMessage) : message;
    updateSessionState({ streamedMessage: newMessage });
  }, [session.streamedMessage, updateSessionState]);
  
  const setActiveToolInfo = useCallback((info: Message['toolOutput'] | null) => {
    updateSessionState({ activeToolInfo: info });
  }, [updateSessionState]);
  
  const setEnableWebSearch = useCallback((enabled: boolean) => {
    updateSessionState({ enableWebSearch: enabled });
  }, [updateSessionState]);
  
  const setModel = useCallback((model: string) => {
    updateSessionState({ model });
  }, [updateSessionState]);
  
  const setTemperature = useCallback((temperature: number) => {
    updateSessionState({ temperature });
  }, [updateSessionState]);

  // Load existing messages
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
            return processed || output;
          }).filter(Boolean);
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
      updateSessionState({ messagesLoaded: true, isLoadingMessages: false });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      logger.error("Failed to load existing messages:", errorMessage);
      setError(`Failed to load chat history.`);
      updateSessionState({ isLoadingMessages: false });
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, setError, setMessages, updateSessionState]);

  // Load messages when sessionId changes - but only if not already loaded
  useEffect(() => {
    if (sessionId && user) {
      // Check if messages are already loaded or currently being loaded for this session
      if (!session.messagesLoaded && !session.isLoadingMessages) {
        logger.log(`[ChatProvider] Loading messages for session: ${sessionId}`);
        updateSessionState({ isLoadingMessages: true });
        loadExistingMessages(sessionId);
      } else if (session.messagesLoaded) {
        logger.log(`[ChatProvider] Messages already loaded for session: ${sessionId}`);
      } else if (session.isLoadingMessages) {
        logger.log(`[ChatProvider] Messages already being loaded for session: ${sessionId}`);
      }
    } else if (!sessionId) {
      setMessages([]);
    }
  }, [sessionId, user, loadExistingMessages, session.messagesLoaded, session.isLoadingMessages, updateSessionState]);

  // Listen for context messages
  useEffect(() => {
    const handleNewContextMessage = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { sessionId: eventSessionId, message } = customEvent.detail;

      if (sessionId === eventSessionId && message) {
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
  }, [sessionId]);

  // Send message function
  const sendMessage = useCallback(
    async (input: string) => {
      if (!input.trim() || isLoading) return;
      if (!user) {
        setError("User not loaded");
        return;
      }
      
      logger.log(`[ChatProvider] Sending message for session: ${sessionId}`);
      setIsLoading(true);
      setError(null);
      setStreamedMessage("");
      setActiveToolInfo(null);
      
      // Add timeout to force reset loading state if stuck
      const loadingTimeout = setTimeout(() => {
        logger.log('[ChatProvider] ⏰ Loading timeout - forcing reset');
        setIsLoading(false);
        setStreamedMessage("");
        setActiveToolInfo(null);
      }, 30000); // 30 second timeout
      
      const controller = new AbortController();
      controllerRef.current = controller;
      
      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: input.trim(),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      const assistantMessageId = `assistant-${Date.now()}`;
      const user_id = user.id;
      const payload = {
        session_id: sessionId,
        user_id,
        messages: [...messages, userMessage].map((m) => ({ role: m.role, content: m.content })),
        model,
        temperature,
      };

      logger.log("Sending payload to /api/v1/langchain-chat:", payload);

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

      const { getApiBase } = await import('../../../lib/apiBase');
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
      }

      // Streaming fetch
      let buffer = "";
      let assistantMessageContent = "";
      let toolSteps: ToolStep[] = [];
      let lastToolSteps: ToolStep[] = [];
      let done = false;
      let lastReadTime = Date.now();
      const STREAM_TIMEOUT = 5000; // 5 seconds timeout
      
      function tryParseJSON(str: string) {
        try {
          return JSON.parse(str);
        } catch {
          return str;
        }
      }

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

        while (!done) {
          const { value, done: doneReading } = await reader.read();
          const currentTime = Date.now();
          
          if (value) {
            lastReadTime = currentTime;
            const decoded = decoder.decode(value, { stream: true });
            
            buffer += decoded;
            let lines = buffer.split(/\r?\n/);
            buffer = lines.pop() || "";
            
            for (const line of lines) {
              if (!line.trim()) continue;
              if (line.startsWith("data:")) {
                const data = line.slice(5).trim();
                
                if (data === "[DONE]") {
                  logger.log("[Langchain] [DONE] signal received, ending stream");
                  done = true; 
                  break;
                }
                try {
                  const event = JSON.parse(data);
                  
                  if (event.type === "tool_output" && event.content) {
                    const toolStep = processToolOutput(event.content);
                    if (toolStep) {
                      toolSteps.push(toolStep);
                      lastToolSteps = [...toolSteps];
                      setActiveToolInfo([toolStep]);
                    }
                  }
                  else if (event.type === "token" && event.content) {
                    const tokenData = event.content;
                    
                    if (tokenData.message && tokenData.message.content) {
                      const content = tokenData.message.content;
                      
                      const toolStep = processToolOutput(content);
                      if (toolStep) {
                        toolSteps.push(toolStep);
                        lastToolSteps = [...toolSteps];
                        setActiveToolInfo([toolStep]);
                      } else if (typeof content === "string") {
                        assistantMessageContent += content;
                        setStreamedMessage((prev) => prev + content);
                      }
                    }
                  }
                  
                  if (event.type === "error") {
                    setError(event.error || "Streaming error");
                    setIsLoading(false);
                  }
                } catch (err) {
                  logger.error("[Langchain] JSON parse error:", err, data);
                }
              }
            }
          }
          
          // Check for timeout
          if (currentTime - lastReadTime > STREAM_TIMEOUT && !doneReading) {
            logger.log('⏰ STREAM TIMEOUT - forcing completion');
            done = true;
          }
          
          done = doneReading;
        }
        
        // Process any remaining buffer content if stream ended unexpectedly
        if (buffer.trim()) {
          logger.log('🔄 PROCESSING REMAINING BUFFER:', {
            bufferLength: buffer.length,
            bufferContent: buffer.substring(0, 100) + '...'
          });
          
          const lines = buffer.split(/\r?\n/);
          for (const line of lines) {
            if (!line.trim()) continue;
            if (line.startsWith("data:")) {
              const data = line.slice(5).trim();
              if (data === "[DONE]") {
                logger.log("[Langchain] [DONE] signal found in remaining buffer");
                break;
              }
              try {
                const event = JSON.parse(data);
                logger.log("[Langchain] Processing remaining event:", event);
                
                if (event.type === "token" && event.content) {
                  const tokenData = event.content;
                  if (tokenData.message && tokenData.message.content) {
                    const content = tokenData.message.content;
                    if (typeof content === "string") {
                      assistantMessageContent += content;
                      setStreamedMessage((prev) => {
                        const newStreamed = prev + content;
                        logger.log("🎯 REMAINING TOKEN PROCESSED:", {
                          token: content,
                          newLength: newStreamed.length,
                          lastChars: newStreamed.slice(-30)
                        });
                        return newStreamed;
                      });
                    }
                  }
                }
              } catch (err) {
                logger.error("[Langchain] JSON parse error in remaining buffer:", err, data);
              }
            }
          }
        }
        
        // After streaming is truly done, add final message and reset
        if (assistantMessageContent) {
          logger.log("[Langchain] Processing final message:", {
            contentLength: assistantMessageContent.length,
            content: assistantMessageContent.substring(0, 100) + '...'
          });
          const finalToolSteps = toolSteps.length > 0 ? toolSteps : (lastToolSteps.length > 0 ? lastToolSteps : undefined);
          
          const finalAssistantMessage: Message = {
            id: assistantMessageId,
            role: "assistant",
            content: assistantMessageContent,
            timestamp: new Date(),
            toolOutput: finalToolSteps,
          };

          setMessages((prev) => [...prev, finalAssistantMessage]);
          
          // Clear streamed message and active tool info *after* final message is added
          setStreamedMessage("");
          setActiveToolInfo(null);
          toolSteps = [];
          lastToolSteps = [];
        }
        
        // Ensure loading is reset
        logger.log("[Langchain] Setting isLoading to false");
        setIsLoading(false);
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setError(err.message || "Streaming error");
        setIsLoading(false);
        setStreamedMessage(""); // Clear on error too
        setActiveToolInfo(null);
      } finally {
        clearTimeout(loadingTimeout);
        // Ensure isLoading is false and streamedMessage is cleared,
        // in case an error occurred or stream finished without content
        if (isLoading) setIsLoading(false);
        if (streamedMessage) setStreamedMessage("");
        if (activeToolInfo) setActiveToolInfo(null);
      }
    },
    [user, getToken, isLoading, messages, model, temperature, sessionId, setIsLoading, setError, setStreamedMessage, setActiveToolInfo, setMessages]
  );

  const cancelStream = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
      // Proactively reset UI state
      setIsLoading(false);
      setStreamedMessage("");
      setActiveToolInfo(null);
    }
  }, [setIsLoading, setStreamedMessage, setActiveToolInfo]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, [setMessages, setError]);

  const value: ChatContextType = {
    messages,
    isLoading,
    error,
    streamedMessage,
    activeToolInfo,
    enableWebSearch,
    sendMessage,
    cancelStream,
    clearChat,
    setEnableWebSearch,
    setModel,
    setTemperature,
    model,
    temperature,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

interface ChatProviderProps {
  children: React.ReactNode;
  sessionId?: string;
  model?: string;
  temperature?: number;
}

// Main ChatProvider component that uses the registry
export function ChatProvider({ children, sessionId, model = "gpt-4o", temperature = 0.7 }: ChatProviderProps) {
  // Generate sessionId if not provided
  const getSessionId = () => {
    if (sessionId) {
      return sessionId;
    }

    if (typeof window === "undefined") return "";
    let localSessionId = localStorage.getItem("chat_session_id") || "";
    if (!localSessionId) {
      localSessionId = uuidv4();
      localStorage.setItem("chat_session_id", localSessionId);
      logger.log("Generated new chat session ID:", localSessionId);
    } else {
      logger.log("Using existing chat session ID:", localSessionId);
    }
    return localSessionId;
  };

  const actualSessionId = getSessionId();
  const registry = ChatProviderRegistry.getInstance();
  const ProviderComponent = registry.getProvider(actualSessionId, model, temperature);

  return <ProviderComponent>{children}</ProviderComponent>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

// Hook to check if ChatProvider context exists without throwing
export function useChatContext() {
  const context = useContext(ChatContext);
  return context;
} 