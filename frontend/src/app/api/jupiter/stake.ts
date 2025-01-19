import { Tool } from "@langchain/core/tools";
import { Connection, PublicKey, Transaction, SendOptions, Commitment } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { NATIVE_MINT } from "@solana/spl-token";
import axios from "axios";

interface StakeResponse {
  tx: string;  // Base64 encoded transaction
  swapTransaction: {
    additionalSerializedMessages?: string[];
    serializedMessage: string;
    signatures?: string[];
  };
}

export class SolanaStakeTool extends Tool {
  name = "solana_stake";
  description = `This tool can be used to stake your SOL (Solana), also called as SOL staking or liquid staking.

  Inputs ( input is a JSON string ):
  amount: number, eg 1 or 0.01 (required)`;

  private connection: Connection;
  private wallet: PublicKey;
  private readonly jupiterStakeUrl = "https://stake.jup.ag/v1/stake";

  constructor(
    rpcUrl: string,
    walletPublicKey: string,
    private options: {
      commitment?: Commitment;
      skipPreflight?: boolean;
    } = {}
  ) {
    super();
    this.connection = new Connection(rpcUrl, this.options.commitment || 'confirmed');
    this.wallet = new PublicKey(walletPublicKey);
  }

  protected async _call(input: string): Promise<string> {
    try {
      let amount: number;
      
      // Parse input amount
      try {
        const parsedInput = JSON.parse(input);
        amount = Number(parsedInput.amount);
      } catch {
        amount = Number(input);
      }

      // Validate amount
      if (isNaN(amount) || amount <= 0) {
        throw new Error('Invalid amount provided. Must be a positive number.');
      }

      // Convert SOL amount to lamports (1 SOL = 1e9 lamports)
      const lamports = amount * 1e9;

      // Check wallet balance
      const balance = await this.connection.getBalance(this.wallet);
      if (balance < lamports) {
        throw new Error(`Insufficient balance. Required: ${amount} SOL, Available: ${balance / 1e9} SOL`);
      }

      // Get associated token account for mSOL
      const msolMint = new PublicKey("mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So");
      const msolTokenAccount = await getAssociatedTokenAddress(
        msolMint,
        this.wallet,
        true
      );

      // Prepare stake transaction
      const stakeParams = {
        amount: lamports.toString(),
        fromToken: NATIVE_MINT.toBase58(),
        toToken: msolMint.toBase58(),
        userPublicKey: this.wallet.toBase58(),
        wrapUnwrapSOL: true,
        destinationTokenAccount: msolTokenAccount.toBase58()
      };

      // Get stake transaction from Jupiter
      const response = await axios.post<StakeResponse>(
        this.jupiterStakeUrl,
        stakeParams
      );

      if (!response.data || !response.data.swapTransaction) {
        throw new Error('Failed to generate stake transaction');
      }

      // Decode and process the transaction
      const serializedTransaction = Buffer.from(
        response.data.swapTransaction.serializedMessage,
        'base64'
      );

      const transaction = Transaction.from(serializedTransaction);

      // Set transaction options
      const opts: SendOptions = {
        skipPreflight: this.options.skipPreflight || false,
        preflightCommitment: this.options.commitment || 'confirmed',
      };

      // Return the prepared transaction data
      return JSON.stringify({
        status: "success",
        message: "Stake transaction prepared successfully",
        transaction: {
          serializedTransaction: serializedTransaction.toString('base64'),
          signatures: response.data.swapTransaction.signatures,
          options: opts
        },
        amount: amount,
        msolTokenAccount: msolTokenAccount.toBase58()
      });

    } catch (error) {
      const err = error as Error;
      return JSON.stringify({
        status: "error",
        message: err.message,
        code: axios.isAxiosError(error) ? 'NETWORK_ERROR' : 'TRANSACTION_ERROR',
      });
    }
  }

  // Helper method to get current mSOL/SOL exchange rate
  async getMsolExchangeRate(): Promise<number> {
    try {
      const response = await axios.get('https://api.marinade.finance/v1/state');
      return response.data.msolPrice;
    } catch (error) {
      throw new Error('Failed to fetch mSOL exchange rate');
    }
  }
}

// Usage example:
/*
const stakeTool = new SolanaStakeTool(
  'https://api.mainnet-beta.solana.com',
  'YOUR_WALLET_PUBLIC_KEY',
  { commitment: 'confirmed' }
);

try {
  const stakeResult = await stakeTool._call(JSON.stringify({ amount: 1 }));
  console.log(JSON.parse(stakeResult));
} catch (error) {
  console.error('Error staking SOL:', error);
}
*/