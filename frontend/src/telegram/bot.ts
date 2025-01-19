import TelegramBot from 'node-telegram-bot-api';
import { handleMessage } from './handler';
import { elizaLogger } from "@ai16z/eliza";

// Environment validation
if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is not set in environment variables');
}

if (!process.env.GROQ_API_KEY) {
  throw new Error('GROQ_API_KEY is not set in environment variables');
}

// Constants
const MAX_CONVERSATION_LENGTH = 10;
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_MESSAGES_PER_WINDOW = 30;

// Types
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface UserState {
  conversation: Message[];
  lastMessageTime: number;
  messageCount: number;
  lastResetTime: number;
}

// Initialize bot with polling
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  polling: true,
  // Added options for better stability
  request: {
    timeout: 30000,
    url: 'https://api.telegram.org'
  }
});

// Store user states (conversations and rate limiting)
const userStates = new Map<number, UserState>();

// Rate limiting function
function isRateLimited(chatId: number): boolean {
  const userState = userStates.get(chatId);
  if (!userState) return false;

  const now = Date.now();
  
  // Reset counter if window has passed
  if (now - userState.lastResetTime >= RATE_LIMIT_WINDOW) {
    userState.messageCount = 0;
    userState.lastResetTime = now;
    return false;
  }

  return userState.messageCount >= MAX_MESSAGES_PER_WINDOW;
}

// Initialize or get user state
function getUserState(chatId: number): UserState {
  if (!userStates.has(chatId)) {
    userStates.set(chatId, {
      conversation: [],
      lastMessageTime: Date.now(),
      messageCount: 0,
      lastResetTime: Date.now()
    });
  }
  return userStates.get(chatId)!;
}

// Command handler for /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from?.username || msg.from?.first_name || 'there';
  
  const welcomeMessage = `Welcome ${username}! 👋\n\n` +
    `I'm JENNA, your Solana trading assistant. I can help you with:\n` +
    `• Market analysis\n` +
    `• Price checking\n` +
    `• Wallet tracking\n` +
    `• Trading insights\n\n` +
    `Check out my token at: https://pump.fun/coin/8hVzPgFopqEQmNNoghr5WbPY1LEjW8GzgbLRwuwHpump\n\n` +
    `Feel free to ask me anything about Solana!`;

  await bot.sendMessage(chatId, welcomeMessage);
});

// Command handler for /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  
  const helpMessage = `Available Commands:\n\n` +
    `/start - Start interaction with JENNA\n` +
    `/help - Show this help message\n` +
    `/clear - Clear conversation history\n` +
    `/price - Get Solana price\n` +
    `/trending - Show trending tokens\n\n` +
    `You can also ask me anything about Solana trading!`;

  await bot.sendMessage(chatId, helpMessage);
});

// Command handler for /clear
bot.onText(/\/clear/, async (msg) => {
  const chatId = msg.chat.id;
  userStates.set(chatId, {
    conversation: [],
    lastMessageTime: Date.now(),
    messageCount: 0,
    lastResetTime: Date.now()
  });
  await bot.sendMessage(chatId, "Conversation history cleared! Ready for new questions.");
});

// Main message handler
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  
  // Ignore command messages
  if (msg.text?.startsWith('/')) return;

  try {
    // Get or initialize user state
    const userState = getUserState(chatId);
    
    // Check rate limiting
    if (isRateLimited(chatId)) {
      await bot.sendMessage(
        chatId,
        "You've reached the message limit. Please wait a minute before sending more messages."
      );
      return;
    }

    // Update rate limiting counters
    userState.messageCount++;
    userState.lastMessageTime = Date.now();

    // Add user message to conversation
    const userMessage: Message = {
      role: 'user',
      content: msg.text || ''
    };
    userState.conversation.push(userMessage);

    // Maintain conversation history limit
    if (userState.conversation.length > MAX_CONVERSATION_LENGTH) {
      userState.conversation.splice(0, userState.conversation.length - MAX_CONVERSATION_LENGTH);
    }

    // Show typing indicator
    await bot.sendChatAction(chatId, 'typing');

    // Handle message and get response
    const response = await handleMessage(userState.conversation, chatId, bot);

    // Add assistant response to conversation
    if (response) {
      userState.conversation.push({
        role: 'assistant',
        content: response
      });
    }

  } catch (error) {
    elizaLogger.error('Error handling message:', error);
    
    // Send user-friendly error message
    await bot.sendMessage(
      chatId,
      "I encountered an error while processing your request. Please try again in a moment."
    );
    
    // Log detailed error for monitoring
    elizaLogger.error('Detailed error:', {
      chatId,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Error handler
bot.on('polling_error', (error) => {
  elizaLogger.error('Polling error:', error);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  elizaLogger.info('Received SIGINT. Cleaning up...');
  
  try {
    await bot.stopPolling();
    elizaLogger.info('Bot polling stopped.');
    
    // Cleanup any other resources here
    
    process.exit(0);
  } catch (error) {
    elizaLogger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  elizaLogger.error('Uncaught exception:', error);
  // Attempt graceful shutdown
  bot.stopPolling()
    .finally(() => process.exit(1));
});

export { bot, type Message, type UserState };