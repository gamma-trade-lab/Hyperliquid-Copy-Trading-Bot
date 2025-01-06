import { Command } from './types';
import { ModeManager } from './ModeManager';

export class CommandHandler {
  private commands: Map<string, Command>;
  private modeManager: ModeManager;

  constructor(modeManager: ModeManager) {
    this.commands = new Map();
    this.modeManager = modeManager;
    this.registerDefaultCommands();
  }

  private registerDefaultCommands(): void {
    this.registerCommand({
      name: 'help',
      description: 'Show available commands',
      execute: async () => {
        const currentMode = this.modeManager.getCurrentMode();
        const config = this.modeManager.getModeConfig(currentMode);
        if (config) {
          const commandList = config.commands
            .map(cmd => `${cmd.name}: ${cmd.description}`)
            .join('\n');
          console.log('Available commands:\n', commandList);
        }
      }
    });

    this.registerCommand({
      name: 'clear',
      description: 'Clear chat history',
      execute: async () => {
        this.modeManager.getHistory().clearHistory();
        console.log('Chat history cleared');
      }
    });

    this.registerCommand({
      name: 'mode',
      description: 'Switch mode (chat|auto|market|exit)',
      execute: async (args: string[]) => {
        const newMode = args[0] as any;
        if (['chat', 'auto', 'market', 'exit'].includes(newMode)) {
          await this.modeManager.switchMode(newMode);
          console.log(`Switched to ${newMode} mode`);
        } else {
          console.log('Invalid mode. Available modes: chat, auto, market, exit');
        }
      }
    });
  }

  registerCommand(command: Command): void {
    this.commands.set(command.name, command);
  }

  async handleCommand(input: string): Promise<boolean> {
    const [commandName, ...args] = input.trim().split(' ');
    const command = this.commands.get(commandName);

    if (command) {
      await command.execute(args);
      return true;
    }

    return false;
  }

  getCommands(): Command[] {
    return Array.from(this.commands.values());
  }
}
