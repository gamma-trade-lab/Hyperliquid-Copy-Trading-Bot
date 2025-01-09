import { createInterface } from 'readline';
import { ChatHistoryManager } from './ChatHistoryManager';
import { ModeManager } from './ModeManager';
import { CommandHandler } from './CommandHandler';
import { Mode, ModeConfig, CommandResult, ServiceMarketAnalysis } from '@/types/chat';
import { MarketData, MarketAnalysis } from '@/types/market';
import { elizaLogger } from "@ai16z/eliza";
import { AIService } from '../ai/ai';

type MessageRole = 'user' | 'assistant' | 'system';
type IntervalHandle = ReturnType<typeof setInterval>;

export class ChatService {
  private history: ChatHistoryManager;
  private modeManager: ModeManager;
  private commandHandler: CommandHandler;
  private aiService: AIService;
  private isRunning: boolean = false;
  private autoModeInterval: IntervalHandle | null = null;
  
  private readonly readline = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  constructor(aiService: AIService) {
    this.history = new ChatHistoryManager();
    this.modeManager = new ModeManager();
    this.commandHandler = new CommandHandler(this.modeManager);
    this.aiService = aiService;
    this.initializeModes();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.modeManager.on('modeChanged', async (newMode: Mode) => {
      if (newMode === 'auto') {
        await this.startAutoMode();
      } else if (this.autoModeInterval) {
        clearInterval(this.autoModeInterval);
        this.autoModeInterval = null;
      }
    });
  }

  private async startAutoMode(): Promise<void> {
    elizaLogger.info('Starting autonomous mode...');
    
    if (this.autoModeInterval) {
      clearInterval(this.autoModeInterval);
    }

    this.autoModeInterval = setInterval(async () => {
      try {
        // Generate autonomous action using market analysis
        const marketData = await this.aiService.getMarketMetrics();
        if (!marketData) {
          elizaLogger.error('Failed to fetch market data');
          return;
        }

        const analysis = await this.aiService.analyzeMarket(marketData);
        if (!analysis || !analysis.metrics) {
          elizaLogger.error('Failed to analyze market');
          return;
        }

        if (!analysis.metrics.confidence) {
          throw new Error('Market analysis metrics are incomplete');
        }

        if (!analysis.metrics.onChainData) {
          throw new Error('Market analysis onChainData is missing');
        }

        const serviceAnalysis: ServiceMarketAnalysis = {
          ...analysis,
          metrics: {
            ...analysis.metrics,
            confidence: analysis.metrics.confidence ?? 'low',
            onChainData: analysis.metrics.onChainData
          }
        };

        console.log('\nAuto mode action:', serviceAnalysis.action);
        
        // Execute the action
        const result = await this.executeAutoAction(serviceAnalysis);
        console.log('Action result:', result);
        
        // Record in history
        this.recordMessage('assistant', `Executed action: ${serviceAnalysis.action}`);
        this.recordMessage('assistant', `Result: ${result}`);
        
      } catch (error) {
        elizaLogger.error('Error in auto mode:', error instanceof Error ? error.message : String(error));
      }
    }, 10000);
  }

  private async executeAutoAction(analysis: ServiceMarketAnalysis): Promise<string> {
    try {
      const actionResult = `Executed ${analysis.action} with confidence ${analysis.confidence}`;
      elizaLogger.info(actionResult);
      return actionResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      elizaLogger.error('Error executing auto action:', errorMessage);
      return `Failed to execute action: ${errorMessage}`;
    }
  }

  private recordMessage(role: MessageRole, content: string): void {
    if (role === 'system') {
      elizaLogger.info(content);
      return;
    }
    this.history.addMessage(role, content);
  }

  private initializeModes(): void {
    const baseConfig: Omit<ModeConfig, 'welcomeMessage' | 'commands'> = {
      onEnter: async () => {},
      onExit: async () => {}
    };

    // Chat mode configuration
    const chatConfig: ModeConfig = {
      ...baseConfig,
      welcomeMessage: 'Welcome to chat mode! Type "help" for available commands.',
      commands: [
        {
          name: 'market',
          description: 'Get latest market data',
          execute: async (): Promise<void> => {
            try {
              const marketData = await this.aiService.getMarketMetrics();
              if (!marketData) {
                console.log('Failed to fetch market data');
                return;
              }

              console.log('\nMarket Data:', marketData);
            } catch (error) {
              console.log('Error fetching market data');
            }
          }
        },
        {
          name: 'analyze',
          description: 'Analyze current market conditions',
          execute: async (args: string[]): Promise<void> => {
            try {
              const marketData = await this.aiService.getMarketMetrics();
              if (!marketData) {
                console.log('Failed to fetch market data');
                return;
              }

              const analysis = await this.aiService.analyzeMarket(marketData);
              if (!analysis) {
                console.log('Failed to analyze market');
                return;
              }

              console.log('\nMarket Analysis:', analysis);
            } catch (error) {
              console.log('Error analyzing market');
            }
          }
        }
      ]
    };

    // Auto mode configuration
    const autoConfig: ModeConfig = {
      ...baseConfig,
      welcomeMessage: 'Auto mode activated. JENNA will operate autonomously.',
      commands: [
        {
          name: 'pause',
          description: 'Pause autonomous operations',
          execute: async (): Promise<void> => {
            if (this.autoModeInterval) {
              clearInterval(this.autoModeInterval);
              this.autoModeInterval = null;
              console.log('Autonomous operations paused');
              return;
            }
            console.log('Auto mode was not running');
          }
        },
        {
          name: 'resume',
          description: 'Resume autonomous operations',
          execute: async (): Promise<void> => {
            if (!this.autoModeInterval) {
              await this.startAutoMode();
              console.log('Autonomous operations resumed');
              return;
            }
            console.log('Auto mode is already running');
          }
        }
      ]
    };

    this.modeManager.registerModeConfig('chat', chatConfig);
    this.modeManager.registerModeConfig('auto', autoConfig);
  }

  private async processInput(input: string): Promise<void> {
    try {
      // First try to handle as command
      const commandResult = await this.commandHandler.handleCommand(input);
      
      if (commandResult === false) {
        // Handle as regular chat message
        this.recordMessage('user', input);
        
        const response = await this.aiService.generateResponse({
          content: input,
          platform: 'terminal',
          author: 'user'
        });
        
        if (response) {
          this.recordMessage('assistant', response);
          console.log('\nJENNA:', response);
        }
      }
    } catch (error) {
      elizaLogger.error('Error processing input:', error instanceof Error ? error.message : String(error));
      console.log('\nError processing your input. Please try again.');
    }
  }

  public async start(): Promise<void> {
    this.isRunning = true;
    this.modeManager.start();
    
    const currentMode = this.modeManager.getCurrentMode();
    const config = this.modeManager.getModeConfig(currentMode);
    
    if (config?.welcomeMessage) {
      console.log('\n' + config.welcomeMessage);
    }

    // Start input loop
    this.readline.on('line', async (input: string) => {
      if (!this.isRunning) return;

      const trimmedInput = input.trim();
      
      if (trimmedInput.toLowerCase() === 'exit') {
        await this.stop();
        return;
      }
      
      await this.processInput(trimmedInput);
    });

    this.readline.on('close', () => {
      this.stop();
    });

    // Handle Ctrl+C
    process.on('SIGINT', () => {
      this.stop();
    });
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    
    if (this.autoModeInterval) {
      clearInterval(this.autoModeInterval);
      this.autoModeInterval = null;
    }
    
    this.modeManager.stop();
    this.readline.close();
    console.log('\nGoodbye! JENNA shutting down...');
    process.exit(0);
  }
}