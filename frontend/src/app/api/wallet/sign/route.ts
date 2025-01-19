import { NextResponse } from 'next/server';
import * as bip39 from 'bip39';
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';

export async function POST(request: Request) {
  try {
    const { transaction } = await request.json();
    const mnemonic = process.env.WALLET_MNEMONIC;
    const quickNodeUrl = process.env.NEXT_PUBLIC_QUICKNODE_RPC_URL;
    
    if (!mnemonic || !quickNodeUrl) {
      throw new Error('Missing environment variables');
    }

    console.log('Received transaction data type:', typeof transaction);
    
    // Decode base64 transaction
    const transactionBuffer = Buffer.from(transaction, 'base64');
    const tx = VersionedTransaction.deserialize(transactionBuffer);

    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const keypair = Keypair.fromSeed(Uint8Array.from(seed).subarray(0, 32));
    const connection = new Connection(quickNodeUrl, 'confirmed');

    tx.sign([keypair]);
    const rawTransaction = tx.serialize();
    
    const signature = await connection.sendRawTransaction(rawTransaction);
    await connection.confirmTransaction(signature);

    return NextResponse.json({ signature });
  } catch (error) {
    console.error('Sign route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sign transaction' },
      { status: 500 }
    );
  }
}
