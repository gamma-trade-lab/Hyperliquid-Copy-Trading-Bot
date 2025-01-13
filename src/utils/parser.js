import { PublicKey } from '@solana/web3.js';
import { elizaLogger } from "@ai16z/eliza";
import { CONFIG } from '../config/settings';
// Command Types
export var CommandType;
(function (CommandType) {
    CommandType["MARKET"] = "market";
    CommandType["ANALYZE"] = "analyze";
    CommandType["TRADE"] = "trade";
    CommandType["TWEET"] = "tweet";
    CommandType["THREAD"] = "thread";
    CommandType["AUTO"] = "auto";
    CommandType["STATUS"] = "status";
    CommandType["HELP"] = "help";
})(CommandType || (CommandType = {}));
// Transaction Types
export var TransactionType;
(function (TransactionType) {
    TransactionType["SWAP"] = "swap";
    TransactionType["BUY"] = "buy";
    TransactionType["SELL"] = "sell";
})(TransactionType || (TransactionType = {}));
export class Parser {
    static TOKEN_REGEX = /^[A-Z0-9]{2,10}$/i;
    static NUMBER_REGEX = /^-?\d*\.?\d+$/;
    static ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    /**
     * Parse command from user input
     */
    static parseCommand(input) {
        try {
            const parts = input.trim().toLowerCase().split(/\s+/);
            if (parts.length === 0)
                return null;
            const commandType = parts[0];
            const args = { raw: input };
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
        }
        catch (error) {
            elizaLogger.error('Error parsing command:', error);
            return null;
        }
    }
    /**
     * Parse market-related commands
     */
    static parseMarketCommand(type, args) {
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
    static parseTradeCommand(args) {
        if (args.length < 3)
            throw new Error('Invalid trade command format');
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
    static parseSocialCommand(type, args) {
        const content = args.join(' ');
        if (!content)
            throw new Error('Content is required for social commands');
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
    static parseAutoCommand(args) {
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
    static parseMarketData(data) {
        try {
            return {
                price: this.parseNumber(data.price) || 0,
                volume24h: this.parseNumber(data.volume24h) || 0,
                marketCap: this.parseNumber(data.marketCap) || 0,
                priceChange24h: this.parseNumber(data.priceChange24h) || 0,
                holders: this.parseNumber(data.holders) ?? undefined,
                liquidity: this.parseNumber(data.liquidity) ?? undefined
            };
        }
        catch (error) {
            elizaLogger.error('Error parsing market data:', error);
            throw new Error('Invalid market data format');
        }
    }
    /**
     * Parse transaction from market data
     */
    static parseTransaction(input) {
        try {
            const parts = input.toLowerCase().split(/\s+/);
            const type = parts[0];
            if (!Object.values(TransactionType).includes(type)) {
                throw new Error('Invalid transaction type');
            }
            const amount = this.parseNumber(parts[1]);
            if (!amount)
                throw new Error('Invalid amount');
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
        }
        catch (error) {
            elizaLogger.error('Error parsing transaction:', error);
            throw new Error('Invalid transaction format');
        }
    }
    /**
     * Validate Solana address
     */
    static validateAddress(address) {
        try {
            if (!this.ADDRESS_REGEX.test(address))
                return null;
            return new PublicKey(address);
        }
        catch {
            return null;
        }
    }
    // Helper methods
    static isValidTokenSymbol(symbol) {
        return this.TOKEN_REGEX.test(symbol);
    }
    static parseNumber(value) {
        if (typeof value === 'number')
            return value;
        if (typeof value === 'string' && this.NUMBER_REGEX.test(value)) {
            return parseFloat(value);
        }
        return null;
    }
    static parseOptions(args) {
        const options = {};
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg.startsWith('--')) {
                const [key, value] = arg.slice(2).split('=');
                options[key] = value === undefined ? true : this.parseOptionValue(value);
            }
        }
        return options;
    }
    static parseOptionValue(value) {
        if (this.NUMBER_REGEX.test(value))
            return parseFloat(value);
        if (value.toLowerCase() === 'true')
            return true;
        if (value.toLowerCase() === 'false')
            return false;
        return value;
    }
    static extractUrls(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.match(urlRegex) || [];
    }
    static formatError(error) {
        if (typeof error === 'string')
            return error;
        if (error instanceof Error)
            return error.message;
        return 'An unknown error occurred';
    }
}
export default Parser;
