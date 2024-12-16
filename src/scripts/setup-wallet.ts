// scripts/setup-wallet.ts

import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as LitJsSdk from '@lit-protocol/lit-node-client';
import CONFIG from '../config/settings';
import { NetworkType } from '../config/constants';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import axios from 'axios';
import { LIT_NETWORK, LIT_NETWORKS } from '@lit-protocol/constants';

interface WalletConfig {
  type: 'crossmint' | 'lit' | 'eoa';
  name: string;
  permissions: string[];
}

class WalletSetup {
  private connection: Connection;
  private lit: LitJsSdk.LitNodeClient;
  private walletDir: string = path.join(__dirname, '../wallets');
  private crossmintApiKey: string = process.env.CROSSMINT_API_KEY!;
  private crossmintApiUrl: string = 'https://staging.crossmint.com/api/v1-alpha2/wallets';

  constructor() {
    dotenv.config();
    this.connection = new Connection(CONFIG.SOLANA.RPC_URL, 'confirmed');
    this.lit = new LitJsSdk.LitNodeClient({
      litNetwork: LIT_NETWORK.Habanero as LIT_NETWORKS// Use LIT_NETWORK.Jalapeno for mainnet
    });

    // Ensure wallet directory exists
    if (!fs.existsSync(this.walletDir)) {
      fs.mkdirSync(this.walletDir, { recursive: true });
    }
  }

  async setup() {
    try {
      console.log('Starting wallet setup...');
      await this.lit.connect();

      // 1. Create Crossmint custodial wallet
      const custodialWallet = await this.setupCrossmintWallet();
      console.log('Custodial wallet created:', custodialWallet.address);

      // 2. Create Lit Protocol PKP wallet
      const pkpWallet = await this.setupLitWallet();
      console.log('PKP wallet created:', pkpWallet.address);

      // 3. Create backup EOA wallet
      const backupWallet = await this.setupBackupWallet();
      console.log('Backup wallet created:', backupWallet.publicKey.toString());

      // 4. Set up wallet permissions and controls
      const walletConfig = await this.configureWallets({
        custodial: custodialWallet,
        pkp: pkpWallet,
        backup: backupWallet
      });

      // 5. Initialize wallets with test tokens if on devnet
      if (CONFIG.SOLANA.NETWORK !== NetworkType.MAINNET) {
        await this.initializeWallets([
          custodialWallet.address,
          pkpWallet.address,
          backupWallet.publicKey.toString()
        ]);
      }

      // Save wallet configurations
      await this.saveWalletConfig(walletConfig);

      console.log('Wallet setup completed successfully!');
      return walletConfig;

    } catch (error) {
      console.error('Wallet setup failed:', error);
      throw error;
    }
  }

  private async setupCrossmintWallet() {
    try {
      // Create a new custodial wallet
      const response = await axios.post(this.crossmintApiUrl, {
        type: 'solana-custodial-wallet',
        linkedUser: `email:${CONFIG.SOCIAL.TWITTER.USERNAME}@yourdomain.com`
      }, {
        headers: {
          'X-API-KEY': this.crossmintApiKey,
          'Content-Type': 'application/json'
        }
      });

      const wallet = response.data;

      // Set up wallet permissions
      await axios.post(`${this.crossmintApiUrl}/${wallet.address}/permissions`, {
        allowedOperations: ['TRANSFER', 'SWAP', 'STAKE'],
        maxTransactionAmount: CONFIG.SOLANA.TRADING.MAX_TRANSACTION_RETRIES,
        // whitelistedAddresses: CONFIG.SOLANA.TRADING.WHITELISTED_ADDRESSES
      }, {
        headers: {
          'X-API-KEY': this.crossmintApiKey,
          'Content-Type': 'application/json'
        }
      });

      return wallet;
    } catch (error) {
      console.error('Failed to setup Crossmint wallet:', error);
      throw error;
    }
  }

  private async setupLitWallet() {
    try {
      await this.lit.connect();

      // Generate a new PKP (Programmable Key Pair)
      const pkp = await this.lit.generateAndStorePKP({
        permissions: ['SIGN_TX', 'SIGN_MESSAGE'],
        authMethods: [{
          type: 'agentKey',
          token: CONFIG.SOCIAL.TWITTER.USERNAME
        }]
      });

      return {
        address: pkp.ethAddress, // Will be converted to Solana address
        publicKey: pkp.publicKey,
        pkpId: pkp.tokenId
      };
    } catch (error) {
      console.error('Failed to setup Lit wallet:', error);
      throw error;
    }
  }

  private async setupBackupWallet() {
    // Generate a new Solana keypair
    const keypair = Keypair.generate();

    // Save keypair securely (in production, use proper key management)
    const encryptedKeyfile = {
      publicKey: keypair.publicKey.toString(),
      encryptedPrivateKey: 'ENCRYPTED_PRIVATE_KEY' // Implement proper encryption
    };

    fs.writeFileSync(
      path.join(this.walletDir, 'backup-wallet.json'),
      JSON.stringify(encryptedKeyfile, null, 2)
    );

    return keypair;
  }

  private async configureWallets(wallets: any) {
    // Define wallet configurations and permissions
    const config = {
      primary: {
        type: 'crossmint' as WalletConfig['type'],
        address: wallets.custodial.address,
        permissions: ['TRADE', 'TRANSFER', 'STAKE']
      },
      security: {
        type: 'lit' as WalletConfig['type'],
        address: wallets.pkp.address,
        permissions: ['SIGN', 'VERIFY']
      },
      backup: {
        type: 'eoa' as WalletConfig['type'],
        address: wallets.backup.publicKey.toString(),
        permissions: ['RECOVERY']
      }
    };

    return config;
  }

  private async initializeWallets(addresses: string[]) {
    for (const address of addresses) {
      // Request airdrop for each wallet
      const signature = await this.connection.requestAirdrop(
        new PublicKey(address),
        1000000000 // 1 SOL
      );
      await this.connection.confirmTransaction(signature);
      console.log(`Initialized wallet ${address} with 1 SOL`);
    }
  }

  private async saveWalletConfig(config: any) {
    // Save wallet configuration
    fs.writeFileSync(
      path.join(this.walletDir, 'wallet-config.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        network: CONFIG.SOLANA.NETWORK,
        wallets: config
      }, null, 2)
    );
  }
}

// Execute wallet setup
if (require.main === module) {
  const setup = new WalletSetup();
  setup.setup()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}

export { WalletSetup };
