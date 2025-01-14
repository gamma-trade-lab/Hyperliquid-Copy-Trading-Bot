import { createToolParameters, Tool } from "@goat-sdk/core";
import { z } from "zod";

export class GetPairsByChainAndPairParameters extends createToolParameters(
    z.object({
        chainId: z.string().describe("The chain ID of the pair"),
        pairId: z.string().describe("The pair ID to fetch"),
    }),
) {}

export class SearchPairsParameters extends createToolParameters(
    z.object({
        query: z.string().describe("The search query string"),
    }),
) {}

export class GetTokenPairsParameters extends createToolParameters(
    z.object({
        tokenAddresses: z.array(z.string()).max(30).describe("List of up to 30 token addresses"),
    }),
) {}

export class DexscreenerService {
    private readonly baseUrl = "https://api.dexscreener.com/latest/dex";

    private async fetchDexscreener(url: string, action: string) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP status ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            throw new Error(`Failed to ${action}: ${error}`);
        }
    }

    @Tool({
        name: "dexscreener.get_pairs_by_chain_and_pair",
        description: "Fetch pairs by chainId and pairId from Dexscreener",
    })
    async getPairsByChainAndPair(parameters: GetPairsByChainAndPairParameters) {
        const url = `${this.baseUrl}/pairs/${parameters.chainId}/${parameters.pairId}`;
        return this.fetchDexscreener(url, "fetch pairs");
    }

    @Tool({
        name: "dexscreener.search_pairs",
        description: "Search for DEX pairs matching a query string on Dexscreener",
    })
    async searchPairs(parameters: SearchPairsParameters) {
        const url = `${this.baseUrl}/search?q=${encodeURIComponent(parameters.query)}`;
        return this.fetchDexscreener(url, "search pairs");
    }

    @Tool({
        name: "dexscreener.get_token_pairs_by_token_address",
        description: "Get all DEX pairs for given token addresses (up to 30) from Dexscreener",
    })
    async get_token_pairs_by_token_address(parameters: GetTokenPairsParameters) {
        if (parameters.tokenAddresses.length > 30) {
            throw new Error("Maximum of 30 token addresses allowed per request");
        }
        const addresses = parameters.tokenAddresses.join(",");
        const url = `${this.baseUrl}/tokens/${addresses}`;
        return this.fetchDexscreener(url, "get token pairs");
    }
}