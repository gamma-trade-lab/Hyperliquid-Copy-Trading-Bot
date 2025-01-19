import { Connection, VersionedTransaction, PublicKey } from '@solana/web3.js';
import logger from './logger';

// Types
interface WalletBalance {
  balance: number;
  address: string;
}

interface TransactionResult {
  signature: string;
  status: 'success' | 'error';
  message: string;
}

interface RPCConfig {
  url: string;
  name: 'quicknode' | 'helius' | 'fallback';
}

interface ConnectionConfig {
  primary: RPCConfig | null;
  fallback: RPCConfig | null;
}

let tokenizersPromise: Promise<typeof import('@anush008/tokenizers')> | undefined;
if (typeof window === 'undefined') {
  tokenizersPromise = import('@anush008/tokenizers');
}

export class AgentWallet {
  private primaryConnection: Connection | null = null;
  private fallbackConnection: Connection | null = null;
  private isUsingFallback: boolean = false;
  private readonly baseUrl: string;
  private readonly maxRetries: number = 3;
  private readonly retryDelay: number = 2000;

  constructor() {
    // Initialize RPC configurations
    const config = this.initializeConfig();
    
    // Set up connections
    if (config.primary) {
      this.primaryConnection = this.createConnection(config.primary.url);
    }

    if (config.fallback) {
      this.fallbackConnection = this.createConnection(config.fallback.url);
      if (!config.primary) {
        this.primaryConnection = this.fallbackConnection;
      }
    }

    this.baseUrl = process.env.BOT_API_BASE_URL || 
                   process.env.NEXT_PUBLIC_API_BASE_URL || 
                   'http://localhost:3000';

    // Validate configuration
    if (!this.primaryConnection && !this.fallbackConnection) {
      throw new Error('No RPC connections available');
    }
  }

  private initializeConfig(): ConnectionConfig {
    let quickNodeUrl = process.env.NEXT_PUBLIC_QUICKNODE_RPC_URL;
    const heliusApiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;

    const config: ConnectionConfig = {
      primary: null,
      fallback: null
    };

    if (quickNodeUrl) {
      // Ensure QuickNode URL has proper protocol
      quickNodeUrl = this.validateAndFormatUrl(quickNodeUrl);
      config.primary = {
        url: quickNodeUrl,
        name: 'quicknode'
      };
    }

    if (heliusApiKey) {
      const heliusUrl = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
      config[quickNodeUrl ? 'fallback' : 'primary'] = {
        url: heliusUrl,
        name: 'helius'
      };
    }

    // Use public fallback if no other options
    if (!config.primary && !config.fallback) {
      config.primary = {
        url: process.env.NEXT_PUBLIC_FALLBACK_RPC_URL || 'https://api.mainnet-beta.solana.com',
        name: 'fallback'
      };
    }

    return config;
  }

  private validateAndFormatUrl(url: string): string {
    // Remove any trailing slashes
    url = url.trim().replace(/\/+$/, '');
    
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    
    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      throw new Error(`Invalid RPC URL format: ${url}`);
    }
    
    return url;
  }

  private createConnection(url: string): Connection {
    const validatedUrl = this.validateAndFormatUrl(url);
    
    return new Connection(validatedUrl, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
      wsEndpoint: undefined, // Disable WebSocket
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        return fetch(input, {
          ...init,
          headers: {
            ...init?.headers,
            'Content-Type': 'application/json'
          }
        });
      }
    });
  }

  // Rest of the class implementation remains the same...
  public async getActiveConnection(): Promise<Connection> {
    if (!this.isUsingFallback) {
      try {
        if (!this.primaryConnection) {
          throw new Error('Primary connection not initialized');
        }
        await this.primaryConnection.getSlot();
        return this.primaryConnection;
      } catch (error) {
        logger.warn('Primary RPC failed, switching to fallback:', error);
        this.isUsingFallback = true;
      }
    }

    if (!this.fallbackConnection) {
      throw new Error('Fallback connection not initialized');
    }

    try {
      await this.fallbackConnection.getSlot();
      return this.fallbackConnection;
    } catch (error) {
      logger.error('All RPC connections failed:', error);
      throw new Error('No available RPC connection');
    }
  }

  public async getBalance(): Promise<WalletBalance> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/api/wallet`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (!this.isValidBalanceResponse(data)) {
          throw new Error('Invalid balance response format');
        }

        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        logger.warn(`Balance fetch attempt ${attempt} failed:`, error);
        
        if (attempt < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }

    throw lastError || new Error('Failed to get wallet balance');
  }


  public async sendSOL(recipient: string, amount: number): Promise<TransactionResult> {
    try {
      // Validate inputs
      if (!this.isValidPublicKey(recipient)) {
        throw new Error('Invalid recipient address');
      }

      if (!this.isValidAmount(amount)) {
        throw new Error('Invalid amount');
      }

      const connection = await this.getActiveConnection();
      const response = await fetch(`${this.baseUrl}/api/wallet/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          recipient, 
          amount,
          rpcUrl: this.isUsingFallback ? 'helius' : 'quicknode' 
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Transaction failed');
      }

      return await response.json();
    } catch (error) {
      logger.error('Error sending SOL:', error);
      throw error;
    }
  }

  public async signAndSendTransaction(transaction: VersionedTransaction): Promise<string> {
    try {
      const connection = await this.getActiveConnection();
      const serializedTransaction = Buffer.from(transaction.serialize()).toString('base64');
      
      const response = await fetch(`${this.baseUrl}/api/wallet/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          transaction: serializedTransaction,
          rpcUrl: this.isUsingFallback ? 'helius' : 'quicknode' 
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Transaction signing failed');
      }

      const result = await response.json();
      return result.signature;
    } catch (error) {
      logger.error('Transaction signing error:', error);
      throw error;
    }
  }

  public async getAddress(): Promise<string> {
    const walletInfo = await this.getBalance();
    return walletInfo.address;
  }

  public async initialize(): Promise<boolean> { 
    try {
      const connection = await this.getActiveConnection();
      const slot = await connection.getSlot();
      logger.success('Wallet initialized successfully. Current slot:', slot);
      return true;
    } catch (error) {
      if (error instanceof Error) {
        logger.error('Wallet initialization error:', error.message);
      } else {
        logger.error('Wallet initialization error:', error);
      }
      return false;
    }
  }

  public async processWalletText(text: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tokenizer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error('Failed to process text');
      }

      const data = await response.json();
      return data.embedding;
    } catch (error) {
      logger.error('Error processing wallet text:', error);
      throw error;
    }
  }

  private async getTokenizers() {
    if (typeof window !== 'undefined') {
      throw new Error('Tokenizers module is not available on the client side');
    }
    return tokenizersPromise;
  }

  // Validation helpers
  private isValidPublicKey(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  private isValidAmount(amount: number): boolean {
    return amount > 0 && Number.isFinite(amount);
  }

  private isValidBalanceResponse(data: any): data is WalletBalance {
    return (
      data &&
      typeof data.balance === 'number' &&
      typeof data.address === 'string' &&
      this.isValidPublicKey(data.address)
    );
  }
}

// Export singleton instance
export const agentWallet = new AgentWallet();