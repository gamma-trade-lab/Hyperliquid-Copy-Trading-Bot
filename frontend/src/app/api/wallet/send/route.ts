import { NextResponse } from 'next/server';
import * as bip39 from 'bip39';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';

export async function POST(request: Request) {
  try {
    const { recipient, amount } = await request.json();
    const mnemonic = process.env.WALLET_MNEMONIC;
    const apiKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;

    if (!mnemonic || !apiKey) {
      throw new Error('Missing environment variables');
    }

    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const keypair = Keypair.fromSeed(Uint8Array.from(seed).subarray(0, 32));
    
    const connection = new Connection(
      `https://mainnet.helius-rpc.com/?api-key=${apiKey}`,
      'confirmed'
    );

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: new PublicKey(recipient),
        lamports: amount * LAMPORTS_PER_SOL,
      })
    );

    const signature = await connection.sendTransaction(transaction, [keypair]);

    return NextResponse.json({
      signature,
      success: true
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to send transaction' },
      { status: 500 }
    );
  }
}
