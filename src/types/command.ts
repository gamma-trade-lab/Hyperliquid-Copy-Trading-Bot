export type Mode = 'chat' | 'auto' | 'market';

export interface CommandResult {
  success: boolean;
  message?: string;
  data?: any;
}

export interface Command {
  name: string;
  description: string;
  execute: (args: string[]) => Promise<CommandResult>; // Ensure execute returns Promise<CommandResult>
}

export interface ModeConfig {
  welcomeMessage: string; // Ensure welcomeMessage is always a string
  commands: Command[]; // Ensure commands is always a Command[]
  onEnter?: () => Promise<void>;
  onExit?: () => Promise<void>;
}