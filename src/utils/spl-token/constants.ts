import { PublicKey } from '@solana/web3.js';

// Program IDs
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
export const NATIVE_MINT = new PublicKey('So11111111111111111111111111111111111111112');

// Account sizes
export const MINT_SIZE = 82;
export const ACCOUNT_SIZE = 165;

// Maximum number of token decimals
export const MAX_DECIMALS = 9;

// Minimum balances
export const MINT_RENT_EXEMPT_LAMPORTS = 1461600; // Approximate, should be fetched from connection
export const ACCOUNT_RENT_EXEMPT_LAMPORTS = 2039280; // Approximate, should be fetched from connection

// Authority types
export const AuthorityType = {
  MintTokens: 0,
  FreezeAccount: 1,
  AccountOwner: 2,
  CloseAccount: 3,
} as const;

// State sizes
export const STATE_SIZE = {
  ACCOUNT_STATE: 1,
  MINT_AUTHORITY: 36,
  SUPPLY: 8,
  DECIMALS: 1,
  IS_INITIALIZED: 1,
  FREEZE_AUTHORITY: 36,
  DELEGATION: 36,
  CLOSE_AUTHORITY: 36,
  AMOUNT: 8,
} as const;

// Layout keys
export const LAYOUT_KEYS = {
  MINT: {
    mintAuthorityOption: 0,
    mintAuthority: 4,
    supply: 40,
    decimals: 48,
    isInitialized: 49,
    freezeAuthorityOption: 50,
    freezeAuthority: 54,
  },
  ACCOUNT: {
    mint: 0,
    owner: 32,
    amount: 64,
    delegateOption: 72,
    delegate: 76,
    state: 108,
    isNativeOption: 109,
    isNative: 110,
    delegatedAmount: 118,
    closeAuthorityOption: 126,
    closeAuthority: 130,
  },
} as const;

// Error messages
export const ERROR_MESSAGES = {
  INVALID_MINT: 'Invalid mint',
  INVALID_ACCOUNT: 'Invalid account',
  INVALID_OWNER: 'Invalid owner',
  INVALID_DECIMALS: 'Invalid decimals',
  INVALID_AMOUNT: 'Invalid amount',
  INSUFFICIENT_FUNDS: 'Insufficient funds',
  ACCOUNT_NOT_INITIALIZED: 'Account not initialized',
  MINT_MISMATCH: 'Mint mismatch',
  AUTHORITY_MISMATCH: 'Authority mismatch',
} as const;

// Instruction discriminators
export const INSTRUCTION_TYPES = {
  InitializeMint: 0,
  InitializeAccount: 1,
  Transfer: 3,
  MintTo: 7,
  Burn: 8,
  CloseAccount: 9,
  SetAuthority: 6,
} as const;

// Token account states
export const ACCOUNT_STATE = {
  UNINITIALIZED: 0,
  INITIALIZED: 1,
  FROZEN: 2,
} as const;

// Export type definitions
export type AuthorityTypeValues = typeof AuthorityType[keyof typeof AuthorityType];
export type AccountStateValues = typeof ACCOUNT_STATE[keyof typeof ACCOUNT_STATE];
export type InstructionTypeValues = typeof INSTRUCTION_TYPES[keyof typeof INSTRUCTION_TYPES];