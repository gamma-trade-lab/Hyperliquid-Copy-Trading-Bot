import { EventEmitter } from 'events';
import { elizaLogger } from "@ai16z/eliza";
export class ModeManager extends EventEmitter {
    currentMode = 'chat';
    modeConfigs = new Map();
    isRunning = false;
    constructor() {
        super();
        this.initializeDefaultCommands();
    }
    initializeDefaultCommands() {
        const defaultCommands = [
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
                execute: async (args) => {
                    const newMode = args[0];
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
            const config = this.modeConfigs.get(mode) || { commands: [], welcomeMessage: `Switched to ${mode} mode` };
            config.commands = [...(config.commands || []), ...defaultCommands];
            this.modeConfigs.set(mode, config);
        });
    }
    registerModeConfig(mode, config) {
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
    async switchMode(newMode) {
        if (!this.modeConfigs.has(newMode)) {
            elizaLogger.error(`Invalid mode: ${newMode}`);
            return false;
        }
        try {
            // Execute exit handler for current mode if exists
            const currentConfig = this.modeConfigs.get(this.currentMode);
            if (currentConfig?.onExit) {
                await currentConfig.onExit();
            }
            // Switch mode
            this.currentMode = newMode;
            this.emit('modeChanged', newMode);
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
        }
        catch (error) {
            elizaLogger.error(`Error switching to ${newMode} mode:`, error);
            return false;
        }
    }
    getCurrentMode() {
        return this.currentMode;
    }
    getModeConfig(mode) {
        return this.modeConfigs.get(mode);
    }
    getAvailableCommands() {
        const config = this.getModeConfig(this.currentMode);
        return config?.commands || [];
    }
    start() {
        this.isRunning = true;
        this.emit('started');
        elizaLogger.success('Mode manager started');
    }
    stop() {
        this.isRunning = false;
        this.emit('stopped');
        elizaLogger.info('Mode manager stopped');
    }
    isActive() {
        return this.isRunning;
    }
}
