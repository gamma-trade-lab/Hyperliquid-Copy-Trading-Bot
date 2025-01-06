import { createInterface } from 'readline';
import { ChatHistoryManager } from './ChatHistoryManager';
import { ModeManager } from './ModeManager';
import { CommandHandler } from './CommandHandler';
import { Mode, ModeConfig } from './types';

export class ChatService {
  private history: ChatHistoryManager;
  private modeManager: ModeManager;
  private commandHandler: CommandHandler;
  private readline = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  constructor() {
    this.history = new ChatHistoryManager();
    this.modeManager = new ModeManager();
    this.commandHandler = new CommandHandler(this.modeManager);
    this.initializeModes();
  }

  private initializeModes(): void {
    // Initialize chat mode
    const chatConfig: ModeConfig = {
      welcomeMessage: 'Welcome to chat mode! Type "help" for available commands.',
      commands: [
        {
          name: 'market',
          description: 'Get latest market data',
          execute: async () => {
            console.log('Fetching market data...');
            // TODO: Implement market data fetching
          }
        }
      ],
      onEnter: async () => {
        console.log('Entering chat mode...');
      },
      onExit: async () => {
        console.log('Exiting chat mode...');
      }
    };

    // Initialize market mode
    const marketConfig: ModeConfig = {
      welcomeMessage: 'Market mode activated. Type "help" for available commands.',
      commands: [
        {
          name: 'price',
          description: 'Get token price',
          execute: async (args: string[]) => {
            const token = args[0];
            console.log(`Getting price for ${token}...`);
            // TODO: Implement price fetching
          }
        }
      ]
    };

    // Initialize auto mode
    const autoConfig: ModeConfig = {
      welcomeMessage: 'Auto mode activated. Bot will run autonomously.',
      commands: [
        {
          name: 'stop',
          description: 'Stop auto mode',
          execute: async () => {
            await this.modeManager.switchMode('chat');
          }
        }
      ]
    };

    this.modeManager.registerModeConfig('chat', chatConfig);
    this.modeManager.registerModeConfig('market', marketConfig);
    this.modeManager.registerModeConfig('auto', autoConfig);
  }

  private async processInput(input: string): Promise<void> {
    // First try to handle as command
    const isCommand = await this.commandHandler.handleCommand(input);
    
    if (!isCommand) {
      // Handle as regular chat message
      this.history.addMessage('user', input);
      
      // TODO: Process chat message through AI service
      const response = `Echo: ${input}`;
      
      this.history.addMessage('assistant', response);
      console.log(response);
    }
  }

  public async start(): Promise<void> {
    const currentMode = this.modeManager.getCurrentMode();
    const config = this.modeManager.getModeConfig(currentMode);
    
    if (config) {
      console.log(config.welcomeMessage);
    }

    // Start chat loop
    this.readline.on('line', async (input: string) => {
      if (input.toLowerCase() === 'exit') {
        this.readline.close();
        return;
      }
      
      await this.processInput(input);
    });

    this.readline.on('close', () => {
      console.log('Goodbye!');
      process.exit(0);
    });
  }
}
