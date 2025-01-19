import { Tool } from "langchain/tools";
import { SolanaAgentKit } from "solana-agent-kit";
import axios from "axios";

declare module "solana-agent-kit" {
  interface SolanaAgentKit {
    getTokenDataByTicker(ticker: string): Promise<any>;
  }
}


export class SolanaTokenDataByTickerTool extends Tool {
  static getTokenPrice(token: any) {
    throw new Error('Method not implemented.');
  }
  name = "solana_token_data_by_ticker";
  description = `Get the token data for a given token ticker

  Inputs: ticker is required.
  ticker: string, eg "USDC" (required)`;

  constructor(private solanaKit: SolanaAgentKit) {
    super();
  }

  protected async _call(input: string): Promise<string> {
    try {
      const ticker = input.trim();
      const tokenData = await this.solanaKit.getTokenDataByTicker(ticker);
      return JSON.stringify({
        status: "success",
        tokenData,
      });
    } catch (error: any) {
      return JSON.stringify({
        status: "error",
        message: error.message,
        code: error.code || "UNKNOWN_ERROR",
      });
    }
  }
}
