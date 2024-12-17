const axios = require("axios");
const { JUPITER_V6_API } = require("./config");

async function getQuote(inputMint, outputMint, amount, slippageBps) {
  const response = await axios.get(`${JUPITER_V6_API}/quote`, {
    params: {
      inputMint,
      outputMint,
      amount,
      slippageBps,
      onlyDirectRoutes: true
    },
  });
  return response.data;
}

async function getSwapInstructions(quoteResponse, userPublicKey) {
  const response = await axios.post(`${JUPITER_V6_API}/swap-instructions`, {
    quoteResponse,
    userPublicKey,
    wrapUnwrapSOL: true,
    dynamicComputeUnitLimit: true,
    prioritizationFeeLamports: 52_000,
  });
  return response.data;
}

async function getSwapTransaction(quoteResponse, userPublicKey) {
  const response = await axios.post(`${JUPITER_V6_API}/swap`, {
    quoteResponse,
    userPublicKey,
    wrapUnwrapSOL: true,
    dynamicComputeUnitLimit: true,
    prioritizationFeeLamports: 52_000,
  });
  console.log(response)
  return response.data;
}

module.exports = {
  getQuote,
  getSwapInstructions,
  getSwapTransaction
};
