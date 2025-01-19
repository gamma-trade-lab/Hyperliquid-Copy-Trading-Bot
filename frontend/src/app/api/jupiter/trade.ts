import { Tool } from "langchain/tools";

import { PublicKey } from "@solana/web3.js";
import { SolanaAgentKit } from "solana-agent-kit";

export class SolanaTradeTool extends Tool {
  name = "solana_trade";
  description = `This tool can be used to swap tokens to another token ( It uses Jupiter Exchange ).

  Inputs ( input is a JSON string ):
  outputMint: string, eg "So11111111111111111111111111111111111111112" or "SENDdRQtYMWaQrBroBrJ2Q53fgVuq95CV9UPGEvpCxa" (required)
  inputAmount: number, eg 1 or 0.01 (required)
  inputMint?: string, eg "So11111111111111111111111111111111111111112" (optional)
  slippageBps?: number, eg 100 (optional)`;

  constructor(private solanaKit: SolanaAgentKit) {
    super();
  }

  protected async _call(input: string): Promise<string> {
    try {
      const parsedInput = JSON.parse(input);

      // Validate input
      const errors = this.validateTradeRequest(parsedInput);
      if (errors.length > 0) {
        return JSON.stringify({
          status: "error",
          message: "Validation failed",
          errors,
        });
      }

      const tx = await this.solanaKit.trade(
        new PublicKey(parsedInput.outputMint),
        parsedInput.inputAmount,
        parsedInput.inputMint
          ? new PublicKey(parsedInput.inputMint)
          : new PublicKey("So11111111111111111111111111111111111111112"),
        parsedInput.slippageBps,
      );

      return JSON.stringify({
        status: "success",
        message: "Trade executed successfully",
        transaction: tx,
        inputAmount: parsedInput.inputAmount,
        inputToken: parsedInput.inputMint || "SOL",
        outputToken: parsedInput.outputMint,
      });
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      return JSON.stringify({
        status: "error",
        message: err.message,
        code: err.code || "UNKNOWN_ERROR",
      });
    }
  }

  private validateTradeRequest(body: any): string[] {
    const errors: string[] = [];
    const MIN_SOL_AMOUNT = 0.001;
    const MAX_SOL_AMOUNT = 100;
    const MAX_SLIPPAGE = 50; // 5%

    if (!body.inputAmount) {
      errors.push('Amount is required');
    } else if (body.inputAmount < MIN_SOL_AMOUNT || body.inputAmount > MAX_SOL_AMOUNT) {
      errors.push(`Amount must be between ${MIN_SOL_AMOUNT} and ${MAX_SOL_AMOUNT} SOL`);
    }

    if (!body.outputMint) {
      errors.push('Output token address is required');
    } else if (!PublicKey.isOnCurve(body.outputMint)) {
      errors.push('Invalid output token address');
    }

    if (body.slippageBps !== undefined) {
      if (body.slippageBps <= 0 || body.slippageBps > MAX_SLIPPAGE) {
        errors.push(`Slippage must be between 0 and ${MAX_SLIPPAGE}`);
      }
    }

    return errors;
  }
}
