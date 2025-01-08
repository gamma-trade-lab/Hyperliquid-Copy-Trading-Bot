import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction,
  sendAndConfirmTransaction,
  SystemProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { CONFIG } from '../../config/settings';
import { 
  createMint, 
  createTransferInstruction, 
  mintTo, 
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount
} from '../../utils/spl-token';



interface TokenConfig {
  name: string;
  symbol: string;
  description: string;
  totalSupply: number;
  decimals?: number;
}

interface TransactionResult {
  signature: string;
  tokenAddress?: string;
}

export class SolanaService {
  private connection: Connection;
  private payer: Keypair;

  constructor() {
    this.connection = new Connection(CONFIG.SOLANA.RPC_URL, 'confirmed');
    this.payer = Keypair.fromSecretKey(
      Buffer.from(CONFIG.SOLANA.PRIVATE_KEY, 'base64')
    );
  }

  /**
   * Create a new SPL token
   */
  async createToken(config: TokenConfig): Promise<TransactionResult> {
    try {
      // Create mint account
      const mintKeypair = Keypair.generate();
      const decimals = config.decimals || 9;

      // Create token mint
      const mint = await createMint(
        this.connection,
        this.payer,
        this.payer.publicKey,
        this.payer.publicKey,
        decimals
      );

      // Get the token account of the creator
      const tokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.payer,
        mint,
        this.payer.publicKey
      );

      // Mint initial supply
      const signature = await mintTo(
        this.connection,
        this.payer,
        mint,
        tokenAccount.address,
        this.payer,
        config.totalSupply * Math.pow(10, decimals)
      );

      return {
        signature,
        tokenAddress: mint.toBase58()
      };
    } catch (error) {
      console.error('Error creating token:', error);
      throw error;
    }
  }

  /**
   * Get balance of SOL and tokens
   */
  async getBalance(address: string) {
    try {
      const publicKey = new PublicKey(address);
      
      // Get SOL balance
      const solBalance = await this.connection.getBalance(publicKey);
      
      // Get token accounts
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_PROGRAM_ID }
      );

      const tokens = tokenAccounts.value.map(account => ({
        mint: account.account.data.parsed.info.mint,
        amount: account.account.data.parsed.info.tokenAmount.uiAmount,
        decimals: account.account.data.parsed.info.tokenAmount.decimals
      }));

      return {
        sol: solBalance / LAMPORTS_PER_SOL,
        tokens
      };
    } catch (error) {
      console.error('Error getting balance:', error);
      throw error;
    }
  }

  /**
   * Transfer SOL to an address
   */
  async transferSol(to: string, amount: number): Promise<string> {
    try {
      const toPublicKey = new PublicKey(to);
      const lamports = amount * LAMPORTS_PER_SOL;

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.payer.publicKey,
          toPubkey: toPublicKey,
          lamports
        })
      );

      return await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.payer]
      );
    } catch (error) {
      console.error('Error transferring SOL:', error);
      throw error;
    }
  }

  /**
   * Transfer tokens to an address
   */
  async transferToken(
    tokenAddress: string,
    to: string,
    amount: number
  ): Promise<string> {
    try {
      const mint = new PublicKey(tokenAddress);
      const toPublicKey = new PublicKey(to);

      // Get source token account
      const sourceAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.payer,
        mint,
        this.payer.publicKey
      );

      // Get or create destination token account
      const destinationAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.payer,
        mint,
        toPublicKey
      );

      // Create transfer instruction
      const transaction = new Transaction().add(
        createTransferInstruction(
          sourceAccount.address,
          destinationAccount.address,
          this.payer.publicKey,
          amount,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      return await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.payer]
      );
    } catch (error) {
      console.error('Error transferring token:', error);
      throw error;
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(signature: string) {
    try {
      return await this.connection.getParsedTransaction(signature);
    } catch (error) {
      console.error('Error getting transaction:', error);
      throw error;
    }
  }

  /**
   * Utility function to validate Solana address
   */
  isValidAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get network stats
   */
  async getNetworkStats() {
    try {
      const [slot, blockTime, epochInfo] = await Promise.all([
        this.connection.getSlot(),
        this.connection.getBlockTime(await this.connection.getSlot()),
        this.connection.getEpochInfo()
      ]);

      return {
        currentSlot: slot,
        blockTime,
        epoch: epochInfo.epoch,
        epochProgress: `${((epochInfo.slotIndex / epochInfo.slotsInEpoch) * 100).toFixed(2)}%`
      };
    } catch (error) {
      console.error('Error getting network stats:', error);
      throw error;
    }
  }
}

export default SolanaService;
