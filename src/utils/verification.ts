// src/utils/verification.ts

import { PublicKey, Transaction } from '@solana/web3.js';
import { personalityConfig } from '../config/personality';
import nacl from 'tweetnacl';

interface VerificationConfig {
  litNodeKey: string;
  network: 'mainnet' | 'testnet';
  agentPublicKey: string;
}

interface SignedResponse {
  response: string;
  signature: string;
  timestamp: number;
  metadata: {
    agentId: string;
    version: string;
    model: string;
  };
}

interface VerificationResult {
  isValid: boolean;
  verifiedBy: string;
  timestamp: number;
  metadata?: any;
}

export class VerificationUtils {
  private litClient: LitNodeClient;
  private agentPublicKey: PublicKey;

  constructor(config: VerificationConfig) {
    this.litClient = new LitNodeClient({
      network: config.network,
      debug: false
    });
    this.agentPublicKey = new PublicKey(config.agentPublicKey);
  }

  async initialize(): Promise<void> {
    await this.litClient.connect();
  }

  async signAIResponse(
    response: string,
    context: any
  ): Promise<SignedResponse> {
    try {
      // Create JWT for the response
      const jwt = await this.litClient.generateJWT({
        payload: {
          response,
          context,
          timestamp: Date.now(),
          agentId: this.agentPublicKey.toString(),
          personality: personalityConfig.core.name
        }
      });

      // Sign with Lit Protocol
      const signature = await this.litClient.signMessage({
        message: response,
        publicKey: this.agentPublicKey.toString(),
        signWithLit: true
      });

      return {
        response,
        signature: signature.toString('hex'),
        timestamp: Date.now(),
        metadata: {
          agentId: this.agentPublicKey.toString(),
          version: '1.0',
          model: personalityConfig.core.name
        }
      };
    } catch (error) {
      console.error('Error signing AI response:', error);
      throw error;
    }
  }

  async verifySignedResponse(
    signedResponse: SignedResponse
  ): Promise<VerificationResult> {
    try {
      // Verify signature using Lit Protocol
      const isValid = await this.litClient.verifyMessage({
        message: signedResponse.response,
        signature: Buffer.from(signedResponse.signature, 'hex'),
        publicKey: this.agentPublicKey.toString()
      });

      return {
        isValid,
        verifiedBy: 'Lit Protocol',
        timestamp: Date.now(),
        metadata: signedResponse.metadata
      };
    } catch (error) {
      console.error('Error verifying response:', error);
      throw error;
    }
  }

  async signTransaction(
    transaction: Transaction,
    context: any
  ): Promise<{ transaction: Transaction; verification: VerificationResult }> {
    try {
      // Sign transaction with Lit Protocol
      const signedTx = await this.litClient.signTransaction({
        transaction,
        publicKey: this.agentPublicKey.toString()
      });

      // Create verification record
      const verification: VerificationResult = {
        isValid: true,
        verifiedBy: 'Lit Protocol TEE',
        timestamp: Date.now(),
        metadata: {
          context,
          agentId: this.agentPublicKey.toString(),
          transactionType: this.getTransactionType(transaction)
        }
      };

      return {
        transaction: signedTx,
        verification
      };
    } catch (error) {
      console.error('Error signing transaction:', error);
      throw error;
    }
  }

  async createVerificationProof(
    data: any,
    action: string
  ): Promise<string> {
    try {
      // Generate TEE-based proof using Lit Protocol
      const proof = await this.litClient.generateProof({
        data,
        action,
        publicKey: this.agentPublicKey.toString(),
        conditions: [
          {
            conditionType: 'time',
            timestamp: Date.now(),
            chain: 'solana'
          }
        ]
      });

      return proof;
    } catch (error) {
      console.error('Error creating verification proof:', error);
      throw error;
    }
  }

  async verifyAgentIdentity(
    message: string,
    signature: string
  ): Promise<boolean> {
    try {
      // Verify using Lit Protocol's TEE
      const isValid = await this.litClient.verifyIdentity({
        message,
        signature: Buffer.from(signature, 'hex'),
        publicKey: this.agentPublicKey.toString()
      });

      return isValid;
    } catch (error) {
      console.error('Error verifying agent identity:', error);
      throw error;
    }
  }

  private getTransactionType(transaction: Transaction): string {
    // Analyze transaction to determine its type
    // This is a simplified version - expand based on your needs
    const programIds = transaction.instructions.map(
      ix => ix.programId.toString()
    );

    if (programIds.includes('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')) {
      return 'TOKEN_TRANSACTION';
    }

    if (programIds.includes('11111111111111111111111111111111')) {
      return 'SYSTEM_TRANSACTION';
    }

    return 'UNKNOWN';
  }

  async verifyExecutionContext(): Promise<VerificationResult> {
    try {
      // Verify the execution environment is secure
      const teeVerification = await this.litClient.verifyExecutionContext({
        requiredProgramHash: 'your-program-hash',
        chain: 'solana'
      });

      return {
        isValid: teeVerification.isValid,
        verifiedBy: 'Lit Protocol TEE',
        timestamp: Date.now(),
        metadata: {
          executionContext: teeVerification.context,
          securityLevel: teeVerification.securityLevel
        }
      };
    } catch (error) {
      console.error('Error verifying execution context:', error);
      throw error;
    }
  }
}