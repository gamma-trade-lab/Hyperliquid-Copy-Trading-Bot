const { PublicKey } = require("@solana/web3.js");

function validateMint(mint) {
  if (typeof mint !== "string" || !/^[A-HJ-NP-Za-km-z1-9]{32,44}$/.test(mint)) {
    throw new Error(`Invalid mint address: ${mint}`);
  }
}

function validateAmount(amount) {
  if (typeof amount !== "number" || isNaN(amount) || amount <= 0) {
    throw new Error(
      `Invalid amount: ${amount}. Amount must be a positive number.`
    );
  }
}

function validateSlippage(slippageBps) {
  if (
    typeof slippageBps !== "number" ||
    isNaN(slippageBps) ||
    slippageBps < 0 ||
    slippageBps > 10000
  ) {
    throw new Error(
      `Invalid slippage: ${slippageBps}. Slippage must be a number between 0 and 10000.`
    );
  }
}

function validateRetries(maxRetries) {
  if (!Number.isInteger(maxRetries) || maxRetries < 1) {
    throw new Error(
      `Invalid max retries: ${maxRetries}. Max retries must be a positive integer.`
    );
  }
}

module.exports = {
  validateMint,
  validateAmount,
  validateSlippage,
  validateRetries,
};
