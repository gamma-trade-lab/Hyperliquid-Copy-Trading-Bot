import { Connection, Keypair, VersionedTransaction, PublicKey } from '@solana/web3.js';
import FormData from 'form-data';
import fetch from 'node-fetch';
import bs58 from 'bs58';
import { configDotenv } from 'dotenv';
configDotenv();

const web3Connection = new Connection(
    "https://api.mainnet-beta.solana.com",
    'confirmed',
);

async function sendLocalCreateTx() {
    // Generate a new random wallet keypair instead of using an existing one
    const signerKeyPair = Keypair.fromSecretKey(new Uint8Array(bs58.decode("private_key")));

    // Log the wallet details for reference
    console.log("Generated Wallet Public Key:", signerKeyPair.publicKey.toBase58());
    console.log("Generated Wallet Private Key:", bs58.encode(signerKeyPair.secretKey));

    // Generate a random keypair for token (as before)
    const mintKeypair = Keypair.generate();
    console.log("Generated Mint Public Key:", mintKeypair.publicKey.toBase58());

    // Define token metadata
    const formData = new FormData();
    formData.append("name", "PPTest");
    formData.append("symbol", "TEST");
    formData.append("description", "This is an example token created via PumpPortal.fun");
    formData.append("twitter", "https://x.com/a1lon9/status/1812970586420994083");
    formData.append("telegram", "https://x.com/a1lon9/status/1812970586420994083");
    formData.append("website", "https://pumpportal.fun");
    formData.append("showName", "true");

    // Create a buffer for the file content
    const fileContent = Buffer.from("Token metadata");
    formData.append("file", fileContent, {
        filename: "metadata.txt",
        contentType: "text/plain",
    });

    // Upload to IPFS using Pinata
    const JWT = process.env.PINATA_JWT; // Make sure this is set in your .env file
    const ipfsResponse = await fetch("https://uploads.pinata.cloud/v3/files", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${JWT}`
        },
        body: formData,
    });
    const ipfsData = await ipfsResponse.json();
    console.log("IPFS Upload Response:", ipfsData);

    // Get the IPFS CID from the response
    const ipfsCid = ipfsData.IpfsHash;

    // Get the create transaction
    const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "publicKey": signerKeyPair.publicKey.toBase58(), // Use the new wallet's public key
            "action": "create",
            "tokenMetadata": {
                name: "DemoLLMemecoin",
                symbol: "$DLLM",
                uri: `ipfs://${ipfsCid}` // Use the IPFS CID here
            },
            "mint": mintKeypair.publicKey.toBase58(),
            "denominatedInSol": "true",
            "amount": 0, // dev buy of 1 SOL
            "slippage": 20,
            "priorityFee": 0.0005,
            "pool": "pump"
        })
    });



    if (response.status === 200) { // successfully generated transaction
        const data = await response.arrayBuffer();
        const tx = VersionedTransaction.deserialize(new Uint8Array(data));
        tx.sign([mintKeypair, signerKeyPair]);
        const signature = await web3Connection.sendTransaction(tx)
        console.log(`
The token ${mintKeypair.publicKey.toBase58()} has been created. Transaction: https://solscan.io/tx/${signature}
        `);
    } else {
        console.log(response.statusText); // log error
    }

    // await sleep(10000);
    // await sellToken(mintKeypair.publicKey.toBase58(), 6800000);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


// New function to sell a token
async function sellToken(tokenAddress: string, amount: number) {
    const signerKeyPair = Keypair.fromSecretKey(new Uint8Array(bs58.decode("private_key")));

    const response = await fetch(`https://pumpportal.fun/api/trade-local`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "publicKey": signerKeyPair.publicKey.toBase58(),
            "action": "sell",
            "mint": tokenAddress,
            "denominatedInSol": "false",
            "amount": amount,
            "slippage": 20,
            "priorityFee": 0.001,
            "pool": "pump"
        })
    });

    if (response.status === 200) {
        const data = await response.arrayBuffer();
        const tx = VersionedTransaction.deserialize(new Uint8Array(data));
        tx.sign([signerKeyPair]);
        const signature = await web3Connection.sendTransaction(tx)
        console.log("Sell Transaction: https://solscan.io/tx/" + signature);

    } else {
        console.log("Error selling token:", response.statusText);
    }
}

sendLocalCreateTx()