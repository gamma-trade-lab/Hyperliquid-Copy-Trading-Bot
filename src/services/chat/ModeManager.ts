import { EventEmitter } from 'events';
import { Mode, ModeConfig, Command } from './types.js';
import { elizaLogger } from "@ai16z/eliza";
import { AutoModeHandler } from './AutoModeHandler.js';
import { TwitterService } from '../social/twitter.js';
import { CommandHandler } from './CommandHandler.js';
import { AIService } from '../ai/ai.js';
import { JupiterPriceV2Service } from '../blockchain/defi/JupiterPriceV2Service.js';

export class ModeManager extends EventEmitter {
  private currentMode: Mode = 'chat';
  private modeConfigs: Map<Mode, ModeConfig> = new Map();
  private isRunning: boolean = false;
  private autoModeHandler: AutoModeHandler;

  constructor(
    twitterService: TwitterService,
    aiService: AIService,
    jupiterService: JupiterPriceV2Service
  ) {
    super();
    this.autoModeHandler = new AutoModeHandler(
      twitterService,
      aiService,
      jupiterService,
      {
        postInterval: 30 * 60 * 1000, // 30 minutes
        marketCheckInterval: 5 * 60 * 1000 // 5 minutes
      }
    );
    this.initializeDefaultCommands();
  }

  private initializeDefaultCommands(): void {
    const defaultCommands: Command[] = [
      {
        name: 'help',
        description: 'Show available commands',
        execute: async () => {
          const config = this.getModeConfig(this.currentMode);
          if (config && config.commands) {
            console.log('\nAvailable commands:');
            config.commands.forEach(cmd => {
              console.log(`${cmd.name}: ${cmd.description}`);
            });
          }
        }
      },
      {
        name: 'mode',
        description: 'Switch mode (chat/auto/market)',
        execute: async (args: string[]) => {
          const newMode = args[0] as Mode;
          await this.switchMode(newMode);
        }
      },
      {
        name: 'status',
        description: 'Show current mode and status',
        execute: async () => {
          console.log(`Current mode: ${this.currentMode}`);
          console.log(`Status: ${this.isRunning ? 'Running' : 'Stopped'}`);
        }
      }
    ];

    // Add default commands to all modes
    ['chat', 'auto', 'market'].forEach(mode => {
      const config = this.modeConfigs.get(mode as Mode) || { commands: [], welcomeMessage: `Switched to ${mode} mode` };
      config.commands = [...(config.commands || []), ...defaultCommands];
      this.modeConfigs.set(mode as Mode, config);
    });
  }

  public registerModeConfig(mode: Mode, config: ModeConfig): void {
    // Merge with existing config if any
    const existingConfig = this.modeConfigs.get(mode);
    const mergedConfig = {
      ...existingConfig,
      ...config,
      commands: [
        ...(existingConfig?.commands || []),
        ...(config.commands || [])
      ]
    };
    
    this.modeConfigs.set(mode, mergedConfig);
    elizaLogger.info(`Registered config for mode: ${mode}`);
  }

  public async switchMode(newMode: Mode): Promise<boolean> {
    if (!this.modeConfigs.has(newMode)) {
      elizaLogger.error(`Invalid mode: ${newMode}`);
      return false;
    }

    try {
      if (this.currentMode === newMode) {
        elizaLogger.warn(`Already in ${newMode} mode`);
        return false;
      }

      // Execute exit handler for current mode if exists
      const currentConfig = this.modeConfigs.get(this.currentMode);
      if (currentConfig?.onExit) {
        await currentConfig.onExit();
      }

      // Handle mode-specific cleanup
      if (this.currentMode === 'auto') {
        this.autoModeHandler.stop();
      }

      // Switch mode
      this.currentMode = newMode;
      this.emit('modeChanged', newMode);

      // Handle mode-specific initialization
      if (newMode === 'auto') {
        await this.autoModeHandler.start();
      }

      // Execute enter handler for new mode
      const newConfig = this.modeConfigs.get(newMode);
      if (newConfig?.onEnter) {
        await newConfig.onEnter();
      }

      if (newConfig?.welcomeMessage) {
        console.log(newConfig.welcomeMessage);
      }

      elizaLogger.success(`Switched to ${newMode} mode`);
      return true;
    } catch (error) {
      elizaLogger.error(`Error switching to ${newMode} mode:`, error);
      return false;
    }
  }

  public getCurrentMode(): Mode {
    return this.currentMode;
  }

  public getModeConfig(mode: Mode): ModeConfig | undefined {
    return this.modeConfigs.get(mode);
  }

  public getAvailableCommands(): Command[] {
    const config = this.getModeConfig(this.currentMode);
    return config?.commands || [];
  }

  public getAutoModeStatus(): { isRunning: boolean; lastPost?: Date } {
    return this.autoModeHandler.getStatus();
  }

  public start(): void {
    this.isRunning = true;
    this.emit('started');
    elizaLogger.success('Mode manager started');
  }

  public stop(): void {
    this.isRunning = false;
    this.emit('stopped');
    elizaLogger.info('Mode manager stopped');
  }

  public isActive(): boolean {
    return this.isRunning;
  }
} 