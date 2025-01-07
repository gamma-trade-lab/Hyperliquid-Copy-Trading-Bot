// src/actions/metadata.ts

import { PublicKey } from '@solana/web3.js';
import { uploadFileToIPFS } from './uploadToIpfs.js';

export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image?: string;
  attributes?: {
    trait_type: string;
    value: string | number;
  }[];
  links?: {
    twitter?: string;
    telegram?: string;
    discord?: string;
    website?: string;
  };
  creators?: {
    address: string;
    share: number;
  }[];
}

export interface UpdateMetadataParams {
  mint: PublicKey;
  metadata: Partial<TokenMetadata>;
}

export class metadata {
  constructor(private readonly ipfsGateway: string) {}

  async createMetadata(metadata: TokenMetadata): Promise<string> {
    try {
      // Format metadata according to standards
      const formattedMetadata = this.formatMetadata(metadata);
      
      // Upload to IPFS
      const cid = await uploadFileToIPFS('metadata.json', Buffer.from(JSON.stringify(formattedMetadata)));
      
      return `${this.ipfsGateway}/${cid}`;
    } catch (error) {
      console.error('Error creating metadata:', error);
      throw error;
    }
  }

  private formatMetadata(metadata: TokenMetadata): object {
    return {
      name: metadata.name,
      symbol: metadata.symbol,
      description: metadata.description,
      image: metadata.image || '',
      attributes: metadata.attributes || [],
      external_url: metadata.links?.website || '',
      properties: {
        category: 'meme',
        creators: metadata.creators || [],
        files: [
          {
            uri: metadata.image || '',
            type: 'image/png'
          }
        ],
        links: {
          twitter: metadata.links?.twitter || '',
          telegram: metadata.links?.telegram || '',
          discord: metadata.links?.discord || '',
          website: metadata.links?.website || ''
        }
      }
    };
  }

  async validateMetadata(metadata: TokenMetadata): Promise<boolean> {
    // Required fields
    if (!metadata.name || !metadata.symbol || !metadata.description) {
      throw new Error('Missing required metadata fields');
    }

    // Symbol validation
    if (metadata.symbol.length > 10) {
      throw new Error('Symbol must be 10 characters or less');
    }

    // Name validation
    if (metadata.name.length > 32) {
      throw new Error('Name must be 32 characters or less');
    }

    // Description validation
    if (metadata.description.length > 200) {
      throw new Error('Description must be 200 characters or less');
    }

    return true;
  }

  generateDefaultMetadata(name: string, symbol: string): TokenMetadata {
    return {
      name,
      symbol: symbol.toUpperCase(),
      description: `${name} - A pump.fun meme token`,
      attributes: [
        {
          trait_type: 'category',
          value: 'meme'
        },
        {
          trait_type: 'type',
          value: 'fungible'
        }
      ],
      links: {
        website: '',
        twitter: '',
        telegram: '',
        discord: ''
      }
    };
  }

  async updateMetadata(params: UpdateMetadataParams): Promise<string> {
    try {
      // Get existing metadata
      const existingMetadata = await this.getMetadata(params.mint);
      
      // Merge with updates
      const updatedMetadata = {
        ...existingMetadata,
        ...params.metadata
      };
      
      // Validate
      await this.validateMetadata(updatedMetadata);
      
      // Upload new version
      return await this.createMetadata(updatedMetadata);
      
    } catch (error) {
      console.error('Error updating metadata:', error);
      throw error;
    }
  }

  async getMetadata(mint: PublicKey): Promise<TokenMetadata> {
    try {
      // Implementation to fetch existing metadata from chain
      // This would integrate with your other pump.fun actions
      throw new Error('Not implemented');
    } catch (error) {
      console.error('Error fetching metadata:', error);
      throw error;
    }
  }

  isValidLink(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

export function sanitizeMetadataString(input: string): string {
  // Remove any HTML or potentially harmful characters
  return input.replace(/<[^>]*>?/gm, '');
}

export function validateTokenSymbol(symbol: string): boolean {
  // Must be uppercase letters only, 2-10 characters
  return /^[A-Z]{2,10}$/.test(symbol);
}