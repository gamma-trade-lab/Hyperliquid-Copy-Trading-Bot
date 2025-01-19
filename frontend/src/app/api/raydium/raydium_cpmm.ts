import { Tool } from "langchain/tools";
import { 
  Connection, 
  PublicKey, 
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

interface RaydiumCpmmAccounts {
  poolId: PublicKey;
  poolAuthority: PublicKey;
  mint1: PublicKey;
  mint2: PublicKey;
  poolVault1: PublicKey;
  poolVault2: PublicKey;
  lpMint: PublicKey;
  poolConfigAccount: PublicKey;
  tokenProgram1: PublicKey;
  tokenProgram2: PublicKey;
}

export class RaydiumCpmmTool extends Tool {
  name = "raydium_create_cpmm";
  description = `Raydium's newest CPMM, does not require marketID, supports Token 2022 standard

  Inputs (input is a json string):
  mint1: string (required)
  mint2: string (required)
  configId: string (required), stores pool info, index, protocolFeeRate, tradeFeeRate, fundFeeRate, createPoolFee
  mintAAmount: number(int), eg: 1111 (required)
  mintBAmount: number(int), eg: 2222 (required)
  startTime: number(seconds), eg: now number or zero (required)
  `;

  private connection: Connection;
  private wallet: PublicKey;
  
  // Raydium program IDs
  private readonly RAYDIUM_CPMM_PROGRAM_ID = new PublicKey(
    "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK"
  );

  constructor(
    rpcUrl: string,
    walletPublicKey: string,
    private options: {
      commitment?: "processed" | "confirmed" | "finalized";
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
        mintAAmount,
        mintBAmount,
        startTime
      } = JSON.parse(input);

      // Input validation
      if (!mint1 || !mint2) throw new Error('Both mint addresses are required');
      if (!configId) throw new Error('Config ID is required');
      if (!mintAAmount || mintAAmount <= 0) throw new Error('Valid mint A amount is required');
      if (!mintBAmount || mintBAmount <= 0) throw new Error('Valid mint B amount is required');
      if (startTime === undefined) throw new Error('Start time is required');

      // Convert inputs to appropriate types
      const mint1PubKey = new PublicKey(mint1);
      const mint2PubKey = new PublicKey(mint2);
      const configPubKey = new PublicKey(configId);

      // Check if mints are Token2022
      const [isToken2022_1, isToken2022_2] = await Promise.all([
        this.isToken2022(mint1PubKey),
        this.isToken2022(mint2PubKey)
      ]);

      // Generate necessary PDAs and accounts
      const accounts = await this.generateCpmmAccounts({
        mint1: mint1PubKey,
        mint2: mint2PubKey,
        configId: configPubKey,
        isToken2022_1,
        isToken2022_2
      });
      
      // Create CPMM initialization instruction
      const initCpmmIx = await this.createInitCpmmInstruction(
        accounts,
        new BN(mintAAmount),
        new BN(mintBAmount),
        new BN(startTime)
      );

      // Create and return transaction
      const transaction = new Transaction().add(initCpmmIx);
      
      // Get latest blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.wallet;

      return JSON.stringify({
        status: "success",
        message: "Raydium CPMM pool initialization prepared successfully",
        transaction: {
          serializedTransaction: transaction.serialize({ requireAllSignatures: false }).toString('base64'),
          accounts: {
            poolId: accounts.poolId.toBase58(),
            lpMint: accounts.lpMint.toBase58(),
            poolVault1: accounts.poolVault1.toBase58(),
            poolVault2: accounts.poolVault2.toBase58()
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

  private async isToken2022(mintAddress: PublicKey): Promise<boolean> {
    const accountInfo = await this.connection.getAccountInfo(mintAddress);
    if (!accountInfo) throw new Error(`Mint address ${mintAddress.toString()} not found`);
    return accountInfo.owner.equals(TOKEN_2022_PROGRAM_ID);
  }

  private async generateCpmmAccounts({
    mint1,
    mint2,
    configId,
    isToken2022_1,
    isToken2022_2
  }: {
    mint1: PublicKey;
    mint2: PublicKey;
    configId: PublicKey;
    isToken2022_1: boolean;
    isToken2022_2: boolean;
  }): Promise<RaydiumCpmmAccounts> {
    // Sort token mints to ensure consistent pool address derivation
    const [tokenX, tokenY] = mint1.toBuffer().compare(mint2.toBuffer()) < 0 
      ? [mint1, mint2] 
      : [mint2, mint1];

    // Sort token program IDs accordingly
    const [tokenProgramX, tokenProgramY] = mint1.toBuffer().compare(mint2.toBuffer()) < 0
      ? [isToken2022_1 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID, 
         isToken2022_2 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID]
      : [isToken2022_2 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
         isToken2022_1 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID];

    // Generate pool seed
    const poolSeed = Buffer.concat([
      tokenX.toBuffer(),
      tokenY.toBuffer(),
      configId.toBuffer()
    ]);
    
    // Derive PDAs
    const [poolId] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_seed"), poolSeed],
      this.RAYDIUM_CPMM_PROGRAM_ID
    );

    const [poolAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_authority"), poolId.toBuffer()],
      this.RAYDIUM_CPMM_PROGRAM_ID
    );

    const [lpMint] = PublicKey.findProgramAddressSync(
      [Buffer.from("lp_mint"), poolId.toBuffer()],
      this.RAYDIUM_CPMM_PROGRAM_ID
    );

    const [poolVault1] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_vault_1"), poolId.toBuffer(), tokenX.toBuffer()],
      this.RAYDIUM_CPMM_PROGRAM_ID
    );

    const [poolVault2] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_vault_2"), poolId.toBuffer(), tokenY.toBuffer()],
      this.RAYDIUM_CPMM_PROGRAM_ID
    );

    return {
      poolId,
      poolAuthority,
      mint1: tokenX,
      mint2: tokenY,
      poolVault1,
      poolVault2,
      lpMint,
      poolConfigAccount: configId,
      tokenProgram1: tokenProgramX,
      tokenProgram2: tokenProgramY
    };
  }

  private async createInitCpmmInstruction(
    accounts: RaydiumCpmmAccounts,
    mintAAmount: BN,
    mintBAmount: BN,
    startTime: BN
  ): Promise<TransactionInstruction> {
    const dataLayout = {
      mintAAmount,
      mintBAmount,
      startTime,
    };

    const keys = [
      { pubkey: accounts.poolId, isSigner: false, isWritable: true },
      { pubkey: accounts.poolAuthority, isSigner: false, isWritable: false },
      { pubkey: accounts.poolConfigAccount, isSigner: false, isWritable: false },
      { pubkey: accounts.lpMint, isSigner: false, isWritable: true },
      { pubkey: accounts.mint1, isSigner: false, isWritable: false },
      { pubkey: accounts.mint2, isSigner: false, isWritable: false },
      { pubkey: accounts.poolVault1, isSigner: false, isWritable: true },
      { pubkey: accounts.poolVault2, isSigner: false, isWritable: true },
      { pubkey: this.wallet, isSigner: true, isWritable: true },
      { pubkey: accounts.tokenProgram1, isSigner: false, isWritable: false },
      { pubkey: accounts.tokenProgram2, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
      keys,
      programId: this.RAYDIUM_CPMM_PROGRAM_ID,
      data: Buffer.from(JSON.stringify(dataLayout))
    });
  }
}