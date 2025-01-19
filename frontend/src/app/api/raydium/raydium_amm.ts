import { Tool } from "langchain/tools";
import { 
  Connection, 
  PublicKey, 
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
  Commitment
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

interface RaydiumAmmAccounts {
  ammId: PublicKey;
  ammAuthority: PublicKey;
  ammOpenOrders: PublicKey;
  ammTargetOrders: PublicKey;
  lpMintAddress: PublicKey;
  poolCoinTokenAccount: PublicKey;
  poolPcTokenAccount: PublicKey;
  serumMarket: PublicKey;
  serumProgramId: PublicKey;
}

export class RaydiumAmmV4Tool extends Tool {
  name = "raydium_create_ammV4";
  description = `Raydium's Legacy AMM that requires an OpenBook marketID

  Inputs (input is a json string):
  marketId: string (required)
  baseAmount: number(int), eg: 111111 (required)
  quoteAmount: number(int), eg: 111111 (required)
  startTime: number(seconds), eg: now number or zero (required)
  `;

  private connection: Connection;
  private wallet: PublicKey;
  
  // Raydium program IDs
  private readonly RAYDIUM_LIQUIDITY_PROGRAM_ID_V4 = new PublicKey(
    "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
  );
  private readonly OPENBOOK_PROGRAM_ID = new PublicKey(
    "srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX"
  );

  constructor(
    rpcUrl: string,
    walletPublicKey: string,
    private options: {
      commitment?: Commitment;
    } = {}
  ) {
    super();
    this.connection = new Connection(rpcUrl, this.options.commitment || 'confirmed' as Commitment);
    this.wallet = new PublicKey(walletPublicKey);
  }

  protected async _call(input: string): Promise<string> {
    try {
      const {
        marketId,
        baseAmount,
        quoteAmount,
        startTime
      } = JSON.parse(input);

      // Input validation
      if (!marketId) throw new Error('Market ID is required');
      if (!baseAmount || baseAmount <= 0) throw new Error('Valid base amount is required');
      if (!quoteAmount || quoteAmount <= 0) throw new Error('Valid quote amount is required');
      if (startTime === undefined) throw new Error('Start time is required');

      const marketPubkey = new PublicKey(marketId);
      
      // Get market info and validate
      const marketInfo = await this.connection.getAccountInfo(marketPubkey);
      if (!marketInfo) {
        throw new Error('Invalid market ID - market not found');
      }

      // Generate necessary PDAs and accounts
      const accounts = await this.generateAmmAccounts(marketPubkey);
      
      // Create AMM initialization instruction
      const initAmmIx = await this.createInitAmmInstruction(
        accounts,
        new BN(baseAmount),
        new BN(quoteAmount),
        new BN(startTime)
      );

      // Create and return transaction
      const transaction = new Transaction().add(initAmmIx);
      
      // Get latest blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.wallet;

      return JSON.stringify({
        status: "success",
        message: "Raydium AMM v4 pool initialization prepared successfully",
        transaction: {
          serializedTransaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
          accounts: {
            ammId: accounts.ammId.toBase58(),
            lpMintAddress: accounts.lpMintAddress.toBase58(),
            poolCoinTokenAccount: accounts.poolCoinTokenAccount.toBase58(),
            poolPcTokenAccount: accounts.poolPcTokenAccount.toBase58()
          }
        }
      });

    } catch (error) {
      const err = error as Error;
      return JSON.stringify({
        status: "error",
        message: err.message,
        code: "TRANSACTION_CREATION_ERROR",
      });
    }
  }

  private async generateAmmAccounts(marketId: PublicKey): Promise<RaydiumAmmAccounts> {
    // Generate AMM seeds
    const ammSeed = marketId.toBuffer().slice(0, 32);
    
    // Derive PDAs
    const [ammId] = PublicKey.findProgramAddressSync(
      [Buffer.from("amm_v4"), ammSeed],
      this.RAYDIUM_LIQUIDITY_PROGRAM_ID_V4
    );

    const [ammAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("amm_authority_v4")],
      this.RAYDIUM_LIQUIDITY_PROGRAM_ID_V4
    );

    const [lpMintAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("lp_mint_v4"), ammSeed],
      this.RAYDIUM_LIQUIDITY_PROGRAM_ID_V4
    );

    const [poolCoinTokenAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_coin_v4"), ammSeed],
      this.RAYDIUM_LIQUIDITY_PROGRAM_ID_V4
    );

    const [poolPcTokenAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_pc_v4"), ammSeed],
      this.RAYDIUM_LIQUIDITY_PROGRAM_ID_V4
    );

    const [ammOpenOrders] = PublicKey.findProgramAddressSync(
      [Buffer.from("open_orders_v4"), ammSeed],
      this.RAYDIUM_LIQUIDITY_PROGRAM_ID_V4
    );

    const [ammTargetOrders] = PublicKey.findProgramAddressSync(
      [Buffer.from("target_orders_v4"), ammSeed],
      this.RAYDIUM_LIQUIDITY_PROGRAM_ID_V4
    );

    return {
      ammId,
      ammAuthority,
      ammOpenOrders,
      ammTargetOrders,
      lpMintAddress,
      poolCoinTokenAccount,
      poolPcTokenAccount,
      serumMarket: marketId,
      serumProgramId: this.OPENBOOK_PROGRAM_ID
    };
  }

  private async createInitAmmInstruction(
    accounts: RaydiumAmmAccounts,
    baseAmount: BN,
    quoteAmount: BN,
    startTime: BN
  ): Promise<TransactionInstruction> {
    const dataLayout = {
      baseAmount,
      quoteAmount,
      startTime,
    };

    const keys = [
      { pubkey: accounts.ammId, isSigner: false, isWritable: true },
      { pubkey: accounts.ammAuthority, isSigner: false, isWritable: false },
      { pubkey: accounts.ammOpenOrders, isSigner: false, isWritable: true },
      { pubkey: accounts.lpMintAddress, isSigner: false, isWritable: true },
      { pubkey: accounts.poolCoinTokenAccount, isSigner: false, isWritable: true },
      { pubkey: accounts.poolPcTokenAccount, isSigner: false, isWritable: true },
      { pubkey: accounts.serumMarket, isSigner: false, isWritable: false },
      { pubkey: accounts.serumProgramId, isSigner: false, isWritable: false },
      { pubkey: this.wallet, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
      keys,
      programId: this.RAYDIUM_LIQUIDITY_PROGRAM_ID_V4,
      data: Buffer.from(JSON.stringify(dataLayout))
    });
  }
}

// Usage example:
/*
const raydiumTool = new RaydiumAmmV4Tool(
  'https://api.mainnet-beta.solana.com',
  'YOUR_WALLET_PUBLIC_KEY',
  { commitment: 'confirmed' }
);

try {
  const poolCreation = await raydiumTool._call(JSON.stringify({
    marketId: 'MARKET_ID',
    baseAmount: 1000000,
    quoteAmount: 1000000,
    startTime: Math.floor(Date.now() / 1000)
  }));
  console.log(JSON.parse(poolCreation));
} catch (error) {
  console.error('Error creating Raydium pool:', error);
}
*/