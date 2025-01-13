export var NetworkType;
(function (NetworkType) {
    NetworkType["MAINNET"] = "mainnet-beta";
    NetworkType["DEVNET"] = "devnet";
    NetworkType["TESTNET"] = "testnet";
})(NetworkType || (NetworkType = {}));
export var AIModel;
(function (AIModel) {
    AIModel["MIXTRAL"] = "mixtral-8x7b-32768";
    AIModel["LLAMA"] = "llama-2-70b-4096";
    AIModel["MPT"] = "mpt-30b-2048";
})(AIModel || (AIModel = {}));
export var SocialPlatform;
(function (SocialPlatform) {
    SocialPlatform["TWITTER"] = "twitter";
    SocialPlatform["DISCORD"] = "discord";
    SocialPlatform["TELEGRAM"] = "telegram";
})(SocialPlatform || (SocialPlatform = {}));
export var TransactionType;
(function (TransactionType) {
    TransactionType["SWAP"] = "swap";
    TransactionType["STAKE"] = "stake";
    TransactionType["TRANSFER"] = "transfer";
    TransactionType["LIQUIDITY"] = "liquidity";
})(TransactionType || (TransactionType = {}));
export var MarketAction;
(function (MarketAction) {
    MarketAction["BUY"] = "buy";
    MarketAction["SELL"] = "sell";
    MarketAction["HOLD"] = "hold";
    MarketAction["PRICE_UPDATE"] = "price_update";
    MarketAction["VOLUME_UPDATE"] = "volume_update";
    MarketAction["MARKET_ALERT"] = "market_alert";
    MarketAction["TREND_UPDATE"] = "trend_update";
    MarketAction["UPDATE"] = "UPDATE";
})(MarketAction || (MarketAction = {}));
export var MarketCondition;
(function (MarketCondition) {
    MarketCondition["BULLISH"] = "bullish";
    MarketCondition["BEARISH"] = "bearish";
    MarketCondition["NEUTRAL"] = "neutral";
})(MarketCondition || (MarketCondition = {}));
export var SentimentLevel;
(function (SentimentLevel) {
    SentimentLevel["POSITIVE"] = "positive";
    SentimentLevel["NEGATIVE"] = "negative";
    SentimentLevel["NEUTRAL"] = "neutral";
})(SentimentLevel || (SentimentLevel = {}));
export const ERROR_CODES = {
    INSUFFICIENT_FUNDS: 'E001',
    INVALID_TRANSACTION: 'E002',
    API_ERROR: 'E003',
    RATE_LIMIT: 'E004',
    SLIPPAGE_TOO_HIGH: 'E005'
};
export const NETWORK_ENDPOINTS = {
    [NetworkType.MAINNET]: {
        default: 'https://api.mainnet-beta.solana.com',
        helius: process.env.HELIUS_RPC_URL
    },
    [NetworkType.DEVNET]: {
        default: 'https://api.devnet.solana.com',
        helius: process.env.HELIUS_DEVNET_RPC_URL
    }
};
export const TIME_CONSTANTS = {
    BLOCK_TIME: 400, // milliseconds
    MAX_TRANSACTION_TIMEOUT: 30000, // 30 seconds
    RATE_LIMIT_WINDOW: 60000, // 1 minute
    CACHE_DURATION: 300000 // 5 minutes
};
export const PROTOCOL_ADDRESSES = {
    JUPITER_PROGRAM_ID: 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',
    METEORA_PROGRAM_ID: 'M3TPE3M5RyQZVBcgwg8aJR24wkp5e1gEjfN9WL6ywSS',
    TOKEN_PROGRAM_ID: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
};
export const DEFAULT_TRANSACTION_OPTIONS = {
    maxRetries: 3,
    minContextSlot: 0,
    skipPreflight: false,
    maxSignatureFee: 5000 // lamports
};
export const AUTOMATION = {
    CONTENT_GENERATION_INTERVAL: 60000,
    MARKET_MONITORING_INTERVAL: 60000,
    COMMUNITY_ENGAGEMENT_INTERVAL: 60000
};
