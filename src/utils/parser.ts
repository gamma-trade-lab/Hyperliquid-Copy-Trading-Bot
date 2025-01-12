import { PublicKey } from '@solana/web3.js';
import { elizaLogger } from "@ai16z/eliza";
import { CONFIG } from '../config/settings';

// Command Types
export enum CommandType {
    MARKET = 'market',
    ANALYZE = 'analyze',
    TRADE = 'trade',
    TWEET = 'tweet',
    THREAD = 'thread',
    AUTO = 'auto',
    STATUS = 'status',
    HELP = 'help'
}

// Command Arguments Interface
export interface CommandArgs {
    symbol?: string;
    amount?: number;
    slippage?: number;
    timeframe?: string;
    limit?: number;
    type?: string;
    content?: string;
    images?: string[];
    options?: Record<string, any>;
    raw?: string;
}

// Parsed Command Interface
export interface ParsedCommand {
    type: CommandType;
    args: CommandArgs;
    raw: string;
}

// Market Data Interface
export interface ParsedMarketData {
    price: number;
    volume24h: number;
    marketCap: number;
    priceChange24h: number;
    holders?: number;
    liquidity?: number;
}

// Transaction Types
export enum TransactionType {
    SWAP = 'swap',
    BUY = 'buy',
    SELL = 'sell'
}

// Transaction Request Interface
export interface ParsedTransaction {
    type: TransactionType;
    inputToken: string;
    outputToken: string;
    amount: number;
    slippage?: number;
    options?: {
        limit?: number;
        timeout?: number;
        maxImpact?: number;
    };
}

export class Parser {
    private static readonly TOKEN_REGEX = /^[A-Z0-9]{2,10}$/i;
    private static readonly NUMBER_REGEX = /^-?\d*\.?\d+$/;
    private static readonly ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    
    /**
     * Parse command from user input
     */
    static parseCommand(input: string): ParsedCommand | null {
        try {
            const parts = input.trim().toLowerCase().split(/\s+/);
            if (parts.length === 0) return null;

            const commandType = parts[0] as CommandType;
            const args: CommandArgs = { raw: input };

            switch (commandType) {
                case CommandType.MARKET:
                case CommandType.ANALYZE:
                    return this.parseMarketCommand(commandType, parts.slice(1));
                    
                case CommandType.TRADE:
                    return this.parseTradeCommand(parts.slice(1));
                    
                case CommandType.TWEET:
                case CommandType.THREAD:
                    return this.parseSocialCommand(commandType, parts.slice(1));
                    
                case CommandType.AUTO:
                    return this.parseAutoCommand(parts.slice(1));
                    
                case CommandType.STATUS:
                case CommandType.HELP:
                    return { type: commandType, args: {}, raw: input };
                    
                default:
                    return null;
            }
        } catch (error) {
            elizaLogger.error('Error parsing command:', error);
            return null;
        }
    }

    /**
     * Parse market-related commands
     */
    private static parseMarketCommand(type: CommandType, args: string[]): ParsedCommand {
        const symbol = args[0]?.toUpperCase();
        if (!symbol || !this.isValidTokenSymbol(symbol)) {
            throw new Error('Invalid token symbol');
        }

        const timeframe = args[1]?.toLowerCase();
        const validTimeframes = ['1h', '24h', '7d', '30d'];
        
        return {
            type,
            args: {
                symbol,
                timeframe: validTimeframes.includes(timeframe) ? timeframe : '24h',
                options: this.parseOptions(args.slice(2))
            },
            raw: args.join(' ')
        };
    }

    /**
     * Parse trading commands
     */
    private static parseTradeCommand(args: string[]): ParsedCommand {
        if (args.length < 3) throw new Error('Invalid trade command format');

        const [action, amountStr, symbol] = args;
        const amount = this.parseNumber(amountStr);
        
        if (!amount || !this.isValidTokenSymbol(symbol)) {
            throw new Error('Invalid amount or token symbol');
        }

        const options = this.parseOptions(args.slice(3));
        return {
            type: CommandType.TRADE,
            args: {
                type: action,
                symbol: symbol.toUpperCase(),
                amount,
                slippage: options.slippage || CONFIG.SOLANA.TRADING.SLIPPAGE,
                options
            },
            raw: args.join(' ')
        };
    }

    /**
     * Parse social media commands
     */
    private static parseSocialCommand(type: CommandType, args: string[]): ParsedCommand {
        const content = args.join(' ');
        if (!content) throw new Error('Content is required for social commands');

        return {
            type,
            args: {
                content,
                images: this.extractUrls(content)
            },
            raw: args.join(' ')
        };
    }

    /**
     * Parse automation commands
     */
    private static parseAutoCommand(args: string[]): ParsedCommand {
        return {
            type: CommandType.AUTO,
            args: {
                type: args[0] || 'status',
                options: this.parseOptions(args.slice(1))
            },
            raw: args.join(' ')
        };
    }

    /**
     * Parse market data from various sources
     */
    static parseMarketData(data: any): ParsedMarketData {
        try {
            return {
                price: this.parseNumber(data.price) || 0,
                volume24h: this.parseNumber(data.volume24h) || 0,
                marketCap: this.parseNumber(data.marketCap) || 0,
                priceChange24h: this.parseNumber(data.priceChange24h) || 0,
                holders: this.parseNumber(data.holders) ?? undefined,
                liquidity: this.parseNumber(data.liquidity) ?? undefined
            };
        } catch (error) {
            elizaLogger.error('Error parsing market data:', error);
            throw new Error('Invalid market data format');
        }
    }

    /**
     * Parse transaction from market data
     */
    static parseTransaction(input: string): ParsedTransaction {
        try {
            const parts = input.toLowerCase().split(/\s+/);
            const type = parts[0] as TransactionType;
            
            if (!Object.values(TransactionType).includes(type)) {
                throw new Error('Invalid transaction type');
            }

            const amount = this.parseNumber(parts[1]);
            if (!amount) throw new Error('Invalid amount');

            const inputToken = parts[2]?.toUpperCase();
            const outputToken = parts[4]?.toUpperCase();
            
            if (!this.isValidTokenSymbol(inputToken) || !this.isValidTokenSymbol(outputToken)) {
                throw new Error('Invalid token symbols');
            }

            const options = this.parseOptions(parts.slice(5));

            return {
                type,
                inputToken,
                outputToken,
                amount,
                slippage: options.slippage,
                options
            };
        } catch (error) {
            elizaLogger.error('Error parsing transaction:', error);
            throw new Error('Invalid transaction format');
        }
    }

    /**
     * Validate Solana address
     */
    static validateAddress(address: string): PublicKey | null {
        try {
            if (!this.ADDRESS_REGEX.test(address)) return null;
            return new PublicKey(address);
        } catch {
            return null;
        }
    }

    // Helper methods
    private static isValidTokenSymbol(symbol: string): boolean {
        return this.TOKEN_REGEX.test(symbol);
    }

    private static parseNumber(value: any): number | null {
        if (typeof value === 'number') return value;
        if (typeof value === 'string' && this.NUMBER_REGEX.test(value)) {
            return parseFloat(value);
        }
        return null;
    }

    private static parseOptions(args: string[]): Record<string, any> {
        const options: Record<string, any> = {};
        
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg.startsWith('--')) {
                const [key, value] = arg.slice(2).split('=');
                options[key] = value === undefined ? true : this.parseOptionValue(value);
            }
        }
        
        return options;
    }

    private static parseOptionValue(value: string): any {
        if (this.NUMBER_REGEX.test(value)) return parseFloat(value);
        if (value.toLowerCase() === 'true') return true;
        if (value.toLowerCase() === 'false') return false;
        return value;
    }

    private static extractUrls(text: string): string[] {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.match(urlRegex) || [];
    }

    static formatError(error: any): string {
        if (typeof error === 'string') return error;
        if (error instanceof Error) return error.message;
        return 'An unknown error occurred';
    }
}

export default Parser;