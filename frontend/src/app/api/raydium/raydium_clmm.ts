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
import { Decimal } from "decimal.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

interface RaydiumClmmAccounts {
  poolId: PublicKey;
  poolAuthority: PublicKey;
  mint1: PublicKey;
  mint2: PublicKey;
  poolVault1: PublicKey;
  poolVault2: PublicKey;
  observationState: PublicKey;
  configAccount: PublicKey;
}

export class RaydiumClmmTool extends Tool {
  name = "raydium_create_clmm";
  description = `Concentrated liquidity market maker, custom liquidity ranges, increased capital efficiency

  Inputs (input is a json string):
  mint1: string (required)
  mint2: string (required)
  configId: string (required) stores pool info, id, index, protocolFeeRate, tradeFeeRate, tickSpacing, fundFeeRate
  initialPrice: number, eg: 123.12 (required)
  startTime: number(seconds), eg: now number or zero (required)
  `;

  private connection: Connection;
  private wallet: PublicKey;
  
  // Raydium program IDs
  private readonly RAYDIUM_CLMM_PROGRAM_ID = new PublicKey(
    "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK"
  );

  constructor(
    rpcUrl: string,
    walletPublicKey: string,
    private options: {
      commitment?: Commitment; // Change the type to Commitment
    } = {}
  ) {
    super();
    this.connection = new Connection(rpcUrl, this.options.commitment || 'confirmed');
    this.wallet = new PublicKey(walletPublicKey);
  }

  protected async _call(input: string): Promise<string> {
    try {
      const {
        mint1,
        mint2,
        configId,
        initialPrice,
        startTime
      } = JSON.parse(input);

      // Input validation
      if (!mint1 || !mint2) throw new Error('Both mint addresses are required');
      if (!configId) throw new Error('Config ID is required');
      if (!initialPrice || isNaN(initialPrice)) throw new Error('Valid initial price is required');
      if (startTime === undefined) throw new Error('Start time is required');

      // Convert inputs to appropriate types
      const mint1PubKey = new PublicKey(mint1);
      const mint2PubKey = new PublicKey(mint2);
      const configPubKey = new PublicKey(configId);
      const priceDecimal = new Decimal(initialPrice);
      const startTimeBN = new BN(startTime);

      // Generate necessary PDAs and accounts
      const accounts = await this.generateClmmAccounts({
        mint1: mint1PubKey,
        mint2: mint2PubKey,
        configId: configPubKey
      });
      
      // Create CLMM initialization instruction
      const initClmmIx = await this.createInitClmmInstruction(
        accounts,
        priceDecimal,
        startTimeBN
      );

      // Create and return transaction
      const transaction = new Transaction().add(initClmmIx);
      
      // Get latest blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.wallet;

      return JSON.stringify({
        status: "success",
        message: "Raydium CLMM pool initialization prepared successfully",
        transaction: {
          serializedTransaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
          accounts: {
            poolId: accounts.poolId.toBase58(),
            poolVault1: accounts.poolVault1.toBase58(),
            poolVault2: accounts.poolVault2.toBase58(),
            observationState: accounts.observationState.toBase58()
          }
        }
      });

    } catch (error) {
      const err = error as Error & { code?: string };
      return JSON.stringify({
        status: "error",
        message: err.message,
        code: err.code || "TRANSACTION_CREATION_ERROR",
      });
    }
  }

  private async generateClmmAccounts({
    mint1,
    mint2,
    configId
  }: {
    mint1: PublicKey;
    mint2: PublicKey;
    configId: PublicKey;
  }): Promise<RaydiumClmmAccounts> {
    // Sort token mints to ensure consistent pool address derivation
    const [tokenX, tokenY] = mint1.toBuffer().compare(mint2.toBuffer()) < 0 
      ? [mint1, mint2] 
      : [mint2, mint1];

    // Generate pool seed
    const poolSeed = Buffer.concat([
      tokenX.toBuffer(),
      tokenY.toBuffer(),
      configId.toBuffer()
    ]);
    
    // Derive PDAs
    const [poolId] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), poolSeed],
      this.RAYDIUM_CLMM_PROGRAM_ID
    );

    const [poolAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("authority"), poolId.toBuffer()],
      this.RAYDIUM_CLMM_PROGRAM_ID
    );

    const [poolVault1] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), poolId.toBuffer(), mint1.toBuffer()],
      this.RAYDIUM_CLMM_PROGRAM_ID
    );

    const [poolVault2] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), poolId.toBuffer(), mint2.toBuffer()],
      this.RAYDIUM_CLMM_PROGRAM_ID
    );

    const [observationState] = PublicKey.findProgramAddressSync(
      [Buffer.from("observation"), poolId.toBuffer()],
      this.RAYDIUM_CLMM_PROGRAM_ID
    );

    return {
      poolId,
      poolAuthority,
      mint1,
      mint2,
      poolVault1,
      poolVault2,
      observationState,
      configAccount: configId
    };
  }

  private async createInitClmmInstruction(
    accounts: RaydiumClmmAccounts,
    initialPrice: Decimal,
    startTime: BN
  ): Promise<TransactionInstruction> {
    const sqrtPrice = initialPrice.sqrt().mul(new Decimal(2).pow(64));
    
    const dataLayout = {
      sqrtPriceX64: new BN(sqrtPrice.floor().toString()),
      startTime
    };

    const keys = [
      { pubkey: accounts.poolId, isSigner: false, isWritable: true },
      { pubkey: accounts.poolAuthority, isSigner: false, isWritable: false },
      { pubkey: accounts.configAccount, isSigner: false, isWritable: false },
      { pubkey: accounts.mint1, isSigner: false, isWritable: false },
      { pubkey: accounts.mint2, isSigner: false, isWritable: false },
      { pubkey: accounts.poolVault1, isSigner: false, isWritable: true },
      { pubkey: accounts.poolVault2, isSigner: false, isWritable: true },
      { pubkey: accounts.observationState, isSigner: false, isWritable: true },
      { pubkey: this.wallet, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
      keys,
      programId: this.RAYDIUM_CLMM_PROGRAM_ID,
      data: Buffer.from(JSON.stringify(dataLayout))
    });
  }
}

// Usage example:
/*
const raydiumTool = new RaydiumClmmTool(
  'https://api.mainnet-beta.solana.com',
  'YOUR_WALLET_PUBLIC_KEY',
  { commitment: 'confirmed' }
);

try {
  const poolCreation = await raydiumTool._call(JSON.stringify({
    mint1: 'MINT1_ADDRESS',
    mint2: 'MINT2_ADDRESS',
    configId: 'CONFIG_ID',
    initialPrice: 123.45,
    startTime: Math.floor(Date.now() / 1000)
  }));
  console.log(JSON.parse(poolCreation));
} catch (error) {
  console.error('Error creating Raydium CLMM pool:', error);
}
*/