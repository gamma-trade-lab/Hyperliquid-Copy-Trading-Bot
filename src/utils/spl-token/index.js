import { Transaction } from '@solana/web3.js';
// Import from our custom implementations
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, NATIVE_MINT, AuthorityType, ACCOUNT_STATE } from './constants.js';
import { createInitializeMintInstruction, createInitializeAccountInstruction, createTransferInstruction, createMintToInstruction, createCloseAccountInstruction, createAssociatedTokenAccountInstruction, createSetAuthorityInstruction, getOrCreateAssociatedTokenAccount } from './instructions.js';
import { getAssociatedTokenAddress, createMint, createAccount, createAssociatedTokenAccount, getAccount, getMint } from './accounts.js';
// High-level token operations
export async function mintTo(connection, payer, mint, destination, authority, amount) {
    const instruction = createMintToInstruction(mint, destination, authority.publicKey, amount);
    const transaction = new Transaction().add(instruction);
    return await connection.sendTransaction(transaction, [payer, authority]);
}
export async function transfer(connection, payer, source, destination, owner, amount) {
    const instruction = createTransferInstruction(source, destination, owner.publicKey, amount, [], // p0 argument
    TOKEN_PROGRAM_ID // TOKEN_PROGRAM_ID argument
    );
    const transaction = new Transaction().add(instruction);
    return await connection.sendTransaction(transaction, [payer, owner]);
}
// Export all essential types and functions
export { 
// Constants
TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, NATIVE_MINT, AuthorityType, ACCOUNT_STATE, 
// Account Functions
getAssociatedTokenAddress, createMint, createAccount, createAssociatedTokenAccount, getOrCreateAssociatedTokenAccount, getAccount, getMint, 
// Instructions
createInitializeMintInstruction, createInitializeAccountInstruction, createTransferInstruction, createMintToInstruction, createCloseAccountInstruction, createAssociatedTokenAccountInstruction, createSetAuthorityInstruction, };
// Default export for convenience
export default {
    // Program IDs
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    NATIVE_MINT,
    // Core functionality
    createMint,
    createAccount,
    createAssociatedTokenAccount,
    getAssociatedTokenAddress,
    transfer,
    mintTo,
    getAccount,
    getMint,
    // Types for type checking
    AuthorityType,
    ACCOUNT_STATE,
};
