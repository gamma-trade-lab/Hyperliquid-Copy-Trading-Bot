const {
  Connection,
  Keypair,
  ComputeBudgetProgram,
} = require("@solana/web3.js");
const {
  deserializeInstruction,
  getAddressLookupTableAccounts,
  simulateTransaction,
  createVersionedTransaction,
} = require("./transactionUtils");
const { getTokenInfo, getAveragePriorityFee } = require("./utils");
const { getQuote, getSwapInstructions, getSwapTransaction } = require("./jupiterApi");
const {
  createJitoBundle,
  sendJitoBundle,
  checkBundleStatus,
} = require("./jitoService");
const { SOLANA_RPC_URL, WALLET_PRIVATE_KEY } = require("./config");
const bs58 = require('bs58');

const connection = new Connection("https://white-aged-glitter.solana-mainnet.quiknode.pro/743d4e1e3949c3127beb7f7815cf2ca9743b43a6/");
const wallet = Keypair.fromSecretKey(
  // new Uint8Array(JSON.parse(WALLET_PRIVATE_KEY))
  bs58.decode(WALLET_PRIVATE_KEY)
);

async function swap(
  inputMint,
  outputMint,
  amount,
  slippageBps = 100,
  maxRetries = 5
) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      console.log("\n🔄 ========== INITIATING SWAP ==========");
      console.log("🔍 Fetching token information...");
      const inputTokenInfo = await getTokenInfo(inputMint);
      const outputTokenInfo = await getTokenInfo(outputMint);

      console.log(`🔢 Input token decimals: ${inputTokenInfo.decimals}`);
      console.log(`🔢 Output token decimals: ${outputTokenInfo.decimals}`);

      const adjustedAmount = amount * Math.pow(10, inputTokenInfo.decimals);
      const adjustedSlippageBps = slippageBps * (1 + retries * 0.5);

      // 1. Get quote from Jupiter
      console.log("\n💰 Getting quote from Jupiter...");
      const quoteResponse = await getQuote(
        inputMint,
        outputMint,
        adjustedAmount,
        adjustedSlippageBps
      );

      console.log("🚀 ~ quoteResponse:", quoteResponse)
      if (!quoteResponse || !quoteResponse.routePlan) {
        throw new Error("❌ No trading routes found");
      }

      console.log("✅ Quote received successfully");

      // 2. Get swap instructions
      console.log("\n📝 Getting swap instructions...");
      const swapInstructions = await getSwapInstructions(
        quoteResponse,
        wallet.publicKey.toString()
      );

      if (!swapInstructions || swapInstructions.error) {
        throw new Error(
          "❌ Failed to get swap instructions: " +
            (swapInstructions ? swapInstructions.error : "Unknown error")
        );
      }

      console.log("✅ Swap instructions received successfully");

      const {
        setupInstructions,
        swapInstruction: swapInstructionPayload,
        addressLookupTableAddresses,
      } = swapInstructions;

      const swapInstruction = deserializeInstruction(swapInstructionPayload);

      // 3. Prepare transaction
      console.log("\n🛠️  Preparing transaction...");
      const addressLookupTableAccounts = await getAddressLookupTableAccounts(
        addressLookupTableAddresses
      );

      const latestBlockhash = await connection.getLatestBlockhash("finalized");

      // reversal swap
      // 1. Get reversal quote from Jupiter
      const revQuoteResponse = await getQuote(
        outputMint,
        inputMint,
        quoteResponse.outAmount,
        adjustedSlippageBps
      );

      console.log("🚀 ~ revQuoteResponse:", revQuoteResponse)
      if (!revQuoteResponse || !revQuoteResponse.routePlan) {
        throw new Error("❌ No trading routes found");
      }

      console.log("✅ Quote received successfully");
      return null;

      // 2. Get reversal swap instructions
      console.log("\n📝 Getting swap instructions...");
      const revSwapInstructions = await getSwapInstructions(
        revQuoteResponse,
        wallet.publicKey.toString()
      );

      if (!revSwapInstructions || revSwapInstructions.error) {
        throw new Error(
          "❌ Failed to get reversal swap instructions: " +
            (revSwapInstructions ? revSwapInstructions.error : "Unknown error")
        );
      }

      console.log("✅ Swap instructions received successfully");

      const {
        setupInstructions: revSetupInstructions,
        swapInstruction: revSwapInstructionPayload,
        cleanupInstruction: revCleanupInstruction,
        addressLookupTableAddresses: revAddressLookupTableAddresses,
      } = revSwapInstructions;

      const revSwapInstruction = deserializeInstruction(revSwapInstructionPayload);

      // 3. Prepare transaction
      console.log("\n🛠️  Preparing transaction...");
      const revAddressLookupTableAccounts = await getAddressLookupTableAccounts(
        revAddressLookupTableAddresses
      );
      // 4. Simulate transaction to get compute units
      const instructions = [
        ...setupInstructions.map(deserializeInstruction),
        swapInstruction,
        ...revSetupInstructions.map(deserializeInstruction),
        revSwapInstruction
      ];

      // if (cleanupInstruction) {
      //   instructions.push(deserializeInstruction(cleanupInstruction));
      // }

      for(let i = 0; i < revAddressLookupTableAccounts.length; i++)
      {
        if(addressLookupTableAccounts.includes(revAddressLookupTableAccounts[i])) continue;
        else addressLookupTableAccounts.push(revAddressLookupTableAccounts[i])
      }
      console.log("\n🧪 Simulating transaction...");
      const computeUnits = await simulateTransaction(
        instructions,
        wallet.publicKey,
        addressLookupTableAccounts,
        5
      );

      if (computeUnits === undefined) {
        throw new Error("❌ Failed to simulate transaction");
      }

      if (computeUnits && computeUnits.error === "InsufficientFundsForRent") {
        console.log("❌ Insufficient funds for rent. Skipping this swap.");
        return null;
      }

      const priorityFee = await getAveragePriorityFee();

      console.log(`🧮 Compute units: ${computeUnits}`);
      console.log(`💸 Priority fee: ${priorityFee.microLamports} micro-lamports (${priorityFee.solAmount.toFixed(9)} SOL)`);

      // 5. Create versioned transaction
      const transaction = createVersionedTransaction(
        instructions,
        wallet.publicKey,
        addressLookupTableAccounts,
        latestBlockhash.blockhash,
        computeUnits,
        priorityFee
      );

      // 6. Sign the transaction
      transaction.sign([wallet]);

      // 7. Create and send Jito bundle
      const sig = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: true,
        maxRetries: 3,
        preflightCommitment: 'confirmed',
      })
      const tx = await connection.confirmTransaction(sig)
      console.log("\n✨ Swap executed successfully! ✨");
      console.log("========== SWAP COMPLETE ==========\n");

      return { sig };
    } catch (error) {
      console.error(
        `\n❌ Error executing swap (attempt ${retries + 1}/${maxRetries}):`
      );
      console.error(error.message);
      retries++;
      if (retries >= maxRetries) {
        console.error(
          `\n💔 Failed to execute swap after ${maxRetries} attempts.`
        );
        throw error;
      }
      console.log(`\nRetrying in 2 seconds...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

async function arbSwap(inputMint, outputMint,  amount, slippageBps, maxRetries) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      console.log("\n🔄 ========== INITIATING SWAP ==========");
      console.log("🔍 Fetching token information...");
      const inputTokenInfo = await getTokenInfo(inputMint);
      const outputTokenInfo = await getTokenInfo(outputMint);

      console.log(`🔢 Input token decimals: ${inputTokenInfo.decimals}`);
      console.log(`🔢 Output token decimals: ${outputTokenInfo.decimals}`);

      const adjustedAmount = amount * Math.pow(10, inputTokenInfo.decimals);
      const adjustedSlippageBps = slippageBps * (1 + retries * 0.5);

      // 1. Get quote from Jupiter
      console.log("\n💰 Getting quote from Jupiter...");
      const quoteResponse = await getQuote(
        inputMint,
        outputMint,
        adjustedAmount,
        adjustedSlippageBps
      );

      console.log("🚀 ~ quoteResponse:", quoteResponse)
      if (!quoteResponse || !quoteResponse.routePlan) {
        throw new Error("❌ No trading routes found");
      }

      console.log("✅ Quote received successfully");
      // reversal swap
      // 1. Get reversal quote from Jupiter
      const revQuoteResponse = await getQuote(
        outputMint,
        inputMint,
        quoteResponse.outAmount,
        adjustedSlippageBps
      );

      console.log("🚀 ~ revQuoteResponse:", revQuoteResponse)
      if (!revQuoteResponse || !revQuoteResponse.routePlan) {
        throw new Error("❌ No trading routes found");
      }

      const combinedQuoteResponse = {
        inputMint: quoteResponse.inputMint,
        inAmount: quoteResponse.inAmount,
        outputMint: revQuoteResponse.outputMint,
        outAmount: revQuoteResponse.outAmount,
        otherAmountThreshold: revQuoteResponse.otherAmountThreshold,
        swapMode: revQuoteResponse.swapMode,
        slippageBps: revQuoteResponse.slippageBps,
        platformFee: revQuoteResponse.platformFee,
        priceImpactPct: "0",
        routePlan: [ ...quoteResponse.routePlan, ...revQuoteResponse.routePlan ],
        contextSlot: revQuoteResponse.contextSlot,
        timeTaken: revQuoteResponse.timeTaken
      }


      console.log("\n📝 Getting swap transaction...");
      const { swapTransaction } = await getSwapTransaction(combinedQuoteResponse, wallet.publicKey.toString());

      const priorityFee = await getAveragePriorityFee();

      console.log(`💸 Priority fee: ${priorityFee.microLamports} micro-lamports (${priorityFee.solAmount.toFixed(9)} SOL)`);

      // 6. Sign the transaction
      swapTransaction.sign([wallet]);

      // 7. Create and send Jito bundle
      const sig = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: true,
        maxRetries: 3,
        preflightCommitment: 'confirmed',
      })
      const tx = await connection.confirmTransaction(sig)
      console.log("\n✨ Swap executed successfully! ✨");
      console.log("========== SWAP COMPLETE ==========\n");

      return { sig };
    } catch (error) {
      console.error(
        `\n❌ Error executing swap (attempt ${retries + 1}/${maxRetries}):`
      );
      console.error(error);
      retries++;
      if (retries >= maxRetries) {
        console.error(
          `\n💔 Failed to execute swap after ${maxRetries} attempts.`
        );
        throw error;
      }
      console.log(`\nRetrying in 2 seconds...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

async function main() {
  try {
    const inputMint = "So11111111111111111111111111111111111111112"; // Wrapped SOL
    const outputMint = "3B5wuUrMEi5yATD7on46hKfej3pfmd7t1RKgrsN3pump"; // BILLY
    const amount = 0.001; // 0.001 SOL
    const initialSlippageBps = 100; // 1% initial slippage
    const maxRetries = 5;

    console.log("\n🚀 Starting swap operation...");
    console.log(`Input: ${amount} SOL`);
    console.log(`Output: USDC`);
    console.log(`Initial Slippage: ${initialSlippageBps / 100}%`);

    const result = await arbSwap(
      inputMint,
      outputMint,
      amount,
      initialSlippageBps,
      maxRetries
    );

    console.log("\n🎉 Swap completed successfully!");
    console.log("Swap result:");
    console.log(`🔗 View on Solscan: https://solscan.io/tx/${result.sig}`);
    return;
  } catch (error) {
    console.error("\n💥 Error in main function:");
    console.error(error.message);
  }
}

main();