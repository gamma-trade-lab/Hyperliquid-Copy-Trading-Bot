
import {
    BlockhashWithExpiryBlockHeight,
    Connection,
    Keypair,
    PublicKey,
    RpcResponseAndContext,
    SimulatedTransactionResponse,
    TokenAmount,
    VersionedTransaction,
} from "@solana/web3.js";
import { settings } from "@elizaos/core";
import { getAssociatedTokenAddress } from "@/utils/spl-token";

const solAddress = settings.SOL_ADDRESS;
const SLIPPAGE = settings.SLIPPAGE;
const connection = new Connection(
    settings.RPC_URL || "https://api.mainnet-beta.solana.com"
);
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function delayedCall<T>(
    method: (...args: any[]) => Promise<T>,
    ...args: any[]
): Promise<T> {
    await delay(150);
    return method(...args);
}

export async function getTokenDecimals(
    connection: Connection,
    mintAddress: string
): Promise<number> {
    const mintPublicKey = new PublicKey(mintAddress);
    const tokenAccountInfo =
        await connection.getParsedAccountInfo(mintPublicKey);

    // Check if the data is parsed and contains the expected structure
    if (
        tokenAccountInfo.value &&
        typeof tokenAccountInfo.value.data === "object" &&
        "parsed" in tokenAccountInfo.value.data
    ) {
        const parsedInfo = tokenAccountInfo.value.data.parsed?.info;
        if (parsedInfo && typeof parsedInfo.decimals === "number") {
            return parsedInfo.decimals;
        }
    }

    throw new Error("Unable to fetch token decimals");
}

export interface QuoteData {
    inputMint: string;
    outputMint: string;
    amount: string;
    otherAmountThreshold: string;
    swapMode: string;
    slippageBps: number;
    platformFee: number;
    priceImpactPct: number;
    routePlan: Array<{
        swapInfo: any;
        percent: number;
    }>;
}

export async function getQuote(
    connection: Connection,
    baseToken: string,
    outputToken: string,
    amount: number
): Promise<QuoteData | null> {
    try {
        const decimals = await getTokenDecimals(connection, baseToken);
        const adjustedAmount = amount * 10 ** decimals;

        const quoteResponse = await fetch(
            `https://quote-api.jup.ag/v6/quote?inputMint=${baseToken}&outputMint=${outputToken}&amount=${adjustedAmount}&slippageBps=50`
        );
        const response = await quoteResponse.json() as QuoteData;
        if (!response) {
            console.log("Failed to get quote data");
            return null;
        }
        return response;
    } catch (error) {
        console.error("Get quote error:", error);
        return null;
    }
}

export const executeSwap = async (
    transaction: VersionedTransaction,
    type: "buy" | "sell"
): Promise<string | null> => {
    try {
        const latestBlockhash: BlockhashWithExpiryBlockHeight =
            await delayedCall(connection.getLatestBlockhash.bind(connection));
        const signature = await connection.sendTransaction(transaction, {
            skipPreflight: false,
        });
        const confirmation = await connection.confirmTransaction(
            {
                signature,
                lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
                blockhash: latestBlockhash.blockhash,
            },
            "finalized"
        );
        if (confirmation.value.err) {
            console.log("Confirmation error", confirmation.value.err);
            return null;
        }
        
        if (type === "buy") {
            console.log(
                `Buy successful: https://solscan.io/tx/${signature}`
            );
        } else {
            console.log(
                `Sell successful: https://solscan.io/tx/${signature}`
            );
        }

        return signature;
    } catch (error) {
        console.error("Execute swap error:", error);
        return null;
    }
};

export const Sell = async (baseMint: PublicKey, wallet: Keypair): Promise<string | null> => {
    try {
        const tokenAta = await delayedCall(
            getAssociatedTokenAddress,
            baseMint,
            wallet.publicKey
        );
        const tokenBalInfo: RpcResponseAndContext<TokenAmount> =
            await delayedCall(
                connection.getTokenAccountBalance.bind(connection),
                tokenAta
            );

        if (!tokenBalInfo) {
            console.log("Balance incorrect");
            return null;
        }

        const tokenBalance = tokenBalInfo.value.amount;
        if (tokenBalance === "0") {
            console.warn(
                `No token balance to sell with wallet ${wallet.publicKey}`
            );
            return null;
        }

        const sellTransaction = await getSwapTxWithWithJupiter(
            wallet,
            baseMint,
            tokenBalance,
            "sell"
        );
        // simulate the transaction
        if (!sellTransaction) {
            console.log("Failed to get sell transaction");
            return null;
        }

        const simulateResult: RpcResponseAndContext<SimulatedTransactionResponse> =
            await delayedCall(
                connection.simulateTransaction.bind(connection),
                sellTransaction
            );
        if (simulateResult.value.err) {
            console.log("Sell Simulation failed", simulateResult.value.err);
            return null;
        }

        // execute the transaction
        return executeSwap(sellTransaction, "sell");
    } catch (error) {
        console.error("Sell error:", error);
        return null;
    }
};

export const Buy = async (baseMint: PublicKey, wallet: Keypair): Promise<string | null> => {
    try {
        const tokenAta = await delayedCall(
            getAssociatedTokenAddress,
            baseMint,
            wallet.publicKey
        );
        const tokenBalInfo: RpcResponseAndContext<TokenAmount> =
            await delayedCall(
                connection.getTokenAccountBalance.bind(connection),
                tokenAta
            );

        if (!tokenBalInfo) {
            console.log("Balance incorrect");
            return null;
        }

        const tokenBalance = tokenBalInfo.value.amount;
        if (tokenBalance === "0") {
            console.warn(
                `No token balance to buy with wallet ${wallet.publicKey}`
            );
            return null;
        }

        const buyTransaction = await getSwapTxWithWithJupiter(
            wallet,
            baseMint,
            tokenBalance,
            "buy"
        );
        // simulate the transaction
        if (!buyTransaction) {
            console.log("Failed to get buy transaction");
            return null;
        }

        const simulateResult: RpcResponseAndContext<SimulatedTransactionResponse> =
            await delayedCall(
                connection.simulateTransaction.bind(connection),
                buyTransaction
            );
        if (simulateResult.value.err) {
            console.log("Buy Simulation failed", simulateResult.value.err);
            return null;
        }

        // execute the transaction
        return executeSwap(buyTransaction, "buy");
    } catch (error) {
        console.error("Buy error:", error);
        return null;
    }
};

export const getSwapTxWithWithJupiter = async (
    wallet: Keypair,
    baseMint: PublicKey,
    amount: string,
    type: "buy" | "sell"
): Promise<VersionedTransaction | null> => {
    try {
        switch (type) {
            case "buy":
                return fetchBuyTransaction(wallet, baseMint, amount);
            case "sell":
                return fetchSellTransaction(wallet, baseMint, amount);
            default:
                return fetchSellTransaction(wallet, baseMint, amount);
        }
    } catch (error) {
        console.error("getSwapTxWithWithJupiter error:", error);
        return null;
    }
};

export const fetchBuyTransaction = async (
    wallet: Keypair,
    baseMint: PublicKey,
    amount: string
) => {
    try {
        const quoteResponse = await (
            await fetch(
                `https://quote-api.jup.ag/v6/quote?inputMint=${solAddress}&outputMint=${baseMint.toBase58()}&amount=${amount}&slippageBps=${SLIPPAGE}`
            )
        ).json();
        const response = await (
            await fetch("https://quote-api.jup.ag/v6/swap", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    quoteResponse,
                    userPublicKey: wallet.publicKey.toString(),
                    wrapAndUnwrapSol: true,
                    dynamicComputeUnitLimit: true,
                    prioritizationFeeLamports: 100000,
                }),
            })
        ).json() as { swapTransaction?: string };
        if (!response.swapTransaction) {
            console.log("Failed to get buy transaction");
            return null;
        }

        // deserialize the transaction
        const swapTransactionBuf = Buffer.from(response.swapTransaction, "base64");
        const transaction =
            VersionedTransaction.deserialize(swapTransactionBuf);

        // sign the transaction
        transaction.sign([wallet]);
        return transaction;
    } catch (error) {
        console.log("Failed to get buy transaction", error);
        return null;
    }
};

export const fetchSellTransaction = async (
    wallet: Keypair,
    baseMint: PublicKey,
    amount: string
) => {
    try {
        const quoteResponse = await (
            await fetch(
                `https://quote-api.jup.ag/v6/quote?inputMint=${baseMint.toBase58()}&outputMint=${solAddress}&amount=${amount}&slippageBps=${SLIPPAGE}`
            )
        ).json();

        // get serialized transactions for the swap
        const response = await (
            await fetch("https://quote-api.jup.ag/v6/swap", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    quoteResponse,
                    userPublicKey: wallet.publicKey.toString(),
                    wrapAndUnwrapSol: true,
                    dynamicComputeUnitLimit: true,
                    prioritizationFeeLamports: 52000,
                }),
            })
        ).json() as { swapTransaction?: string };
        if (!response.swapTransaction) {
            console.log("Failed to get sell transaction");
            return null;
        }

        // deserialize the transaction
        const swapTransactionBuf = Buffer.from(response.swapTransaction, "base64");
        const transaction =
            VersionedTransaction.deserialize(swapTransactionBuf);

        // sign the transaction
        transaction.sign([wallet]);
        return transaction;
    } catch (error) {
        console.log("Failed to get sell transaction", error);
        return null;
    }
};
