// src/services/blockchain/token.ts

import { 
    Connection, 
    PublicKey, 
    Transaction, 
    sendAndConfirmTransaction,
    Keypair 
  } from '@solana/web3.js';
  import { 
    Token, 
    TOKEN_PROGRAM_ID, 
    MintLayout,
    AccountLayout 
  } from '@solana/spl-token';
  import { 
    CreateMetadataAccountV3InstructionData,
    PROGRAM_ID as METADATA_PROGRAM_ID
  } from '@metaplex-foundation/mpl-token-metadata';
  
  interface TokenConfig {
    connection: Connection;
    payer: Keypair;
    mintAuthority: PublicKey;
    freezeAuthority?: PublicKey;
  }
  
  interface TokenMetadata {
    name: string;
    symbol: string;
    uri: string;
    decimals: number;
    sellerFeeBasisPoints?: number;
    price?: number; // Add price property
    marketCap?: number; // Add marketCap property
    volume24h?: number; // Add volume24h property
  }
  
  export class TokenService {
    private connection: Connection;
    private payer: Keypair;
    private mintAuthority: PublicKey;
    private freezeAuthority?: PublicKey;
  
    constructor(config: TokenConfig) {
      this.connection = config.connection;
      this.payer = config.payer;
      this.mintAuthority = config.mintAuthority;
      this.freezeAuthority = config.freezeAuthority;
    }
  
    async createToken(
      metadata: TokenMetadata,
      initialSupply: number
    ): Promise<{ mint: PublicKey; tx: string }> {
      try {
        // Create mint account
        const mintAccount = Keypair.generate();
        const lamports = await Token.getMinBalanceRentForExemptMint(this.connection);
  
        const transaction = new Transaction().add(
          // Create mint account
          Token.createInitMintInstruction(
            TOKEN_PROGRAM_ID,
            mintAccount.publicKey,
            metadata.decimals,
            this.mintAuthority,
            this.freezeAuthority
          )
        );
  
        // Add metadata instruction
        const metadataInstruction = createCreateMetadataAccountV3InstructionData(
          {
            metadata: PublicKey.findProgramAddressSync(
              [
                Buffer.from('metadata'),
                METADATA_PROGRAM_ID.toBuffer(),
                mintAccount.publicKey.toBuffer()
              ],
              METADATA_PROGRAM_ID
            )[0],
            mint: mintAccount.publicKey,
            mintAuthority: this.mintAuthority,
            payer: this.payer.publicKey,
            updateAuthority: this.mintAuthority,
          },
          {
            createMetadataAccountArgsV3: {
              data: {
                name: metadata.name,
                symbol: metadata.symbol,
                uri: metadata.uri,
                sellerFeeBasisPoints: metadata.sellerFeeBasisPoints || 0,
                creators: null,
                collection: null,
                uses: null,
              },
              isMutable: true,
              collectionDetails: null,
            },
          }
        );
  
        transaction.add(metadataInstruction);
  
        // If initial supply is specified, create and mint to ATA
        if (initialSupply > 0) {
          const destAccount = await Token.getAssociatedTokenAddress(
            mintAccount.publicKey,
            this.mintAuthority
          );
  
          transaction.add(
            Token.createAssociatedTokenAccountInstruction(
              mintAccount.publicKey,
              destAccount,
              this.mintAuthority,
              this.payer.publicKey
            ),
            Token.createMintToInstruction(
              TOKEN_PROGRAM_ID,
              mintAccount.publicKey,
              destAccount,
              this.mintAuthority,
              [],
              initialSupply * Math.pow(10, metadata.decimals)
            )
          );
        }
  
        const signature = await sendAndConfirmTransaction(
          this.connection,
          transaction,
          [this.payer, mintAccount]
        );
  
        return {
          mint: mintAccount.publicKey,
          tx: signature
        };
      } catch (error) {
        console.error('Error creating token:', error);
        throw error;
      }
    }
  
    async airdropTokens(
      mint: PublicKey,
      recipients: { address: string; amount: number }[]
    ): Promise<string[]> {
      try {
        const transactions: Transaction[] = [];
        const signatures: string[] = [];
  
        // Process recipients in batches of 10
        const batchSize = 10;
        for (let i = 0; i < recipients.length; i += batchSize) {
          const batch = recipients.slice(i, i + batchSize);
          const transaction = new Transaction();
  
          for (const recipient of batch) {
            const destPubkey = new PublicKey(recipient.address);
            const destAta = await Token.getAssociatedTokenAddress(
              mint,
              destPubkey
            );
  
            // Check if account exists
            const accountInfo = await this.connection.getAccountInfo(destAta);
            if (!accountInfo) {
              transaction.add(
                Token.createAssociatedTokenAccountInstruction(
                  mint,
                  destAta,
                  destPubkey,
                  this.payer.publicKey
                )
              );
            }
  
            // Add mint instruction
            transaction.add(
              Token.createMintToInstruction(
                TOKEN_PROGRAM_ID,
                mint,
                destAta,
                this.mintAuthority,
                [],
                recipient.amount
              )
            );
          }
  
          const signature = await sendAndConfirmTransaction(
            this.connection,
            transaction,
            [this.payer]
          );
          signatures.push(signature);
        }
  
        return signatures;
      } catch (error) {
        console.error('Error airdropping tokens:', error);
        throw error;
      }
    }
  
    async updateTokenMetadata(
      mint: PublicKey,
      metadata: Partial<TokenMetadata>
    ): Promise<string> {
      // Implement metadata update logic
      return 'tx_signature';
    }
  
    async getTokenInfo(mint: PublicKey): Promise<{
      supply: number;
      decimals: number;
      metadata?: TokenMetadata;
    }> {
      try {
        const mintInfo = await this.connection.getAccountInfo(mint);
        if (!mintInfo) {
          throw new Error('Token mint not found');
        }
  
        const data = MintLayout.decode(mintInfo.data);
        
        // Get metadata if it exists
        const [metadataAddress] = PublicKey.findProgramAddressSync(
          [
            Buffer.from('metadata'),
            METADATA_PROGRAM_ID.toBuffer(),
            mint.toBuffer()
          ],
          METADATA_PROGRAM_ID
        );
  
        const metadataInfo = await this.connection.getAccountInfo(metadataAddress);
        
        return {
          supply: Number(data.supply),
          decimals: data.decimals,
          metadata: metadataInfo ? this.decodeMetadata(metadataInfo.data) : undefined
        };
      } catch (error) {
        console.error('Error getting token info:', error);
        throw error;
      }
    }
  
    async burnTokens(
      mint: PublicKey,
      owner: PublicKey,
      amount: number
    ): Promise<string> {
      try {
        const tokenAccount = await Token.getAssociatedTokenAddress(
          mint,
          owner
        );
  
        const transaction = new Transaction().add(
          Token.createBurnInstruction(
            TOKEN_PROGRAM_ID,
            mint,
            tokenAccount,
            owner,
            [],
            amount
          )
        );
  
        return await sendAndConfirmTransaction(
          this.connection,
          transaction,
          [this.payer]
        );
      } catch (error) {
        console.error('Error burning tokens:', error);
        throw error;
      }
    }
  
    private decodeMetadata(data: Buffer): TokenMetadata {
      // Implement metadata decoding
      return {
        name: '',
        symbol: '',
        uri: '',
        decimals: 0
      };
    }
  }