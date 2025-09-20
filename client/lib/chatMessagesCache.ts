import { logger } from "@/lib/logger";
// Global cache for chat messages to prevent repeated API calls across multiple ChatProvider instances
const chatMessagesCache = new Map<string, Promise<any>>();

export const getChatMessagesWithCache = async (apiClient: any, sessionId: string) => {
  if (!sessionId) return null;
  
  // Check if we already have a pending request for this session
  if (chatMessagesCache.has(sessionId)) {
    // Session cache logging removed for security
    return chatMessagesCache.get(sessionId);
  }
  
  // Session request logging removed for security
  
  // Create a new promise for this request
  const promise = apiClient.getChatMessages(sessionId);
  chatMessagesCache.set(sessionId, promise);
  
  try {
    const result = await promise;
    // Session completion logging removed for security
    return result;
  } catch (error) {
    // Remove from cache on error so it can be retried
    logger.error(`[ChatCache] Request failed`, error);
    chatMessagesCache.delete(sessionId);
    throw error;
  }
};

// Function to clear cache for a specific session (useful when messages are updated)
export const clearChatMessagesCache = (sessionId: string) => {
  if (chatMessagesCache.has(sessionId)) {
    // Cache clearing logging removed for security
    chatMessagesCache.delete(sessionId);
  }
};

// Function to clear all cache (useful for debugging or memory management)
export const clearAllChatMessagesCache = () => {
  // Cache clearing logging removed for security
  chatMessagesCache.clear();
};
