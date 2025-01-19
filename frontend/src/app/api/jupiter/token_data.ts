import { Tool } from "langchain/tools";
import { Connection, PublicKey } from "@solana/web3.js";
import axios from "axios";

const MPL_TOKEN_METADATA_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

interface TokenData {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  extensions?: {
    [key: string]: any;
  };
  price?: {
    usd: number;
    sol: number;
  };
  supply?: {
    total: string;
    circulating: string;
  };
  metadata?: {
    uri?: string;
    description?: string;
    verified?: boolean;
  };
  tags?: string[];
}

interface JupiterTokenListResponse {
  tokens: {
    [key: string]: {
      symbol: string;
      name: string;
      decimals: number;
      logoURI?: string;
      extensions?: {
        [key: string]: any;
      };
      tags?: string[];
    };
  };
}

export class SolanaTokenDataTool extends Tool {
  name = "solana_token_data";
  description = `Get the token data for a given token mint address

  Inputs: mintAddress is required.
  mintAddress: string, eg "So11111111111111111111111111111111111111112" (required)`;

  private connection: Connection;
  private jupiterTokenListUrl = "https://token.jup.ag/all";
  private birdsEyeApiUrl = "https://public-api.birdeye.so/public/tokeninfo";

  constructor(
    rpcUrl: string,
    private options: {
      birdsEyeApiKey?: string;
      commitment?: "processed" | "confirmed" | "finalized";
    } = {}
  ) {
    super();
    this.connection = new Connection(rpcUrl, {
      commitment: this.options.commitment || "confirmed"
    });
  }

  protected async _call(input: string): Promise<string> {
    try {
      const mintAddress = input.trim();

      // Validate mint address
      if (!mintAddress) {
        throw new Error("Mint address is required");
      }

      try {
        new PublicKey(mintAddress);
      } catch {
        throw new Error("Invalid mint address format");
      }

      // Fetch token data from multiple sources in parallel
      const [jupiterData, metaplexData, birdsEyeData] = await Promise.all([
        this.fetchJupiterTokenData(mintAddress),
        this.fetchMetaplexMetadata(mintAddress),
        this.fetchBirdsEyeData(mintAddress)
      ]);

      // Combine data from all sources
      const tokenData: TokenData = {
        mint: mintAddress,
        symbol: jupiterData?.symbol || metaplexData?.symbol || "UNKNOWN",
        name: jupiterData?.name || metaplexData?.name || "Unknown Token",
        decimals: jupiterData?.decimals || 0,
        logoURI: jupiterData?.logoURI,
        extensions: jupiterData?.extensions,
        tags: jupiterData?.tags,
        metadata: {
          uri: metaplexData?.uri,
          description: metaplexData?.description,
          verified: jupiterData ? true : false
        }
      };

      // Add price and supply data if available
      if (birdsEyeData) {
        tokenData.price = {
          usd: birdsEyeData.price_usd || 0,
          sol: birdsEyeData.price_sol || 0
        };
        tokenData.supply = {
          total: birdsEyeData.total_supply || "0",
          circulating: birdsEyeData.circulating_supply || "0"
        };
      }

      return JSON.stringify({
        status: "success",
        tokenData
      });
    } catch (error) {
      const err = error as Error;
      return JSON.stringify({
        status: "error",
        message: err.message,
        code: axios.isAxiosError(error) ? "NETWORK_ERROR" : "UNKNOWN_ERROR"
      });
    }
  }

  private async fetchJupiterTokenData(mintAddress: string) {
    try {
      const response = await axios.get<JupiterTokenListResponse>(
        this.jupiterTokenListUrl
      );
      return response.data.tokens[mintAddress];
    } catch {
      return null;
    }
  }

  private async fetchMetaplexMetadata(mintAddress: string) {
    try {
      const mintPublicKey = new PublicKey(mintAddress);
      
      // Get metadata account PDA
      const [metadataAddress] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          MPL_TOKEN_METADATA_PROGRAM_ID.toBytes(),
          mintPublicKey.toBytes(),
        ],
        MPL_TOKEN_METADATA_PROGRAM_ID
      );

      // Fetch account info
      const accountInfo = await this.connection.getAccountInfo(metadataAddress);
      if (!accountInfo) return null;

      // Create a buffer reader for the account data
      const metadataAccountData = accountInfo.data;
      
      // Skip the first byte (represents the metadata account type)
      const nameLength = metadataAccountData[4];
      const name = metadataAccountData.slice(5, 5 + nameLength).toString().replace(/\0/g, '');
      
      const symbolOffset = 5 + nameLength;
      const symbolLength = metadataAccountData[symbolOffset];
      const symbol = metadataAccountData.slice(symbolOffset + 1, symbolOffset + 1 + symbolLength).toString().replace(/\0/g, '');
      
      const uriOffset = symbolOffset + 1 + symbolLength;
      const uriLength = metadataAccountData[uriOffset];
      const uri = metadataAccountData.slice(uriOffset + 1, uriOffset + 1 + uriLength).toString().replace(/\0/g, '');

      // If there's a data URI, fetch additional metadata
      let extraData = {};
      if (uri) {
        try {
          const response = await axios.get(uri);
          extraData = response.data;
        } catch {
          // Ignore URI fetch errors
        }
      }

      return {
        name,
        symbol,
        uri,
        description: (extraData as any)?.description || ""
      };

    } catch (error) {
      console.error("Error fetching metadata:", error);
      return null;
    }
  }

  private async fetchBirdsEyeData(mintAddress: string) {
    if (!this.options.birdsEyeApiKey) {
      return null;
    }

    try {
      const response = await axios.get(this.birdsEyeApiUrl, {
        params: { address: mintAddress },
        headers: {
          "x-api-key": this.options.birdsEyeApiKey
        }
      });
      return response.data.data;
    } catch {
      return null;
    }
  }
}