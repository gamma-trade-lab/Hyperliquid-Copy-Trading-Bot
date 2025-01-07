import { Mode, ChatState, ModeConfig } from './types.js';
import { ChatHistoryManager } from './ChatHistoryManager.js';

export class ModeManager {
  private currentMode: Mode = 'chat';
  private state: ChatState;
  private history: ChatHistoryManager;
  private modeConfigs: Map<Mode, ModeConfig>;

  constructor() {
    this.history = new ChatHistoryManager();
    this.state = {
      mode: 'chat',
      context: {
        marketData: false,
        socialData: false,
        chainData: false
      }
    };
    this.modeConfigs = new Map();
  }

  async switchMode(newMode: Mode): Promise<void> {
    // Execute cleanup for current mode
    const currentConfig = this.modeConfigs.get(this.currentMode);
    if (currentConfig?.onExit) {
      await currentConfig.onExit();
    }

    // Update state
    this.state.mode = newMode;
    this.currentMode = newMode;

    // Initialize new mode
    const newConfig = this.modeConfigs.get(newMode);
    if (newConfig?.onEnter) {
      await newConfig.onEnter();
    }

    // Preserve state
    await this.preserveState();
  }

  async preserveState(): Promise<void> {
    // Save current state to persistent storage if needed
    // For now, just maintain in memory
  }

  registerModeConfig(mode: Mode, config: ModeConfig): void {
    this.modeConfigs.set(mode, config);
  }

  getCurrentMode(): Mode {
    return this.currentMode;
  }

  getState(): ChatState {
    return this.state;
  }

  getHistory(): ChatHistoryManager {
    return this.history;
  }

  getModeConfig(mode: Mode): ModeConfig | undefined {
    return this.modeConfigs.get(mode);
  }
}
