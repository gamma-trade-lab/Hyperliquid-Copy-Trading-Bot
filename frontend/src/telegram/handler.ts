import TelegramBot from 'node-telegram-bot-api';
import { botCompletion } from '../utils/groq';
import { elizaLogger } from "@ai16z/eliza";
import { getSolanaPrice } from '../utils/coingecko';
import { getTrendingTokens } from '../utils/birdeye';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Handle specific commands
async function handleCommand(command: string, chatId: number, bot: TelegramBot): Promise<string> {
  switch (command) {
    case '/price':
      try {
        const priceData = await getSolanaPrice();
        return `Solana Price:\n\n` +
               `Price: $${priceData.price.toFixed(2)}\n` +
               `24h Change: ${priceData.price_change_24h.toFixed(2)}%\n` +
               `Market Cap: $${(priceData.market_cap / 1e9).toFixed(2)}B`;
      } catch (error) {
        elizaLogger.error('Error fetching SOL price:', error);
        throw new Error('Unable to fetch Solana price data');
      }

    case '/trending':
      try {
        const tokens = await getTrendingTokens(5);
        let response = 'Trending Tokens:\n\n';
        tokens.forEach((token, index) => {
          response += `${index + 1}. ${token.name} (${token.symbol})\n` +
                     `   Liquidity: $${token.liquidity.toFixed(2)}\n` +
                     `   24h Volume: $${(token.v24hUSD / 1e6).toFixed(2)}M\n\n`;
        });
        return response;
      } catch (error) {
        elizaLogger.error('Error fetching trending tokens:', error);
        throw new Error('Unable to fetch trending tokens');
      }

    default:
      return '';
  }
}

// Main message handler
export async function handleMessage(
  messages: Message[],
  chatId: number,
  bot: TelegramBot
): Promise<string> {
  try {
    await bot.sendChatAction(chatId, 'typing');

    // Check if the last message is a command
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === 'user' && lastMessage.content.startsWith('/')) {
      const commandResponse = await handleCommand(lastMessage.content, chatId, bot);
      if (commandResponse) {
        await bot.sendMessage(chatId, commandResponse, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        });
        return commandResponse;
      }
    }

    // Process normal message with Groq
    const response = await botCompletion(messages, process.env.GROQ_API_KEY);

    // Handle long responses
    if (response.length > 4096) {
      const chunks = splitMessage(response);
      for (const chunk of chunks) {
        await bot.sendMessage(chatId, chunk, {
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        });
      }
    } else {
      await bot.sendMessage(chatId, response, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });
    }

    return response;
  } catch (error) {
    elizaLogger.error('Error in handleMessage:', error);
    
    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes('429')) {
        await bot.sendMessage(chatId, 
          "I'm receiving too many requests right now. Please try again in a moment.");
      } else if (error.message.includes('403')) {
        await bot.sendMessage(chatId,
          "I don't have permission to perform this action.");
      } else {
        await bot.sendMessage(chatId,
          "I encountered an error processing your request. Please try again.");
      }
    }

    throw error;
  }
}

// Helper function to split long messages
function splitMessage(text: string): string[] {
  const maxLength = 4096;
  const chunks: string[] = [];
  
  let currentChunk = '';
  const lines = text.split('\n');

  for (const line of lines) {
    if (currentChunk.length + line.length + 1 <= maxLength) {
      currentChunk += line + '\n';
    } else {
      chunks.push(currentChunk);
      currentChunk = line + '\n';
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

// Helper function to sanitize markdown
function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

export type { Message };