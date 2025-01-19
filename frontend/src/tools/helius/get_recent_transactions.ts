// @/tools/helius/get_recent_transactions.ts
import { PublicKey } from '@solana/web3.js';

interface ParsedTransaction {
  signature: string;
  timestamp: string;
  status: 'success' | 'error' | 'pending';
  type: string;
  amount?: number;
  token?: string;
  from: string;
  to: string;
}

export async function getRecentTransactions(address: string | PublicKey): Promise<ParsedTransaction[]> {
  try {
    const pubkey = typeof address === 'string' ? address : address.toString();
    const response = await fetch(`https://api.helius.xyz/v0/addresses/${pubkey}/transactions?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch transactions');
    }

    const transactions = await response.json();

    return transactions.map((tx: any) => parseTransaction(tx));
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
}

function parseTransaction(tx: any): ParsedTransaction {
  const parsed: ParsedTransaction = {
    signature: tx.signature || tx.transaction?.signatures?.[0],
    timestamp: new Date(tx.timestamp * 1000).toISOString(),
    status: tx.success ? 'success' : 'error',
    type: determineTransactionType(tx),
    from: tx.feePayer || tx.transaction?.message?.accountKeys?.[0],
    to: tx.transaction?.message?.accountKeys?.[1] || ''
  };

  if (tx.amount) {
    parsed.amount = tx.amount;
    parsed.token = tx.token || 'SOL';
  }

  return parsed;
}

function determineTransactionType(tx: any): string {
  if (tx.type) return tx.type;
  
  if (tx.description?.includes('Transfer')) return 'Transfer';
  if (tx.description?.includes('Swap')) return 'Swap';
  if (tx.description?.includes('Mint')) return 'Mint';
  
  return 'Transaction';
}