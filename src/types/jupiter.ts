import { PublicKey, Transaction, VersionedTransaction, TransactionError } from '@solana/web3.js';

export interface JupiterPrice {
  id: string;
  mintSymbol: string;
  vsToken: string;
  vsTokenSymbol: string;
  price: number;
  confidence: number;
}

export interface JupiterPriceResponse {
  data: {
    [tokenAddress: string]: JupiterPrice;
  };
}

export interface RouteInfo {
  inAmount: bigint;
  outAmount: bigint;
  priceImpactPct: number;
  marketInfos: MarketInfo[];
  slippageBps: number;
}

export interface MarketInfo {
  id: string;
  label: string;
  inputMint: PublicKey;
  outputMint: PublicKey;
  notEnoughLiquidity: boolean;
  inAmount: bigint;
  outAmount: bigint;
  minInAmount?: bigint;
  minOutAmount?: bigint;
  priceImpactPct: number;
  lpFee: {
    amount: bigint;
    mint: PublicKey;
    percent: number;
  };
  platformFee: {
    amount: bigint;
    mint: PublicKey;
    percent: number;
  };
}

export interface TradeResult {
  id: string;
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  outputAmount: number;
  executionPrice: number;
  slippage: number;
  priceImpact: number;
  fee: number;
  route: string[];
  timestamp: number;
}

export interface Position {
  id: string;
  token: string;
  entryPrice: number;
  currentPrice: number;
  size: number;
  stopLossPrice: number;
  stopLossThreshold: number;
  timestamp: number;
  lastUpdate: number;
}

export interface JupiterExchangeParams {
  routeInfo: RouteInfo;
  userPublicKey: PublicKey;
}

export interface JupiterExchangeResponse {
  swapTransaction: Transaction | VersionedTransaction;
}

export interface SwapResult {
  inputAddress: PublicKey;
  outputAddress: PublicKey;
  inputAmount: number;
  outputAmount: number;
  error?: TransactionError;
  txid: string;
}
