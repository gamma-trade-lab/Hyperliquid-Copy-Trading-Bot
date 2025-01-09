import { Mode} from '@/types/chat';
import { ModeManager } from './ModeManager';
import { elizaLogger } from "@ai16z/eliza";
import { Command, CommandResult } from '@/types/command';
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
      execute: async (args: string[]): Promise<CommandResult> => {
        try {
          const currentMode = this.modeManager.getCurrentMode();
          const config = this.modeManager.getModeConfig(currentMode);
          
          if (!config || !config.commands) {
            return {
              success: false,
              message: 'No commands available for current mode'
            };
          }

          const generalCommands = [
            'help - Show available commands',
            'mode - Switch mode (chat|auto|market)',
            'exit - Exit the application',
            'clear - Clear the console',
            'status - Show current status'
          ];

          const modeCommands = config.commands
            .map(cmd => `${cmd.name} - ${cmd.description}`);

          const allCommands = [...generalCommands, ...modeCommands];
          
          console.log('\nAvailable Commands:');
          console.log(allCommands.join('\n'));
          
          return {
            success: true,
            data: allCommands,
            message: 'Commands listed successfully'
          };
        } catch (error) {
          elizaLogger.error('Error displaying help:', error);
          return {
            success: false,
            message: 'Error displaying help information'
          };
        }
      }
    });

    this.registerCommand({
      name: 'mode',
      description: 'Switch mode (chat|auto|market)',
      execute: async (args: string[]): Promise<CommandResult> => {
        try {
          const newMode = args[0]?.toLowerCase();
          const validModes: Mode[] = ['chat', 'auto', 'market'];

          if (!newMode || !validModes.includes(newMode as Mode)) {
            return {
              success: false,
              message: `Invalid mode. Available modes: ${validModes.join(', ')}`
            };
          }

          const success = await this.modeManager.switchMode(newMode as Mode);
          
          return {
            success,
            message: success ? `Switched to ${newMode} mode` : `Failed to switch to ${newMode} mode`
          };
        } catch (error) {
          elizaLogger.error('Error switching mode:', error);
          return {
            success: false,
            message: 'Error occurred while switching modes'
          };
        }
      }
    });

    this.registerCommand({
      name: 'status',
      description: 'Show current status',
      execute: async (_args: string[]): Promise<CommandResult> => {
        try {
          const currentMode = this.modeManager.getCurrentMode();
          const isActive = this.modeManager.isActive();
          
          const status = {
            mode: currentMode,
            active: isActive,
            timestamp: new Date().toISOString()
          };

          console.log('\nCurrent Status:');
          console.log(JSON.stringify(status, null, 2));

          return {
            success: true,
            data: status,
            message: 'Status retrieved successfully'
          };
        } catch (error) {
          elizaLogger.error('Error getting status:', error);
          return {
            success: false,
            message: 'Error retrieving status information'
          };
        }
      }
    });

    this.registerCommand({
      name: 'clear',
      description: 'Clear the console',
      execute: async (_args: string[]): Promise<CommandResult> => {
        try {
          console.clear();
          return {
            success: true,
            message: 'Console cleared'
          };
        } catch (error) {
          return {
            success: false,
            message: 'Failed to clear console'
          };
        }
      }
    });
  }

  public registerCommand(command: Command): void {
    try {
      if (!command.name || typeof command.execute !== 'function') {
        throw new Error('Invalid command structure');
      }

      if (this.commands.has(command.name)) {
        elizaLogger.warn(`Overwriting existing command: ${command.name}`);
      }

      this.commands.set(command.name, command);
      elizaLogger.info(`Registered command: ${command.name}`);
    } catch (error) {
      elizaLogger.error('Error registering command:', error);
      throw error;
    }
  }

  public async handleCommand(input: string): Promise<boolean> {
    try {
      const [commandName, ...args] = input.trim().toLowerCase().split(' ');
      const command = this.commands.get(commandName);

      if (!command) {
        return false;
      }

      elizaLogger.info(`Executing command: ${commandName}`);
      const result = await command.execute(args);

      if (!result.success) {
        console.log(`Command failed: ${result.message || 'Unknown error'}`);
      }

      return true;
    } catch (error) {
      elizaLogger.error('Error executing command:', error);
      console.log('Error executing command. Please try again.');
      return true; // Return true because we handled the command, even though it failed
    }
  }

  public getCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  public hasCommand(name: string): boolean {
    return this.commands.has(name);
  }

  public getCommandDescription(name: string): string | undefined {
    return this.commands.get(name)?.description;
  }

  public clearCommands(): void {
    this.commands.clear();
    this.registerDefaultCommands();
  }
}