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
// Current Issue: Not handling all error cases and missing proper formatting
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
        try {
          if (!args.length) {
            return {
              success: false,
              message: 'Please specify a token symbol (e.g., market SOL)'
            };
          }
    
          const symbol = args[0].toUpperCase();
          elizaLogger.info(`Fetching market data for ${symbol}`);
    
          const tokenInfo = await this.jupiterService.getTokenInfo(symbol);
          if (!tokenInfo) {
            return {
              success: false,
              message: `Token ${symbol} not found or not verified`
            };
          }
    
          const marketData = await this.jupiterService.getMarketMetrics(symbol);
          if (!marketData) {
            return {
              success: false,
              message: `No market data available for ${symbol}`
            };
          }
    
          console.log(`\n${symbol} Market Data:`);
          console.log(`Price: $${marketData.price.toFixed(2)}`);
          console.log(`24h Change: ${marketData.priceChange24h.toFixed(2)}%`);
          console.log(`24h Volume: $${marketData.volume24h.toLocaleString()}`);
          console.log(`Market Cap: $${marketData.marketCap.toLocaleString()}`);
          console.log(`Confidence: ${marketData.confidenceLevel}`);
    
          return {
            success: true,
            data: marketData,
            message: 'Market data retrieved successfully'
          };
        } catch (error) {
          elizaLogger.error(`Error fetching market data for ${args[0]}:`, error);
          return {
            success: false,
            message: `Error fetching market data: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
        }
      }
    });

    // Tweet command validation
    this.registerCommand({
      name: 'tweet',
      description: 'Post a tweet',
      execute: async (args: string[]): Promise<CommandResult> => {
        try {
          if (!args.length) {
            return {
              success: false,
              message: 'Please provide tweet content'
            };
          }
    
          const content = args.join(' ');
          if (content.length > 280) {
            return {
              success: false,
              message: 'Tweet exceeds 280 characters'
            };
          }
    
          elizaLogger.info('Attempting to post tweet:', { content });
          await this.twitterService.postTweetWithRetry(content);
    
          return {
            success: true,
            message: 'Tweet posted successfully'
          };
        } catch (error) {
          elizaLogger.error('Failed to post tweet:', error);
          return {
            success: false,
            message: `Failed to post tweet: ${error instanceof Error ? error.message : 'Unknown error'}`
          };
        }
      }
    });
  }

  // Add request timeout handling
private async executeWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 5000
): Promise<T> {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timed out')), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]) as Promise<T>;
}

// Improve command execution
public async handleCommand(input: string): Promise<boolean> {
  try {
    const [commandName, ...args] = input.trim().toLowerCase().split(' ');
    const resolvedCommand = this.aliases.get(commandName) || commandName;
    const command = this.commands.get(resolvedCommand);

    if (!command) {
      return false;
    }

    elizaLogger.info(`Executing command: ${resolvedCommand}`, { args });
    
    const result = await this.executeWithTimeout(
      command.execute(args),
      10000 // 10 second timeout
    );

    if (!result.success) {
      console.log(`\n❌ ${result.message}`);
    } else if (result.message) {
      console.log(`\n✅ ${result.message}`);
    }

    return true;
  } catch (error) {
    elizaLogger.error('Command execution failed:', error);
    console.log('\n❌ Command failed. Please try again.');
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