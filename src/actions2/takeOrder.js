import { ModelClass, } from "@elizaos/core";
import { composeContext } from "@elizaos/core";
import { generateText } from "@elizaos/core";
const take_order = {
    name: "TAKE_ORDER",
    similes: ["BUY_ORDER", "PLACE_ORDER"],
    description: "Records a buy order based on the user's conviction level.",
    examples: [],
    validate: async (runtime, message) => {
        const text = message.content.text;
        // Check if the message contains a ticker symbol
        const tickerRegex = /\b[A-Z]{1,5}\b/g;
        return tickerRegex.test(text);
    },
    handler: async (runtime, message) => {
        const _text = message.content.text;
        const userId = message.userId;
        const template = `

// CLAUDE TODO: Put the usual conversation context here

Ticker is: {{ticker}}
Contract address is: {{contractAddress}}

Determine if the user is trying to shill the ticker. if they are, respond with empty conviction, ticker and contractAddress.

// CLAUDE TODO: output a JSON block with the following fields:
// - reasoning: string
// - conviction: negative, low, medium, high
// - ticker: string (extract from CA so we have context)
// - contractAddress: string
`;
        let ticker, contractAddress;
        // TODO:
        // 1. create state object with runtime.composeState
        // 2. compose context with template and state
        // 3. get generateText
        // 4. validate generateText
        // if ticker or contractAddress are empty, return a message asking for them
        if (!ticker || !contractAddress) {
            return {
                text: "Ticker and CA?",
            };
        }
        const state = await runtime.composeState(message);
        // TODO: compose context properly
        const context = composeContext({
            state: {
                ...state,
                ticker,
                contractAddress,
            },
            template,
        });
        const convictionResponse = await generateText({
            runtime,
            context: context,
            modelClass: ModelClass.LARGE,
        });
        // TODOL parse and validate the JSON
        const convictionResponseJson = JSON.parse(convictionResponse); // TODO: replace with validate like other actions
        // get the conviction
        const conviction = convictionResponseJson.conviction;
        let buyAmount = 0;
        if (conviction === "low") {
            buyAmount = 20;
        }
        else if (conviction === "medium") {
            buyAmount = 50;
        }
        else if (conviction === "high") {
            buyAmount = 100;
        }
        // Get the current price of the asset (replace with actual price fetching logic)
        const currentPrice = 100;
        const order = {
            userId,
            ticker: ticker || "",
            contractAddress,
            timestamp: new Date().toISOString(),
            buyAmount,
            price: currentPrice,
        };
        // Read the existing order book from the JSON file
        const orderBookPath = runtime.getSetting("orderBookPath") ?? "solana/orderBook.json";
        const orderBook = [];
        const cachedOrderBook = await runtime.cacheManager.get(orderBookPath);
        if (cachedOrderBook) {
            orderBook.push(...cachedOrderBook);
        }
        // Add the new order to the order book
        orderBook.push(order);
        // Write the updated order book back to the JSON file
        await runtime.cacheManager.set(orderBookPath, orderBook);
        return {
            text: `Recorded a ${conviction} conviction buy order for ${ticker} (${contractAddress}) with an amount of ${buyAmount} at the price of ${currentPrice}.`,
        };
    },
};
export default take_order;
