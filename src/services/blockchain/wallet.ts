// src/services/blockchain/wallet.ts

import { Connection, PublicKey, Transaction, Keypair } from '@solana/web3.js';
import { NetworkType } from '../../config/constants';
import axios from 'axios';
import * as LitJsSdk from '@lit-protocol/lit-node-client';
import { LIT_NETWORK, LIT_NETWORKS } from '@lit-protocol/constants';

interface WalletConfig {
  rpcUrl: string;
  network: NetworkType;
  crossmintApiKey?: string;
  litNodeKey?: string;
}

interface WalletBalance {
  sol: number;
  tokens: {
    mint: string;
    amount: number;
    decimals: number;
    symbol?: string;
  }[];
}

class CrossmintClient {
  private apiKey: string;

  constructor(config: { apiKey: string }) {
    this.apiKey = config.apiKey;
  }

  async createWallet(params: any): Promise<any> {
    const response = await axios.post('https://staging.crossmint.com/api/v1-alpha2/wallets', params, {
      headers: {
        'X-API-KEY': this.apiKey,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  }

  async signTransaction(params: any): Promise<Transaction> {
    // Implement Crossmint transaction signing
    return params.transaction;
  }
}

export class WalletService {
  private connection: Connection;
  private crossmint?: CrossmintClient;
  private litNode?: LitJsSdk.LitNodeClient;
  private walletAddresses: Map<string, PublicKey> = new Map();

  constructor(config: WalletConfig) {
    this.connection = new Connection(config.rpcUrl);
    
    if (config.crossmintApiKey) {
      this.crossmint = new CrossmintClient({
        apiKey: config.crossmintApiKey
      });
    }

    if (config.litNodeKey) {
      this.litNode = new LitJsSdk.LitNodeClient({
        litNetwork: config.network === NetworkType.MAINNET ? LIT_NETWORK.Jalapeno : LIT_NETWORK.Habanero
      });
    }
  }

  async createWallet(type: 'crossmint' | 'lit' | 'keypair', params?: any): Promise<string> {
    try {
      let address: string;

      switch (type) {
        case 'crossmint':
          address = await this.createCrossmintWallet(params);
          break;
        case 'lit':
          address = await this.createLitWallet(params);
          break;
        case 'keypair':
          address = await this.createKeypairWallet();
          break;
        default:
          throw new Error('Unsupported wallet type');
      }

      this.walletAddresses.set(address, new PublicKey(address));
      return address;
    } catch (error) {
      console.error('Error creating wallet:', error);
      throw error;
    }
  }

  async getBalance(address: string): Promise<WalletBalance> {
    try {
      const publicKey = new PublicKey(address);
      const solBalance = await this.connection.getBalance(publicKey);
      
      // Get token accounts
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
      );

      const tokens = tokenAccounts.value.map(account => ({
        mint: account.account.data.parsed.info.mint,
        amount: account.account.data.parsed.info.tokenAmount.uiAmount,
        decimals: account.account.data.parsed.info.tokenAmount.decimals,
        symbol: account.account.data.parsed.info.symbol
      }));

      return {
        sol: solBalance / 1e9,
        tokens
      };
    } catch (error) {
      console.error('Error getting balance:', error);
      throw error;
    }
  }

  async signTransaction(
    address: string,
    transaction: Transaction,
    params?: any
  ): Promise<Transaction> {
    try {
      const walletType = await this.getWalletType(address);

      switch (walletType) {
        case 'crossmint':
          return await this.signWithCrossmint(address, transaction, params);
        case 'lit':
          return await this.signWithLit(address, transaction, params);
        case 'keypair':
          return await this.signWithKeypair(address, transaction);
        default:
          throw new Error('Unknown wallet type');
      }
    } catch (error) {
      console.error('Error signing transaction:', error);
      throw error;
    }
  }

  async sendTransaction(transaction: Transaction): Promise<string> {
    try {
      return await this.connection.sendRawTransaction(
        transaction.serialize(),
        { maxRetries: 3 }
      );
    } catch (error) {
      console.error('Error sending transaction:', error);
      throw error;
    }
  }

  private async createCrossmintWallet(params: any): Promise<string> {
    if (!this.crossmint) {
      throw new Error('Crossmint client not initialized');
    }

    const wallet = await this.crossmint.createWallet({
      type: 'solana-custodial-wallet',
      linkedUser: params?.linkedUser
    });

    return wallet.address;
  }

  private async createLitWallet(params: any): Promise<string> {
    if (!this.litNode) {
      throw new Error('Lit Node client not initialized');
    }

    await this.litNode.connect();
    const pkp = await this.litNode.generatePKP({
      permissions: ['SIGN_TX', 'SIGN_MESSAGE'],
      addPermittedAuthMethods: params?.authMethods || []
    });

    return pkp.ethAddress; // Convert to Solana address format
  }

  private async createKeypairWallet(): Promise<string> {
    const keypair = Keypair.generate();
    return keypair.publicKey.toString();
  }

  private async signWithCrossmint(
    address: string,
    transaction: Transaction,
    params?: any
  ): Promise<Transaction> {
    if (!this.crossmint) {
      throw new Error('Crossmint client not initialized');
    }

    return await this.crossmint.signTransaction({
      transaction,
      walletAddress: address,
      ...params
    });
  }

  private async signWithLit(
    address: string,
    transaction: Transaction,
    params?: any
  ): Promise<Transaction> {
    if (!this.litNode) {
      throw new Error('Lit Node client not initialized');
    }

    // Implement Lit Protocol signing
    return transaction;
  }

  private async signWithKeypair(
    address: string,
    transaction: Transaction
  ): Promise<Transaction> {
    // Implement keypair signing
    return transaction;
  }

  private async getWalletType(address: string): Promise<'crossmint' | 'lit' | 'keypair'> {
    // Implement wallet type detection
    return 'crossmint';
  }

  async getWalletAddresses(): Promise<string[]> {
    return Array.from(this.walletAddresses.keys());
  }

  async isValidAddress(address: string): Promise<boolean> {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }
}