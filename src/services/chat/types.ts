export type Mode = 'chat' | 'auto' | 'market' | 'exit';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatHistory {
  messages: Message[];
  addMessage(role: 'user' | 'assistant', content: string): void;
  getContext(): string[];
  clearHistory(): void;
}

export interface ChatState {
  mode: Mode;
  lastCommand?: string;
  lastResponse?: string;
  context: {
    marketData?: boolean;
    socialData?: boolean;
    chainData?: boolean;
  };
}

export interface Command {
  name: string;
  description: string;
  execute: (args: string[]) => Promise<void>;
}

export interface ModeConfig {
  welcomeMessage: string;
  commands: Command[];
  onEnter?: () => Promise<void>;
  onExit?: () => Promise<void>;
}
