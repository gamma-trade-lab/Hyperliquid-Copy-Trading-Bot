import { useState, useCallback, useRef, useEffect } from 'react';
import { elizaLogger } from "@ai16z/eliza";

// Types
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  status?: 'sending' | 'sent' | 'error';
  error?: string;
}

interface ChatError extends Error {
  code?: string;
  status?: number;
}

interface UseChatOptions {
  initialMessages?: Message[];
  retryAttempts?: number;
  retryDelay?: number;
  onError?: (error: ChatError) => void;
}

interface ChatState {
  messages: Message[];
  loading: boolean;
  error: ChatError | null;
  hasMore: boolean;
}

/**
 * Custom hook for chat functionality
 */
export function useChat(options: UseChatOptions = {}) {
  // State
  const [state, setState] = useState<ChatState>({
    messages: options.initialMessages || [],
    loading: false,
    error: null,
    hasMore: true
  });

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear any ongoing operations on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Generate unique message ID
   */
  const generateMessageId = useCallback(() => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  /**
   * Add a message to the state
   */
  const addMessage = useCallback((message: Partial<Message>) => {
    const newMessage: Message = {
      id: generateMessageId(),
      role: message.role || 'user',
      content: message.content || '',
      timestamp: new Date().toISOString(),
      status: message.status || 'sent',
      ...(message.error && { error: message.error })
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, newMessage]
    }));

    return newMessage;
  }, [generateMessageId]);

  /**
   * Update a message in the state
   */
  const updateMessage = useCallback((messageId: string, updates: Partial<Message>) => {
    setState(prev => ({
      ...prev,
      messages: prev.messages.map(msg =>
        msg.id === messageId ? { ...msg, ...updates } : msg
      )
    }));
  }, []);

  /**
   * Send a message
   */
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // Abort any ongoing request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Add user message
      const userMessage = addMessage({
        role: 'user',
        content,
        status: 'sending'
      });

      // Get API key
      const apiKey = localStorage.getItem('jenna_api_key');
      if (!apiKey) {
        throw new Error('API key not found');
      }

      // Send request
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          message: content,
          history: state.messages.map(({ role, content }) => ({ role, content }))
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const error = new Error('Chat request failed') as ChatError;
        error.status = response.status;
        throw error;
      }

      const data = await response.json();

      // Update user message status
      updateMessage(userMessage.id, { status: 'sent' });

      // Add assistant response
      addMessage({
        role: 'assistant',
        content: data.response
      });

    } catch (error) {
      const chatError = error as ChatError;
      elizaLogger.error('Error sending message:', chatError);

      // Handle specific error cases
      if (chatError.name === 'AbortError') {
        return; // Request was aborted, do nothing
      }

      // Update state with error
      setState(prev => ({ ...prev, error: chatError }));

      // Notify error handler if provided
      options.onError?.(chatError);

      // Retry if configured
      if (options.retryAttempts && options.retryAttempts > 0) {
        retryTimeoutRef.current = setTimeout(() => {
          sendMessage(content);
        }, options.retryDelay || 3000);
      }

    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [state.messages, addMessage, updateMessage, options]);

  /**
   * Clear chat history
   */
  const clearChat = useCallback(() => {
    setState({
      messages: [],
      loading: false,
      error: null,
      hasMore: true
    });
  }, []);

  /**
   * Retry last failed message
   */
  const retryLastMessage = useCallback(() => {
    const lastMessage = state.messages[state.messages.length - 1];
    if (lastMessage?.status === 'error') {
      sendMessage(lastMessage.content);
    }
  }, [state.messages, sendMessage]);

  return {
    messages: state.messages,
    loading: state.loading,
    error: state.error,
    hasMore: state.hasMore,
    sendMessage,
    clearChat,
    retryLastMessage
  };
}

// Export types
export type { Message, ChatError, UseChatOptions };