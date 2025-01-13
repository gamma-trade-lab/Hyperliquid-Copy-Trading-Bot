import { PublicKey, Keypair, Transaction, SystemProgram, sendAndConfirmTransaction, } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, MINT_SIZE, ACCOUNT_SIZE, ERROR_MESSAGES, ACCOUNT_STATE } from './constants.js';
import { createInitializeAccountInstruction, createAssociatedTokenAccountInstruction, createInitializeMintInstruction, } from './instructions.js';
export async function getAssociatedTokenAddress(mint, owner) {
    const [address] = await PublicKey.findProgramAddress([owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()], ASSOCIATED_TOKEN_PROGRAM_ID);
    return address;
}
export async function createMint(connection, payer, mintAuthority, freezeAuthority, decimals) {
    const mintAccount = Keypair.generate();
    const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    const transaction = new Transaction().add(SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mintAccount.publicKey,
        lamports,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
    }), createInitializeMintInstruction(mintAccount.publicKey, decimals, mintAuthority, freezeAuthority));
    await sendAndConfirmTransaction(connection, transaction, [payer, mintAccount]);
    return mintAccount.publicKey;
}
export async function createAccount(connection, payer, mint, owner, skipPreflight = false) {
    const account = Keypair.generate();
    const lamports = await connection.getMinimumBalanceForRentExemption(ACCOUNT_SIZE);
    const transaction = new Transaction().add(SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: account.publicKey,
        lamports,
        space: ACCOUNT_SIZE,
        programId: TOKEN_PROGRAM_ID,
    }), createInitializeAccountInstruction(account.publicKey, mint, owner));
    await sendAndConfirmTransaction(connection, transaction, [payer, account], { skipPreflight });
    return account.publicKey;
}
export async function createAssociatedTokenAccount(connection, payer, mint, owner, skipPreflight = false) {
    const associatedToken = await getAssociatedTokenAddress(mint, owner);
    const transaction = new Transaction().add(createAssociatedTokenAccountInstruction(payer.publicKey, associatedToken, owner, mint));
    await sendAndConfirmTransaction(connection, transaction, [payer], { skipPreflight });
    return associatedToken;
}
export async function getAccount(connection, address, commitment) {
    const info = await connection.getAccountInfo(address, commitment);
    if (!info)
        throw new Error(ERROR_MESSAGES.INVALID_ACCOUNT);
    if (!info.owner.equals(TOKEN_PROGRAM_ID))
        throw new Error(ERROR_MESSAGES.INVALID_ACCOUNT);
    if (info.data.length !== ACCOUNT_SIZE)
        throw new Error(ERROR_MESSAGES.INVALID_ACCOUNT);
    const data = Buffer.from(info.data);
    const mint = new PublicKey(data.slice(0, 32));
    const owner = new PublicKey(data.slice(32, 64));
    const amount = data.readBigUInt64LE(64);
    const delegateOption = data[72];
    const delegate = delegateOption === 0 ? null : new PublicKey(data.slice(76, 108));
    const state = data[108];
    const isNativeOption = data[109];
    const isNative = isNativeOption > 0;
    const delegatedAmount = data.readBigUInt64LE(118);
    const closeAuthorityOption = data[126];
    const closeAuthority = closeAuthorityOption === 0 ? null : new PublicKey(data.slice(130));
    return {
        mint,
        owner,
        amount,
        delegate,
        delegatedAmount,
        isInitialized: state !== ACCOUNT_STATE.UNINITIALIZED,
        isFrozen: state === ACCOUNT_STATE.FROZEN,
        isNative,
        closeAuthority,
    };
}
export async function getMint(connection, address) {
    const info = await connection.getAccountInfo(address);
    if (!info)
        throw new Error(ERROR_MESSAGES.INVALID_MINT);
    if (!info.owner.equals(TOKEN_PROGRAM_ID))
        throw new Error(ERROR_MESSAGES.INVALID_MINT);
    if (info.data.length !== MINT_SIZE)
        throw new Error(ERROR_MESSAGES.INVALID_MINT);
    const data = Buffer.from(info.data);
    const mintAuthorityOption = data[0];
    const mintAuthority = mintAuthorityOption === 0 ? null : new PublicKey(data.slice(4, 36));
    const supply = data.readBigUInt64LE(40);
    const decimals = data[48];
    const isInitialized = data[49] === 1;
    const freezeAuthorityOption = data[50];
    const freezeAuthority = freezeAuthorityOption === 0 ? null : new PublicKey(data.slice(54));
    return {
        mintAuthority,
        supply,
        decimals,
        isInitialized,
        freezeAuthority,
    };
}
