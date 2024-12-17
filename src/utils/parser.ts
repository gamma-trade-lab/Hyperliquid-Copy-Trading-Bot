// src/utils/parser.ts

import { PublicKey } from '@solana/web3.js';
import { CONFIG } from '../../src/config/settings';

interface ParsedCommand {
   command: string;
   args: string[];
   flags: Record<string, string | boolean>;
}

interface ParsedTransaction {
   type: 'swap' | 'transfer' | 'stake' | 'liquidity';
   amount: number;
   tokenAddress?: string;
   destination?: string;
   slippage?: number;
}

interface ParsedMarketData {
   price: number;
   volume: number;
   marketCap: number;
   change24h: number;
}

export class Parser {
   /**
    * Parse social media commands
    */
   static parseCommand(message: string): ParsedCommand | null {
       try {
           // Remove extra spaces and split by space
           const parts = message.trim().split(/\s+/);
           
           // Check if message starts with command prefix
           if (!parts[0].startsWith(CONFIG.SOCIAL.DISCORD.COMMAND_PREFIX)) {
               return null;
           }

           const command = parts[0].slice(1).toLowerCase();
           const args: string[] = [];
           const flags: Record<string, string | boolean> = {};

           // Parse arguments and flags
           for (let i = 1; i < parts.length; i++) {
               const part = parts[i];
               
               if (part.startsWith('--')) {
                   // Long flag with value
                   const flagParts = part.slice(2).split('=');
                   flags[flagParts[0]] = flagParts[1] || true;
               } else if (part.startsWith('-')) {
                   // Short flag
                   flags[part.slice(1)] = true;
               } else {
                   // Regular argument
                   args.push(part);
               }
           }

           return { command, args, flags };
       } catch (error) {
           console.error('Error parsing command:', error);
           return null;
       }
   }

   /**
    * Parse transaction requests from messages
    */
   static parseTransactionRequest(message: string): ParsedTransaction | null {
       try {
           const words = message.toLowerCase().split(/\s+/);
           
           // Identify transaction type
           const transactionTypes = {
               swap: ['swap', 'trade', 'exchange'],
               transfer: ['send', 'transfer', 'give'],
               stake: ['stake', 'staking', 'earn'],
               liquidity: ['lp', 'pool', 'liquidity']
           };

           let type: ParsedTransaction['type'] | undefined;
           for (const [txType, keywords] of Object.entries(transactionTypes)) {
               if (keywords.some(keyword => words.includes(keyword))) {
                   type = txType as ParsedTransaction['type'];
                   break;
               }
           }

           if (!type) return null;

           // Extract amount
           const amountMatch = message.match(/\d+(\.\d+)?/);
           if (!amountMatch) return null;
           const amount = parseFloat(amountMatch[0]);

           // Extract token address if present
           const addressMatch = message.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
           const tokenAddress = addressMatch ? addressMatch[0] : undefined;

           // Extract destination for transfers
           const destination = type === 'transfer' ? this.extractAddress(message) : undefined;

           // Extract slippage for swaps
           const slippageMatch = message.match(/slippage[:\s]+(\d+(\.\d+)?)/i);
           const slippage = slippageMatch ? parseFloat(slippageMatch[1]) : undefined;

           return {
               type,
               amount,
               tokenAddress,
               destination,
               slippage
           };
       } catch (error) {
           console.error('Error parsing transaction request:', error);
           return null;
       }
   }

   /**
    * Parse market data from various sources
    */
   static parseMarketData(data: any): ParsedMarketData {
       try {
           return {
               price: this.parseNumber(data.price),
               volume: this.parseNumber(data.volume),
               marketCap: this.parseNumber(data.marketCap),
               change24h: this.parseNumber(data.change24h)
           };
       } catch (error) {
           console.error('Error parsing market data:', error);
           throw error;
       }
   }

   /**
    * Validate and parse Solana addresses
    */
   static validateAddress(address: string): PublicKey | null {
       try {
           return new PublicKey(address);
       } catch {
           return null;
       }
   }

   /**
    * Extract token amount from text
    */
   static extractAmount(text: string): number | null {
       const match = text.match(/(\d+(\.\d+)?)\s*(sol|usdc|$meme)/i);
       if (!match) return null;
       return parseFloat(match[1]);
   }

   /**
    * Format errors for user display
    */
   static formatError(error: any): string {
       if (typeof error === 'string') return error;
       if (error.message) return error.message;
       return 'An unknown error occurred';
   }

   // Private helper methods
   private static extractAddress(text: string): string | undefined {
       const words = text.split(/\s+/);
       for (const word of words) {
           if (this.validateAddress(word)) {
               return word;
           }
       }
       return undefined;
   }

   private static parseNumber(value: any): number {
       if (typeof value === 'number') return value;
       if (typeof value === 'string') return parseFloat(value);
       return 0;
   }
}

// Example usage
function example() {
   // Parse command
   const command = Parser.parseCommand('!trade 100 MEME --slippage=1.5');
   console.log('Parsed Command:', command);
   // Output: { command: 'trade', args: ['100', 'MEME'], flags: { slippage: '1.5' } }

   // Parse transaction request
   const transaction = Parser.parseTransactionRequest('swap 50 SOL to MEME with 1% slippage');
   console.log('Parsed Transaction:', transaction);
   // Output: { type: 'swap', amount: 50, slippage: 1 }

   // Validate address
   const address = Parser.validateAddress('YourSolanaAddress');
   console.log('Valid Address:', address !== null);
}

export default Parser;