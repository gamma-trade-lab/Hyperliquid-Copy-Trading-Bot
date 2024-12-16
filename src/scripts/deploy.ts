// scripts/deploy.ts

import { Connection, Keypair, PublicKey, sendAndConfirmTransaction, Transaction } from '@solana/web3.js';
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import axios from 'axios';
import CONFIG from '../config/settings';
import { personalityConfig } from '../config/personality'; // Ensure this import is included
import { NetworkType } from '../config/constants';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as LitJsSdk from '@lit-protocol/lit-node-client';
import { LIT_NETWORK, LIT_NETWORKS } from '@lit-protocol/constants';

class Deployer {
  private connection: Connection;
  private crossmintApiKey: string = process.env.CROSSMINT_API_KEY!;
  private crossmintApiUrl: string = 'https://staging.crossmint.com/api/v1-alpha2/wallets';
  private deploymentLog: string[] = [];
  private lit: LitJsSdk.LitNodeClient;

  constructor() {
    dotenv.config();
    this.connection = new Connection(CONFIG.SOLANA.RPC_URL, 'confirmed');
    this.lit = new LitJsSdk.LitNodeClient({
      litNetwork: LIT_NETWORK.Habanero as LIT_NETWORKS // Use LIT_NETWORK.Jalapeno for mainnet
    });
  }

  private log(message: string) {
    console.log(message);
    this.deploymentLog.push(`[${new Date().toISOString()}] ${message}`);
  }

  async deployAgent() {
    try {
      this.log('Starting AI Agent deployment...');
      await this.lit.connect();

      // 1. Create agent wallet
      const agentWallet = await this.setupAgentWallet();
      this.log(`Agent wallet created: ${agentWallet.address}`);

      // 2. Create and initialize token
      const tokenInfo = await this.createToken(agentWallet.address);
      this.log(`Token created: ${tokenInfo.address}`);

      // 3. Setup initial liquidity
      const liquiditySetup = await this.setupLiquidity(tokenInfo.address, agentWallet);
      this.log(`Liquidity pool created: ${liquiditySetup.poolAddress}`);

      // 4. Initialize social media accounts
      await this.initializeSocialAccounts();
      this.log('Social media accounts initialized');

      // 5. Deploy verification contract
      const verificationContract = await this.deployVerificationContract();
      this.log(`Verification contract deployed: ${verificationContract}`);

      // Save deployment information
      await this.saveDeploymentInfo({
        timestamp: new Date().toISOString(),
        network: process.env.NETWORK_TYPE,
        agentWallet: agentWallet.address,
        token: tokenInfo,
        liquidityPool: liquiditySetup.poolAddress,
        verificationContract,
        personality: personalityConfig // Include personalityConfig in deployment info
      });

      this.log('Deployment completed successfully!');
      return true;

    } catch (error) {
      this.log(`Deployment failed: ${error}`);
      throw error;
    }
  }

  private async setupAgentWallet() {
    try {
      // Create a new wallet using Crossmint
      const response = await axios.post(this.crossmintApiUrl, {
        type: 'solana-custodial-wallet',
        linkedUser: `email:${process.env.AGENT_NAME}@yourdomain.com`
      }, {
        headers: {
          'X-API-KEY': this.crossmintApiKey,
          'Content-Type': 'application/json'
        }
      });

      const wallet = response.data;

      // Fund the wallet with initial SOL
      if (process.env.NETWORK_TYPE !== NetworkType.MAINNET) {
        const airdropSignature = await this.connection.requestAirdrop(
          new PublicKey(wallet.address),
          1000000000 // 1 SOL
        );
        await this.connection.confirmTransaction(airdropSignature);
      }

      return wallet;
    } catch (error) {
      this.log(`Failed to setup agent wallet: ${error}`);
      throw error;
    }
  }

  private async createToken(ownerAddress: string) {
    try {
      // Create token mint
      const payer = Keypair.generate();
      const mint = await createMint(
        this.connection,
        payer, // payer
        new PublicKey(ownerAddress), // mint authority
        new PublicKey(ownerAddress), // freeze authority
        9, // decimals
        payer
      );

      // Mint initial supply
      const tokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        payer,
        mint,
        new PublicKey(ownerAddress)
      );

      await mintTo(
        this.connection,
        payer,
        mint,
        tokenAccount.address,
        new PublicKey(ownerAddress),
        parseInt(process.env.INITIAL_SUPPLY!)
      );

      return {
        address: mint.toString(),
        decimals: 9,
        initialSupply: parseInt(process.env.INITIAL_SUPPLY!)
      };
    } catch (error) {
      this.log(`Failed to create token: ${error}`);
      throw error;
    }
  }

  private async setupLiquidity(tokenAddress: string, agentWallet: any) {
    // Implementation would include:
    // 1. Creating LP pool on Meteora or Orca
    // 2. Adding initial liquidity
    // 3. Setting up LP fee collection
    return {
      poolAddress: "dummy_pool_address" // Replace with actual implementation
    };
  }

  private async initializeSocialAccounts() {
    // Implementation would include:
    // 1. Setting up Twitter bot
    // 2. Configuring Discord webhook
    // 3. Initializing other social integrations
  }

  private async deployVerificationContract() {
    try {
      await this.lit.connect();
      // Implementation would include:
      // 1. Deploying Lit Protocol verification
      // 2. Setting up TEE configuration
      // 3. Initializing verification parameters
      return "dummy_contract_address"; // Replace with actual implementation
    } catch (error) {
      this.log(`Failed to deploy verification contract: ${error}`);
      throw error;
    }
  }

  private async saveDeploymentInfo(info: any) {
    const deploymentInfo = {
      ...info,
      logs: this.deploymentLog
    };

    // Save to file
    fs.writeFileSync(
      './deployment-info.json',
      JSON.stringify(deploymentInfo, null, 2)
    );

    // Save logs separately
    fs.writeFileSync(
      './deployment-logs.txt',
      this.deploymentLog.join('\n')
    );
  }
}

// Execute deployment
if (require.main === module) {
  const deployer = new Deployer();
  deployer.deployAgent()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Deployment failed:', error);
      process.exit(1);
    });
}

export { Deployer };