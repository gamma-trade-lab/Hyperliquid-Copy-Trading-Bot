import {
    PublicKey,
    SystemProgram,
    TransactionInstruction,
    SYSVAR_RENT_PUBKEY,
  } from '@solana/web3.js';
  import { Buffer } from 'buffer';
  import {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    INSTRUCTION_TYPES,
    MINT_SIZE,
    ACCOUNT_SIZE,
  } from './constants';
  
  export function createInitializeMintInstruction(
    mint: PublicKey,
    decimals: number,
    mintAuthority: PublicKey,
    freezeAuthority: PublicKey | null = null,
  ): TransactionInstruction {
    const keys = [
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];
  
    const data = Buffer.alloc(67);
    data.writeUInt8(INSTRUCTION_TYPES.InitializeMint, 0);
    data.writeUInt8(decimals, 1);
    data.write(mintAuthority.toBuffer().toString('hex'), 2, 34, 'hex');
    data.writeUInt8(freezeAuthority ? 1 : 0, 35);
    if (freezeAuthority) {
      data.write(freezeAuthority.toBuffer().toString('hex'), 36, 67, 'hex');
    }
  
    return new TransactionInstruction({
      keys,
      programId: TOKEN_PROGRAM_ID,
      data,
    });
  }
  
  export function createInitializeAccountInstruction(
    account: PublicKey,
    mint: PublicKey,
    owner: PublicKey,
  ): TransactionInstruction {
    const keys = [
      { pubkey: account, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];
  
    const data = Buffer.alloc(1);
    data.writeUInt8(INSTRUCTION_TYPES.InitializeAccount, 0);
  
    return new TransactionInstruction({
      keys,
      programId: TOKEN_PROGRAM_ID,
      data,
    });
  }
  
  export function createTransferInstruction(
source: PublicKey, destination: PublicKey, owner: PublicKey, amount: number | bigint, p0: any[], TOKEN_PROGRAM_ID: PublicKey,
  ): TransactionInstruction {
    const keys = [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ];
  
    const data = Buffer.alloc(9);
    data.writeUInt8(INSTRUCTION_TYPES.Transfer, 0);
    if (typeof amount === 'number') {
      data.writeBigUInt64LE(BigInt(amount), 1);
    } else {
      data.writeBigUInt64LE(amount, 1);
    }
  
    return new TransactionInstruction({
      keys,
      programId: TOKEN_PROGRAM_ID,
      data,
    });
  }
  
  export function createMintToInstruction(
    mint: PublicKey,
    destination: PublicKey,
    authority: PublicKey,
    amount: number | bigint,
  ): TransactionInstruction {
    const keys = [
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ];
  
    const data = Buffer.alloc(9);
    data.writeUInt8(INSTRUCTION_TYPES.MintTo, 0);
    if (typeof amount === 'number') {
      data.writeBigUInt64LE(BigInt(amount), 1);
    } else {
      data.writeBigUInt64LE(amount, 1);
    }
  
    return new TransactionInstruction({
      keys,
      programId: TOKEN_PROGRAM_ID,
      data,
    });
  }
  
  export function createCloseAccountInstruction(
    account: PublicKey,
    destination: PublicKey,
    owner: PublicKey,
  ): TransactionInstruction {
    const keys = [
      { pubkey: account, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ];
  
    const data = Buffer.alloc(1);
    data.writeUInt8(INSTRUCTION_TYPES.CloseAccount, 0);
  
    return new TransactionInstruction({
      keys,
      programId: TOKEN_PROGRAM_ID,
      data,
    });
  }
  
  export function createAssociatedTokenAccountInstruction(
    payer: PublicKey,
    associatedToken: PublicKey,
    owner: PublicKey,
    mint: PublicKey,
  ): TransactionInstruction {
    const keys = [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedToken, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ];
  
    return new TransactionInstruction({
      keys,
      programId: ASSOCIATED_TOKEN_PROGRAM_ID,
      data: Buffer.alloc(0),
    });
  }
  
  export function createSetAuthorityInstruction(
    account: PublicKey,
    currentAuthority: PublicKey,
    newAuthority: PublicKey | null,
    authorityType: number,
  ): TransactionInstruction {
    const keys = [
      { pubkey: account, isSigner: false, isWritable: true },
      { pubkey: currentAuthority, isSigner: true, isWritable: false },
    ];
  
    const data = Buffer.alloc(newAuthority ? 35 : 2);
    data.writeUInt8(INSTRUCTION_TYPES.SetAuthority, 0);
    data.writeUInt8(authorityType, 1);
    if (newAuthority) {
      data.writeUInt8(1, 2);
      data.write(newAuthority.toBuffer().toString('hex'), 3, 35, 'hex');
    } else {
      data.writeUInt8(0, 2);
    }
  
    return new TransactionInstruction({
      keys,
      programId: TOKEN_PROGRAM_ID,
      data,
    });
  }