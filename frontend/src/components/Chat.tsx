import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import Image from 'next/image';
import { useWallet } from '@solana/wallet-adapter-react';
import { aiService } from '../ai/ai';

// Services

// Icons and UI Components
import { IconArrowRight, IconBolt, IconCoin, IconWallet, IconMicrophone } from './Icon';

// Utils
import { streamCompletion } from '@/utils/groq';
import { validateSolanaAddress, validateTransactionHash } from '@/utils/validation';
import { getSolanaPrice, getTrendingSolanaTokens } from '@/utils/coingecko';
import { getTransactionDetails, getSolanaBalance } from '@/utils/helius';
import { executeSwap, fetchTokenInfo, getTokenInfo, swapSolToToken } from '@/utils/jup';
import { getTrendingTokens, getTokenInfo as getBirdeyeTokenInfo } from '@/utils/birdeye';
import { agentWallet } from '@/utils/wallet';
import { getAssetsByOwner } from '@/tools/helius/get_assets_by_owner';
import { requestDevnetAirdrop } from '@/utils/airdrop';
import { PublicKey } from '@solana/web3.js';
import { fetchPrice } from '@/tools/jupiter/fetch_price';
import { Portfolio } from '@/types/portfolio';
import { SolanaAgentKit } from 'solana-agent-kit';

// Speech Recognition type
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AIService {
  processInput: (input: string) => Promise<string>;
}

const EXAMPLE_PROMPTS = [
  {
    title: "Check SOL Price",
    prompt: "What's the current price of Solana?",
    icon: <IconBolt className="w-6 h-6" />
  },
  {
    title: "View JENNA Token",
    prompt: "Show me info about the JENNA token",
    icon: <IconCoin className="w-6 h-6" />
  },
  {
    title: "Analyze Wallet",
    prompt: "Analyze trading performance for a wallet",
    icon: <IconWallet className="w-6 h-6" />
  }
];

const ImageComponent = (props: React.ComponentPropsWithoutRef<'img'>) => (
  <div className="my-4">
    <Image 
      src={props.src || ''} 
      alt={props.alt || ''}
      width={400} 
      height={400} 
      className="rounded-lg"
    />
  </div>
);

const MarkdownComponents = {
  p: (props: any) => {
    const content = props.children?.toString() || '';
    
    // Handle wallet addresses
    const addressMatch = content.match(/([1-9A-HJ-NP-Za-km-z]{32,44})/);
    const isWalletAddress = addressMatch && content.includes('address');
    
    if (isWalletAddress) {
      const address = addressMatch[0];
      return <WalletAddressComponent address={address} content={content} />;
    }

    // Handle images
    if (content.includes('![')) {
      return <div className="my-4">{props.children}</div>;
    }

    // Handle transactions
    const isTransaction = /balance|SOL|transaction|JENNA/i.test(content);
    return (
      <p className={`mb-4 ${isTransaction ? 'font-mono text-sm break-all bg-gray-800 px-3 py-2 rounded-lg text-gray-200' : 'text-gray-200'}`}>
        {props.children}
      </p>
    );
  },
  img: ImageComponent
};

const WalletAddressComponent = ({ address, content }: { address: string; content: string }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-1">
      <p className="font-mono text-sm text-gray-200">
        {content.split(address)[0]}
      </p>
      <button
        onClick={() => handleCopy(address)}
        className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg transition-colors duration-200 border border-gray-700"
      >
        <span className="font-mono text-sm break-all text-gray-200">{address}</span>
        {copied ? (
          <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
        )}
      </button>
    </div>
  );
};

const fetchSolanaPrice = async () => {
  try {
    const priceData = await getSolanaPrice();
    return `Current Solana Price: $${priceData.price.toFixed(2)}
24h Change: ${priceData.price_change_24h.toFixed(2)}%
Market Cap: $${priceData.market_cap.toLocaleString()}`;
  } catch (error) {
    console.error('Error fetching Solana price:', error);
    return 'Unable to fetch Solana price at the moment.';
  }
};

const fetchTrendingSolanaTokens = async () => {
  try {
    const trendingTokens = await getTrendingSolanaTokens();
    return trendingTokens.map(token => 
      `Token: ${token.name} (${token.symbol})
Price: $${token.price.toFixed(2)}
24h Change: ${token.price_change_24h.toFixed(2)}%
Market Cap: $${token.market_cap?.toLocaleString() || 'N/A'}
Volume (24h): $${token.volume_24h?.toLocaleString() || 'N/A'}`
    ).join('\n\n');
  } catch (error) {
    console.error('Error fetching trending tokens:', error);
    return 'Unable to fetch trending tokens at the moment.';
  }
};

const fetchTransactionDetails = async (signature: string) => {
  if (!validateTransactionHash(signature)) {
    return 'Invalid transaction signature.';
  }
  try {
    const details = await getTransactionDetails(signature);
    return `Transaction Details:
Type: ${details.type}
Timestamp: ${details.timestamp}
Status: ${details.status}
Amount: ${details.amount || 'N/A'}
Sender: ${details.sender || 'N/A'}
Receiver: ${details.receiver || 'N/A'}
Fee: ${details.fee || 'N/A'}
Token Transfer: ${details.tokenTransfer ? `${details.tokenTransfer.amount} ${details.tokenTransfer.symbol}` : 'N/A'}`;
  } catch (error) {
    console.error('Error fetching transaction details:', error);
    return 'Unable to fetch transaction details at the moment.';
  }
};

const fetchSolanaBalance = async (address: string) => {
  try {
    const balance = await getSolanaBalance(address);
    return `Balance: ${balance.balance} SOL
Balance in USD: $${balance.balanceInUSD.toFixed(2)}
Timestamp: ${balance.timestamp}`;
  } catch (error) {
    console.error('Error fetching Solana balance:', error);
    return 'Unable to fetch Solana balance at the moment.';
  }
};

const fetchWalletBalance = async () => {
  try {
    const balance = await agentWallet.getBalance();
    return `Wallet Address: ${balance.address}
Balance: ${balance.balance} SOL`;
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    return 'Unable to fetch wallet balance at the moment.';
  }
};

const sendSolToAddress = async (recipient: string, amount: number) => {
  if (!validateSolanaAddress(recipient)) {
    postMessage((prev: Message[]) => [...prev, { role: 'assistant', content: 'Invalid recipient address.' }]);
    return;
  }
  try {
    const result = await agentWallet.sendSOL(recipient, amount);
    return `Transaction ${result.status}: ${result.message}`;
  } catch (error) {
    console.error('Error sending SOL:', error);
    return 'Unable to send SOL at the moment.';
  }
};

/* eslint-disable react-hooks/rules-of-hooks */

const useFetchTokenInfo = (tokenMint: string) => {
  return useCallback(async () => {
    try {
      const info = await fetchTokenInfo(tokenMint);
      return info;
    } catch (error) {
      console.error('Error fetching token info:', error);
      return 'Unable to fetch token info at the moment.';
    }
  }, [tokenMint]);
};

const useExecuteSwap = (amountInSol: number, outputMint: string) => {
  return useCallback(async () => {
    try {
      const result = await executeSwap('SOL', 'USDC', amountInSol, outputMint);
      return result;
    } catch (error) {
      console.error('Error executing swap:', error);
      return 'Unable to execute swap at the moment.';
    }
  }, [amountInSol, outputMint]);
};

const useWalletBalance = () => {
  const { publicKey } = useWallet();
  return useCallback(async () => {
    if (!publicKey) {
      return 'Wallet not connected.';
    }
    const balance = await fetchSolanaBalance(publicKey.toString());
    return balance;
  }, [publicKey]);
};

const useAiService = (input: string) => {
  return useCallback(async () => {
    try {
      const response = await (aiService as unknown as AIService).processInput(input);
      return response;
    } catch (error) {
      console.error('Error using AI service:', error);
      return 'Unable to process input at the moment.';
    }
  }, [input]);
};

const handleTokenInfo = async (tokenMint: string) => {
  const fetchTokenInfo = useFetchTokenInfo(tokenMint);
  const info = await fetchTokenInfo();
  postMessage((prev: Message[]) => [...prev, { role: 'assistant', content: info }]);
};

const handleTokenSwap = async (amountInSol: number, outputMint: string) => {
  const executeSwap = useExecuteSwap(amountInSol, outputMint);
  const result = await executeSwap();
  postMessage((prev: Message[]) => [...prev, { role: 'assistant', content: result }]);
};

const handleTrendingTokens = async () => {
  try {
    const tokens = await getTrendingTokens();
    const tokenInfo = tokens.map(token => 
      `Token: ${token.name} (${token.symbol})
Price: $${token.v24hUSD.toFixed(2)}
24h Change: ${token.v24hChangePercent.toFixed(2)}%
Market Cap: $${token.mc.toLocaleString()}
Liquidity: $${token.liquidity.toLocaleString()}`
    ).join('\n\n');
    postMessage((prev: Message[]) => [...prev, { role: 'assistant', content: tokenInfo }]);
  } catch (error) {
    postMessage((prev: Message[]) => [...prev, { role: 'assistant', content: 'Unable to fetch trending tokens at the moment.' }]);
  }
};

const handleBirdeyeTokenInfo = async (tokenMint: string) => {
  try {
    const tokenInfo = await getBirdeyeTokenInfo(tokenMint);
    if (!tokenInfo) {
      postMessage((prev: Message[]) => [...prev, { role: 'assistant', content: `Token information for ${tokenMint} not found.` }]);
      return;
    }
    const info = `Token: ${tokenInfo.name} (${tokenInfo.symbol})
Price: $${tokenInfo.v24hUSD.toFixed(2)}
24h Change: ${tokenInfo.v24hChangePercent.toFixed(2)}%
Market Cap: $${tokenInfo.mc.toLocaleString()}
Liquidity: $${tokenInfo.liquidity.toLocaleString()}`;
    postMessage((prev: Message[]) => [...prev, { role: 'assistant', content: info }]);
  } catch (error) {
    postMessage((prev: Message[]) => [...prev, { role: 'assistant', content: 'Unable to fetch token information at the moment.' }]);
  }
};

const handleWalletBalance = async () => {
  const fetchWalletBalance = useWalletBalance();
  const balanceInfo = await fetchWalletBalance();
  postMessage((prev: Message[]) => [...prev, { role: 'assistant', content: balanceInfo }]);
};

const handleSendSol = async (recipient: string, amount: number) => {
  if (!validateSolanaAddress(recipient)) {
    postMessage((prev: Message[]) => [...prev, { role: 'assistant', content: 'Invalid recipient address.' }]);
    return;
  }
  const result = await sendSolToAddress(recipient, amount);
  postMessage((prev: Message[]) => [...prev, { role: 'assistant', content: result }]);
};

const fetchAssetsByOwner = async (ownerPublicKey: string, limit: number) => {
  try {
    const agent = new SolanaAgentKit(
      process.env.NEXT_PUBLIC_PRIVATE_KEY || '',
      process.env.NEXT_PUBLIC_RPC_URL || '',
      'confirmed'
    ); // Initialize SolanaAgentKit instance
    const publicKey = new PublicKey(ownerPublicKey);
    const assets = await getAssetsByOwner(agent, publicKey, limit);
    return assets;
  } catch (error) {
    console.error('Error fetching assets by owner:', error);
    return 'Unable to fetch assets at the moment.';
  }
};

const handleAssetsByOwner = async (ownerPublicKey: string, limit: number) => {
  const assets = await fetchAssetsByOwner(ownerPublicKey, limit);
  postMessage((prev: Message[]) => [...prev, { role: 'assistant', content: JSON.stringify(assets, null, 2) }]);
};

const handleFetchTokenPrice = async (tokenMint: string) => {
  try {
    const price = await fetchPrice(new PublicKey(tokenMint));
    postMessage((prev: Message[]) => [...prev, { role: 'assistant', content: `Price of token ${tokenMint}: $${price}` }]);
  } catch (error) {
    postMessage((prev: Message[]) => [...prev, { role: 'assistant', content: 'Unable to fetch token price at the moment.' }]);
  }
};

const handleCreatePortfolio = async (assets: Portfolio['assets']) => {
  const portfolio: Portfolio = {
    totalValueUSD: assets.reduce((acc, asset) => acc + asset.valueUSD, 0),
    assets,
    percentages: assets.reduce((acc, asset) => {
      acc[asset.symbol] = ((asset.valueUSD / portfolio.totalValueUSD) * 100).toFixed(2) + '%';
      return acc;
    }, {} as Portfolio['percentages'])
  };
  postMessage((prev: Message[]) => [...prev, { role: 'assistant', content: `Portfolio created: ${JSON.stringify(portfolio, null, 2)}` }]);
};

const handleDevnetAirdrop = async (address: string, amount?: number) => {
  const result = await requestDevnetAirdrop(address, { amount });
  postMessage((prev: Message[]) => [...prev, { role: 'assistant', content: JSON.stringify(result, null, 2) }]);
};

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recognition = useRef<any>(null);

  const isInitialState = messages.length === 0;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognition.current = new SpeechRecognition();
      recognition.current.continuous = false;
      recognition.current.interimResults = false;
      recognition.current.lang = 'en-US';

      recognition.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
      };

      recognition.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  // Auto-focus input after loading
  useEffect(() => {
    if (!isLoading) {
      const focusTimeout = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(focusTimeout);
    }
  }, [isLoading]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messageUpdateTimeoutRef.current) {
      clearTimeout(messageUpdateTimeoutRef.current);
    }
    messageUpdateTimeoutRef.current = setTimeout(scrollToBottom, 100);
    
    return () => {
      if (messageUpdateTimeoutRef.current) {
        clearTimeout(messageUpdateTimeoutRef.current);
      }
    };
  }, [messages, scrollToBottom]);

  const toggleListening = () => {
    if (isListening) {
      recognition.current?.stop();
    } else {
      recognition.current?.start();
      setIsListening(true);
    }
  };

  const updateMessages = useCallback((currentContent: string) => {
    setMessages(prev => {
      const newMessages = [...prev];
      const lastMessage = newMessages[newMessages.length - 1];
      
      if (lastMessage?.role === 'assistant') {
        return [
          ...newMessages.slice(0, -1),
          { ...lastMessage, content: currentContent }
        ];
      }
      return [...newMessages, { role: 'assistant', content: currentContent }];
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input.trim() } as Message;
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let currentContent = '';
      const allMessages = [...messages, userMessage];
      
      await streamCompletion(allMessages, (chunk) => {
        currentContent += chunk;
        updateMessages(currentContent);
      });

      // Check for specific commands
      if (input.toLowerCase().includes('wallet balance')) {
        await handleWalletBalance();
      } else if (input.toLowerCase().includes('send sol')) {
        const [_, recipient, amountStr] = input.split(' ');
        const amount = parseFloat(amountStr);
        if (!isNaN(amount) && recipient) {
          await handleSendSol(recipient, amount);
        }
      } else if (input.toLowerCase().includes('token info')) {
        const tokenMint = input.split(' ').pop();
        if (tokenMint) {
          await handleTokenInfo(tokenMint);
        }
      } else if (input.toLowerCase().includes('swap')) {
        const [_, amount, token] = input.split(' ');
        const amountInSol = parseFloat(amount);
        if (!isNaN(amountInSol) && token) {
          await handleTokenSwap(amountInSol, token);
        }
      } else if (input.toLowerCase().includes('trending tokens')) {
        await handleTrendingTokens();
      } else if (input.toLowerCase().includes('birdeye token info')) {
        const tokenMint = input.split(' ').pop();
        if (tokenMint) {
          await handleBirdeyeTokenInfo(tokenMint);
        }
      } else if (input.toLowerCase().includes('assets by owner')) {
        const [_, ownerPublicKey, limitStr] = input.split(' ');
        const limit = parseInt(limitStr, 10);
        if (!isNaN(limit) && ownerPublicKey) {
          await handleAssetsByOwner(ownerPublicKey, limit);
        }
      } else if (input.toLowerCase().includes('fetch token price')) {
        const tokenMint = input.split(' ').pop();
        if (tokenMint) {
          await handleFetchTokenPrice(tokenMint);
        }
      } else if (input.toLowerCase().includes('create portfolio')) {
        const assets = JSON.parse(input.split('create portfolio ')[1]);
        await handleCreatePortfolio(assets);
      } else if (input.toLowerCase().includes('transaction details')) {
        const signature = input.split(' ').pop();
        if (signature) {
          const details = await fetchTransactionDetails(signature);
          postMessage((prev: Message[]) => [...prev, { role: 'assistant', content: details }]);
        }
      } else if (input.toLowerCase().includes('devnet airdrop')) {
        const [_, address, amountStr] = input.split(' ');
        const amount = parseFloat(amountStr);
        if (!isNaN(amount) && address) {
          await handleDevnetAirdrop(address, amount);
        } else if (address) {
          await handleDevnetAirdrop(address);
        }
      }
      const aiService = useAiService(input);
      const aiResponse = await aiService();
      updateMessages(aiResponse);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex-0 border-b dark:border-gray-800 p-4">
        <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white font-mono">
          JENNA AI Assistant
        </h1>
      </div>

      <div className={`flex-1 ${isInitialState ? 'flex items-center justify-center' : 'overflow-y-auto'} p-4`}>
        {isInitialState ? (
          <div className="w-full max-w-2xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-8 text-gray-800 dark:text-gray-200">
              JENNA - Solana Trading Assistant
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {EXAMPLE_PROMPTS.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setInput(prompt.prompt);
                    textareaRef.current?.focus();
                  }}
                  className="flex items-center p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-200 dark:border-gray-700"
                >
                  <div className="mr-3 text-purple-500">{prompt.icon}</div>
                  <div className="text-left">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{prompt.title}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{prompt.prompt}</div>
                  </div>
                </button>
              ))}
            </div>
            
            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
              View token: <a href="https://pump.fun/coin/8hVzPgFopqEQmNNoghr5WbPY1LEjW8GzgbLRwuwHpump" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-purple-500 hover:text-purple-600">
                JENNA Token on PumpFun
              </a>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-3xl mx-auto space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-4 ${
                    message.role === 'user'
                      ? 'bg-purple-500 text-white'
                      : 'bg-white dark:bg-gray-800 dark:text-white shadow-md'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <ReactMarkdown 
                      components={MarkdownComponents}
                      className="prose dark:prose-invert max-w-none"
                    >
                      {message.content}
                    </ReactMarkdown>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="flex-0 p-4 border-t dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
        <form 
          onSubmit={handleSubmit}
          className="w-full max-w-3xl mx-auto relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Ask JENNA anything about Solana trading..."
            className="w-full p-4 pr-24 bg-transparent resize-none outline-none dark:text-white font-mono"
            rows={1}
            style={{ maxHeight: '200px' }}
          />
          <button
            type="button"
            onClick={toggleListening}
            className={`absolute right-14 bottom-2 top-2 px-4 ${
              isListening ? 'text-red-500' : 'text-gray-500'
            } hover:text-gray-700 transition-colors duration-200`}
          >
            <IconMicrophone className="w-5 h-5" />
          </button>
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-2 bottom-2 top-2 px-4 bg-purple-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-600 transition-colors duration-200"
          >
            <IconArrowRight className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}

