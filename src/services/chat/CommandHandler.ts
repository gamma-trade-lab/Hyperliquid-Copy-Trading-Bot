import { Mode, Command, CommandResult } from '@/types/chat';
import { ModeManager } from './ModeManager';
import { elizaLogger } from "@ai16z/eliza";
import { JupiterPriceV2Service } from '../blockchain/defi/JupiterPriceV2Service';
import { TwitterService } from '../social';


export class CommandHandler {
  private commands: Map<string, Command>;
  private modeManager: ModeManager;
  private aliases: Map<string, string>;
  private twitterService: TwitterService;
  private jupiterService: JupiterPriceV2Service;

  constructor(
    modeManager: ModeManager,
    twitterService: TwitterService,
    jupiterService: JupiterPriceV2Service
  ) {
    this.commands = new Map();
    this.modeManager = modeManager;
    this.twitterService = twitterService;
    this.jupiterService = jupiterService;
    this.aliases = new Map([
      ['post', 'tweet'],
      ['send', 'tweet'],
      ['price', 'market'],
      ['show', 'market'],
      ['get', 'market']
    ]);
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
      execute: async (): Promise<CommandResult> => {
        try {
          const currentMode = this.modeManager.getCurrentMode();
          const status = {
            mode: currentMode,
            active: this.modeManager.isActive(),
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
      execute: async (): Promise<CommandResult> => {
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

    // Market command validation
    this.registerCommand({
      name: 'market',
      description: 'Get market data for a token',
      execute: async (args: string[]): Promise<CommandResult> => {
        if (!args.length) {
          return {
            success: false,
            message: 'Please specify a token symbol (e.g., market SOL)'
          };
        }
        
        try {
          const symbol = args[0].toUpperCase();
          const marketData = await this.jupiterService.getMarketMetrics(symbol);
          
          if (!marketData) {
            return {
              success: false,
              message: `No market data found for ${symbol}`
            };
          }

          const formattedData = {
            symbol,
            price: marketData.price,
            volume24h: marketData.volume24h,
            priceChange24h: marketData.priceChange24h,
            marketCap: marketData.marketCap,
            confidenceLevel: marketData.confidenceLevel
          };

          return {
            success: true,
            data: formattedData,
            message: `${symbol}: $${formattedData.price.toFixed(2)} | 24h: ${formattedData.priceChange24h.toFixed(2)}% | Vol: $${formattedData.volume24h.toLocaleString()}`
          };
        } catch (error) {
          elizaLogger.error('Error fetching market data:', error);
          return {
            success: false,
            message: `Error fetching market data: ${error}`
          };
        }
      }
    });

    // Tweet command validation
    this.registerCommand({
      name: 'tweet',
      description: 'Post a tweet',
      execute: async (args: string[]): Promise<CommandResult> => {
        const content = args.join(' ');
        if (!content) {
          return {
            success: false,
            message: 'Please provide tweet content'
          };
        }
        // Need to actually call the Twitter service here
        try {
          await this.twitterService.postTweetWithRetry(content);
          return {
            success: true,
            message: 'Tweet posted successfully'
          };
        } catch (error) {
          return {
            success: false,
            message: `Failed to post tweet: ${error}`
          };
        }
      }
    });
  }

  public async handleCommand(input: string): Promise<boolean> {
    try {
      const [commandName, ...args] = input.trim().toLowerCase().split(' ');
      
      // Check aliases first
      const resolvedCommand = this.aliases.get(commandName) || commandName;
      const command = this.commands.get(resolvedCommand);

      if (!command) {
        return false;
      }

      elizaLogger.info(`Executing command: ${resolvedCommand}`);
      const result = await command.execute(args);

      if (!result.success) {
        console.log(`Command failed: ${result.message || 'Unknown error'}`);
      }

      return true;
    } catch (error) {
      elizaLogger.error('Error executing command:', error);
      console.log('Error executing command. Please try again.');
      return true;
    }
  }

  public registerCommand(command: Command): void {
    if (!command.name || typeof command.execute !== 'function') {
      throw new Error('Invalid command structure');
    }

    if (this.commands.has(command.name)) {
      elizaLogger.warn(`Overwriting existing command: ${command.name}`);
    }

    this.commands.set(command.name, command);
    elizaLogger.info(`Registered command: ${command.name}`);
  }

  public getCommands(): Command[] {
    return Array.from(this.commands.values());
  }

  public clearCommands(): void {
    this.commands.clear();
    this.registerDefaultCommands();
  }
}