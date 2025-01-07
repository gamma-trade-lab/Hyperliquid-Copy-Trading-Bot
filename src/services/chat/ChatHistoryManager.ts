import { ChatHistory, Message } from './types.js';

export class ChatHistoryManager implements ChatHistory {
  private static readonly MAX_HISTORY = 50;
  messages: Message[] = [];

  addMessage(role: 'user' | 'assistant', content: string): void {
    const message: Message = {
      role,
      content,
      timestamp: Date.now()
    };

    this.messages.push(message);

    // Maintain history size limit
    if (this.messages.length > ChatHistoryManager.MAX_HISTORY) {
      this.messages = this.messages.slice(-ChatHistoryManager.MAX_HISTORY);
    }
  }

  getContext(): string[] {
    return this.messages.map(msg => `${msg.role}: ${msg.content}`);
  }

  clearHistory(): void {
    this.messages = [];
  }

  // Helper method to get recent context window
  getRecentContext(windowSize: number = 5): Message[] {
    return this.messages.slice(-windowSize);
  }

  // Helper method to get messages by role
  getMessagesByRole(role: 'user' | 'assistant'): Message[] {
    return this.messages.filter(msg => msg.role === role);
  }
}
