import { Groq } from 'groq-sdk';
import { getSolanaPrice, getTrendingSolanaTokens } from './coingecko';
import { getSolanaBalance, getTransactionDetails } from './helius';
import { validateSolanaAddress, validateTransactionHash } from './validation';
import { agentWallet } from './wallet';
import { getTokenInfo, swapSolToToken, executeSwap } from './jup';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { requestDevnetAirdrop } from './airdrop';
import logger from './logger';
import {  getSwapQuote } from './jup';
import { getTrendingTokens } from './birdeye';
import { trade } from '@/tools/jupiter';

const BALANCE_CACHE_DURATION = 10000; // 10 seconds
const balanceCache = new Map<string, {
  balance: number;
  timestamp: number;
}>(); 

// Constants
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const JENNA_TOKEN_ADDRESS = '8hVzPgFopqEQmNNoghr5WbPY1LEjW8GzgbLRwuwHpump';

// Available functions for the AI
const functions = [
  {
    name: 'getSolanaPrice',
    description: 'Get current Solana price and market data',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'getTrendingSolanaTokens',
    description: 'Get trending Solana tokens by market cap',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'getWalletBalance',
    description: 'Get SOL balance for a wallet address',
    parameters: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Solana wallet address'
        }
      },
      required: ['address']
    }
  },
  {
    name: 'reviewTransaction',
    description: 'Review transaction details',
    parameters: {
      type: 'object',
      properties: {
        hash: {
          type: 'string',
          description: 'Transaction hash to review'
        }
      },
      required: ['hash']
    }
  },
  {
    name: 'getAgentBalance',
    description: 'Get agent wallet balance',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'requestDevnetAirdrop',
    description: 'Request devnet SOL airdrop',
    parameters: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Recipient address'
        }
      },
      required: ['address']
    }
  },
  {
    name: 'swapSolToToken',
    description: 'Swap SOL to another token',
    parameters: {
      type: 'object',
      properties: {
        amountInSol: {
          type: 'number',
          description: 'Amount of SOL to swap'
        },
        outputMint: {
          type: 'string',
          description: 'Output token mint address'
        }
      },
      required: ['amountInSol']
    }
  },
  {
    name: 'getJupiterQuote',
    description: 'Get a swap quote from Jupiter aggregator',
    parameters: {
      type: 'object',
      properties: {
        inputMint: {
          type: 'string',
          description: 'Input token mint address'
        },
        outputMint: {
          type: 'string',
          description: 'Output token mint address'
        },
        amount: {
          type: 'number',
          description: 'Amount of input token to swap'
        }
      },
      required: ['inputMint', 'outputMint', 'amount']
    }
  },
  {
    name: 'getTrendingTokensData',
    description: 'Get trending tokens data from Birdeye',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of trending tokens to fetch',
          default: 10
        },
        minLiquidity: {
          type: 'number',
          description: 'Minimum liquidity in USD',
          default: 10000
        }
      },
      required: []
    }
  },
  {
    name: 'getDetailedTokenInfo',
    description: 'Get detailed information about a specific token',
    parameters: {
      type: 'object',
      properties: {
        mintAddress: {
          type: 'string',
          description: 'Token mint address to get information for'
        },
        includePrice: {
          type: 'boolean',
          description: 'Whether to include price data',
          default: true
        },
        includeLiquidity: {
          type: 'boolean',
          description: 'Whether to include liquidity data',
          default: true
        }
      },
      required: ['mintAddress']
    }
  }
];

// Types
interface Message {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;  // Optional
  function_call?: {
    name: string;
    arguments: string;
  };
}

// JENNA's personality and system prompt
const JENNA_PERSONALITY = `You are JENNA, a professional Solana trading assistant with the following traits:

Core Traits:
- You provide clear, accurate market analysis and trading insights
- You focus on helping users understand Solana markets and trading
- You maintain a professional but approachable demeanor
- You prioritize accuracy and clarity in your responses

Key Information:
- Your token address: ${JENNA_TOKEN_ADDRESS}
- Token URL: https://pump.fun/coin/${JENNA_TOKEN_ADDRESS}

Response Guidelines:
- Keep responses concise and focused on providing value
- Use technical terms appropriately
- Provide clear explanations when discussing complex topics
- Be direct and professional in your communication
- Only show data visualization or memes when specifically relevant

Trading Focus:
- Emphasize market analysis and trading opportunities
- Provide context for market movements
- Explain technical concepts clearly when needed
- Focus on Solana ecosystem developments`;


// Rate limiting
const RATE_LIMIT = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 3500, // ms
  TOKEN_LIMIT: 5000
};

// Create Groq client with retry mechanism
const createGroqClient = (apiKey: string) => {
  return new Groq({
    apiKey,
    dangerouslyAllowBrowser: true
  });
};

// Helper to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// API key validation
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const groq = createGroqClient(apiKey);
    const response = await groq.chat.completions.create({
      messages: [{ role: 'user', content: 'test' }],
      model: 'mixtral-8x7b-32768'
    });
    return !!response;
  } catch (error) {
    console.error('API Key validation error:', error);
    return false;
  }
}

// Main streaming completion function with retries
export async function streamCompletion(
  messages: Message[],
  onChunk: (chunk: string) => void,
  providedApiKey?: string
): Promise<void> {
  const apiKey = providedApiKey || localStorage.getItem('jenna_api_key');
  if (!apiKey) throw new Error('API key not found');

  const groq = createGroqClient(apiKey);
  let retries = 0;

  while (retries < RATE_LIMIT.MAX_RETRIES) {
    try {
      // Add system message first
      const formattedMessages = [
        {
          role: 'system' as const,
          content: JENNA_PERSONALITY
        },
        ...messages.map(msg => {
          if (msg.role === 'function') {
            return {
              role: 'function' as const,
              name: msg.name!,
              content: msg.content,
              function_call: msg.function_call
            };
          }
          return {
            role: msg.role as 'system' | 'user' | 'assistant',
            content: msg.content,
            ...(msg.name && { name: msg.name }),
            ...(msg.function_call && { function_call: msg.function_call })
          };
        })
      ];

      const stream = await groq.chat.completions.create({
        model: 'mixtral-8x7b-32768',
        messages: formattedMessages as any, // Type assertion to avoid TypeScript errors
        stream: true,
        temperature: 0.7,
        max_tokens: 1000,
        functions,
        function_call: 'auto'
      });

      let functionCallInProgress = false;
      let functionName = '';
      let functionArgs = '';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;

        if (delta.function_call) {
          functionCallInProgress = true;
          functionName = delta.function_call.name || functionName;
          functionArgs += delta.function_call.arguments || '';
          continue;
        }

        if (functionCallInProgress && !delta.function_call) {
          functionCallInProgress = false;
          try {
            let result;
            switch (functionName) {
              case 'getSolanaPrice':
                result = await getSolanaPrice();
                onChunk(`\nCurrent Solana Market Data:\n\n`);
                onChunk(`Price: $${result.price.toFixed(2)}\n`);
                onChunk(`24h Change: ${result.price_change_24h.toFixed(2)}%\n`);
                onChunk(`Market Cap: $${(result.market_cap / 1e9).toFixed(2)}B\n`);
                break;

              case 'getTrendingSolanaTokens':
                result = await getTrendingSolanaTokens();
                onChunk('\nTrending Solana Tokens:\n\n');
                result.forEach((token, index) => {
                  onChunk(`${index + 1}. ${token.name} (${token.symbol})\n`);
                  onChunk(`   Price: $${token.price.toFixed(6)}\n`);
                  onChunk(`   24h Change: ${token.price_change_24h.toFixed(2)}%\n\n`);
                });
                break;

              case 'getWalletBalance':
                const { address } = JSON.parse(functionArgs);
                if (!validateSolanaAddress(address)) {
                  onChunk("\nInvalid Solana address provided. Please check the address and try again.\n");
                  break;
                }
                
                const balanceResult = await getCachedBalance(address);
                onChunk(`\nWallet Balance:\n\n`);
                onChunk(`SOL: ${balanceResult.toFixed(4)}\n`);
                onChunk(`USD Value: $${(balanceResult * (await getSolanaPrice()).price).toFixed(2)}\n`);
                break;

              case 'reviewTransaction':
                const { hash } = JSON.parse(functionArgs);
                if (!validateTransactionHash(hash)) {
                  onChunk("\nInvalid transaction hash. Please provide a valid Solana transaction signature.\n");
                  break;
                }

                const txDetails = await getTransactionDetails(hash);
                onChunk(`\nTransaction Details:\n\n`);
                onChunk(`Status: ${txDetails.status}\n`);
                onChunk(`Timestamp: ${txDetails.timestamp}\n`);
                if (txDetails.amount) {
                  onChunk(`Amount: ${(txDetails.amount / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);
                }
                if (txDetails.fee) {
                  onChunk(`Fee: ${txDetails.fee} SOL\n`);
                }
                break;

              case 'getAgentBalance':
                const walletInfo = await agentWallet.getBalance();
                const solPrice = (await getSolanaPrice()).price;
                const usdBalance = walletInfo.balance * solPrice;
                
                onChunk(`\nJENNA Wallet Status:\n\n`);
                onChunk(`Balance: ${walletInfo.balance.toFixed(4)} SOL\n`);
                onChunk(`USD Value: $${usdBalance.toFixed(2)}\n`);
                onChunk(`Address: ${walletInfo.address}\n`);
                break;

              case 'requestDevnetAirdrop':
                const { address: airdropAddress } = JSON.parse(functionArgs);
                if (!validateSolanaAddress(airdropAddress)) {
                  onChunk("\nInvalid address for airdrop. Please provide a valid Solana address.\n");
                  break;
                }

                const airdropResult = await requestDevnetAirdrop(airdropAddress);
                onChunk(`\nDevnet Airdrop Status:\n\n`);
                onChunk(`Status: ${airdropResult.status}\n`);
                if (airdropResult.signature) {
                  onChunk(`Signature: ${airdropResult.signature}\n`);
                }
                break;

              case 'swapSolToToken':
                const { amountInSol, outputMint = USDC_MINT } = JSON.parse(functionArgs);
                
                if (amountInSol < 0.001) {
                  onChunk("\nMinimum swap amount is 0.001 SOL.\n");
                  break;
                }

                const swapResult = await swapSolToToken(amountInSol, outputMint);
                if (swapResult.status === 'success') {
                  onChunk(`\nSwap Executed Successfully:\n\n`);
                  onChunk(`Amount: ${amountInSol} SOL\n`);
                  onChunk(`Signature: ${swapResult.signature}\n`);
                } else {
                  onChunk(`\nSwap Failed: ${swapResult.message}\n`);
                }
                break;
            }
          } catch (error) {
            console.error('Function execution error:', error);
            onChunk('\nAn error occurred while processing your request. Please try again.\n');
          }
        }

        try {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            onChunk(content);
          }
        } catch (chunkError) {
          logger.error('Error processing chunk:', chunkError);
          continue;
        }
      }

      return; // Success, exit the retry loop

    } catch (error: any) {
      retries++;
      
      // Handle rate limiting
      if (error?.status === 429) {
        logger.warn(`Rate limited. Attempt ${retries} of ${RATE_LIMIT.MAX_RETRIES}`);
        if (retries < RATE_LIMIT.MAX_RETRIES) {
          await delay(RATE_LIMIT.RETRY_DELAY);
          continue;
        }
      }

      // Handle other errors
      logger.error('Groq API error:', error);
      
      // Provide user-friendly error message
      let errorMessage = "\nI apologize, but I encountered an error. ";
      if (error?.status === 429) {
        errorMessage += "I'm receiving too many requests right now.";
      } else if (error?.status === 400) {
        errorMessage += "I wasn't able to process that request properly.";
      } else {
        errorMessage += "Please try again.";
      }

      onChunk(errorMessage);
      
      if (retries >= RATE_LIMIT.MAX_RETRIES) {
        throw error;
      }
    }
  }
}

// Simpler completion without streaming
export async function botCompletion(
  messages: Message[],
  providedApiKey?: string
): Promise<string> {
  const apiKey = providedApiKey;
  if (!apiKey) throw new Error('API key not found');

  const groq = createGroqClient(apiKey);
  let retries = 0;

  while (retries < RATE_LIMIT.MAX_RETRIES) {
    try {
      const formattedMessages = [
        {
          role: 'system',
          content: JENNA_PERSONALITY,
        },
        ...messages.map(msg => {
          if (msg.role === 'function') {
            return {
              role: 'function' as const,
              name: msg.name!,
              content: msg.content,
              function_call: msg.function_call
            };
          }
          return {
            role: msg.role as 'system' | 'user' | 'assistant',
            content: msg.content,
            ...(msg.name && { name: msg.name }),
            ...(msg.function_call && { function_call: msg.function_call })
          };
        })
      ];

      const completion = await groq.chat.completions.create({
        model: 'mixtral-8x7b-32768',
        messages: formattedMessages as any, // Type assertion to avoid TypeScript errors
        temperature: 0.7,
        max_tokens: 1000,
        functions,
        function_call: 'auto'
      });

      const response = completion.choices[0]?.message;
      return response?.content || '';

    } catch (error) {
      retries++;
      
      if (retries < RATE_LIMIT.MAX_RETRIES) {
        await delay(RATE_LIMIT.RETRY_DELAY);
        continue;
      }
      
      logger.error('Groq API error:', error);
      return "I apologize, but I encountered an error. Please try again.";
    }
  }

  return "Maximum retries reached. Please try again later.";
}

// Helper function for balance caching
async function getCachedBalance(address: string): Promise<number> {
  const now = Date.now();
  const cached = balanceCache.get(address);
  
  if (cached && (now - cached.timestamp) < BALANCE_CACHE_DURATION) {
    return cached.balance;
  }
  
  const balance = await agentWallet.getBalance();
  balanceCache.set(address, {
    balance: balance.balance,
    timestamp: now
  });
  
  return balance.balance;
}

// Helper function for transaction type determination
function getChainType(hash: string): 'ethereum' | 'solana' {
  return hash.startsWith('0x') && hash.length === 66 ? 'ethereum' : 'solana';
}

export async function executeTradeCommand(message: string, wallet: any) {
  const amount = parseFloat(message);
  if (isNaN(amount)) {
    return null;
  }
  const parsedCommand = await executeSwap('SOL', 'USDC', amount, USDC_MINT);
  if (parsedCommand) {
    const { outputToken, amount: swapAmount, inputToken } = JSON.parse(parsedCommand);
    return trade(
      wallet,
      new PublicKey(outputToken),
      amount,
      new PublicKey(inputToken),
      50 // 0.5% slippage converted to basis points
    );
  }
  return null;
}

export type { Message };