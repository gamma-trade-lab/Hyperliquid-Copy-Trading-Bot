require("dotenv").config();

// 'https://mainnet.block-engine.jito.wtf/api/v1/bundles',
// 'https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/bundles',
// 'https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles',
// "https://ny.mainnet.block-engine.jito.wtf/api/v1/bundles",
// "https://tokyo.mainnet.block-engine.jito.wtf/api/v1/bundles",
module.exports = {
  JUPITER_V6_API: "https://quote-api.jup.ag/v6",
  JITO_RPC_URL: "https://tokyo.mainnet.block-engine.jito.wtf/api/v1/bundles",
  SOLANA_RPC_URL: process.env.SOLANA_RPC_URL,
  WALLET_PRIVATE_KEY: process.env.WALLET_PRIVATE_KEY,
};
