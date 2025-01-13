import { getAccount, getAssociatedTokenAddress } from "../../src/utils/spl-token";
import { PublicKey } from "@solana/web3.js";
export async function getTokenPriceInSol(tokenSymbol) {
    const response = await fetch(`https://price.jup.ag/v6/price?ids=${tokenSymbol}`);
    const data = await response.json();
    return data.data[tokenSymbol].price;
}
async function getTokenBalance(connection, walletPublicKey, tokenMintAddress) {
    const tokenAccountAddress = await getAssociatedTokenAddress(tokenMintAddress, walletPublicKey);
    try {
        const tokenAccount = await getAccount(connection, tokenAccountAddress, "confirmed");
        const tokenAmount = tokenAccount.amount;
        return tokenAmount;
    }
    catch (error) {
        console.error(`Error retrieving balance for token: ${tokenMintAddress.toBase58()}`, error);
        return 0;
    }
}
async function getTokenBalances(connection, walletPublicKey) {
    const tokenBalances = {};
    // Add the token mint addresses you want to retrieve balances for
    const tokenMintAddresses = [
        new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // USDC
        new PublicKey("So11111111111111111111111111111111111111112"), // SOL
        // Add more token mint addresses as needed
    ];
    for (const mintAddress of tokenMintAddresses) {
        const tokenName = getTokenName(mintAddress);
        const balance = await getTokenBalance(connection, walletPublicKey, mintAddress);
        tokenBalances[tokenName] = balance;
    }
    return tokenBalances;
}
function getTokenName(mintAddress) {
    // Implement a mapping of mint addresses to token names
    const tokenNameMap = {
        EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: "USDC",
        So11111111111111111111111111111111111111112: "SOL",
        // Add more token mint addresses and their corresponding names
    };
    return tokenNameMap[mintAddress.toBase58()] || "Unknown Token";
}
export { getTokenBalance, getTokenBalances };
