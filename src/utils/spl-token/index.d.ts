import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';

declare module "../../utils/spl-token/index.js" {
    import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
    
    export interface TokenAccount {
    mint: PublicKey;
    owner: PublicKey;
    amount: bigint;
    delegate: PublicKey | null;
    delegatedAmount: bigint;
    isInitialized: boolean;
    isFrozen: boolean;
    isNative: boolean;
    closeAuthority: PublicKey | null;
}

export interface MintAccount {
    mintAuthority: PublicKey | null;
    supply: bigint;
    decimals: number;
    isInitialized: boolean;
    freezeAuthority: PublicKey | null;
}

export const TOKEN_PROGRAM_ID: PublicKey;
export const ASSOCIATED_TOKEN_PROGRAM_ID: PublicKey;
export const NATIVE_MINT: PublicKey;
export const AuthorityType: {
    MintTokens: number;
    FreezeAccount: number;
    AccountOwner: number;
    CloseAccount: number;
};
export const ACCOUNT_STATE: {
    UNINITIALIZED: number;
    INITIALIZED: number;
    FROZEN: number;
};

export function getAssociatedTokenAddress(
    mint: PublicKey,
    owner: PublicKey
): Promise<PublicKey>;

export function createMint(
    connection: Connection,
    payer: Keypair,
    mintAuthority: PublicKey,
    freezeAuthority: PublicKey | null,
    decimals: number
): Promise<PublicKey>;

export function createAccount(
    connection: Connection,
    payer: Keypair,
    mint: PublicKey,
    owner: PublicKey,
    skipPreflight?: boolean
): Promise<PublicKey>;

export function createAssociatedTokenAccount(
    connection: Connection,
    payer: Keypair,
    mint: PublicKey,
    owner: PublicKey,
    skipPreflight?: boolean
): Promise<PublicKey>;

export function getAccount(
    connection: Connection,
    address: PublicKey,
    commitment?: "processed" | "confirmed" | "finalized" | "recent" | "single" | "singleGossip" | "root" | "max"
): Promise<TokenAccount>;

export function getMint(
    connection: Connection,
    address: PublicKey
): Promise<MintAccount>;

export function createInitializeMintInstruction(
    mint: PublicKey,
    decimals: number,
    mintAuthority: PublicKey,
    freezeAuthority: PublicKey | null
): Transaction;

export function createInitializeAccountInstruction(
    account: PublicKey,
    mint: PublicKey,
    owner: PublicKey
): Transaction;

export function createTransferInstruction(
    source: PublicKey,
    destination: PublicKey,
    owner: PublicKey,
    amount: bigint,
    multiSigners?: Array<Keypair>,
    programId?: PublicKey
): Transaction;

export function createMintToInstruction(
    mint: PublicKey,
    destination: PublicKey,
    authority: PublicKey,
    amount: number
): Transaction;

export function createCloseAccountInstruction(
    account: PublicKey,
    destination: PublicKey,
    authority: PublicKey
): Transaction;

export function createAssociatedTokenAccountInstruction(
    payer: PublicKey,
    associatedToken: PublicKey,
    owner: PublicKey,
    mint: PublicKey
): Transaction;

export function createSetAuthorityInstruction(
    account: PublicKey,
    currentAuthority: PublicKey,
    authorityType: number,
    newAuthority: PublicKey | null
): Transaction;

export function getOrCreateAssociatedTokenAccount(
    connection: Connection,
    payer: Keypair,
    mint: PublicKey,
    owner: PublicKey,
    allowOwnerOffCurve?: boolean,
    commitment?: "processed" | "confirmed" | "finalized" | "recent" | "single" | "singleGossip" | "root" | "max",
    programId?: PublicKey
): Promise<{
    address: PublicKey;
    account: TokenAccount;
}>;
}
