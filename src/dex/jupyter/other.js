const { parentPort, workerData } = require("worker_threads");const { Connection, LAMPORTS_PER_SOL, Wallet } = require("@solana/web3.js");const {  Keypair,  Transaction, PublicKey, SystemProgram, TransactionMessage,  ComputeBudgetProgram,  VersionedTransaction,} = require("@solana/web3.js");const SLIPPAGE_BPS = 500; const axios = require("axios");const bs58 = require("bs58");let web3 = require('@solana/web3.js');let splToken = require('@solana/spl-token');
// let firstWinPrivKey = [add-your-wallet-key].slice(0,32);
const { SOLANA_RPC_URL, WALLET_PRIVATE_KEY } = require("./config");

let keypair = web3.Keypair.fromSecretKey(bs58.decode(WALLET_PRIVATE_KEY));
const workerId = workerData.workerId; const pair = workerData.tradePair;function sleep(ms) {return new Promise((resolve) => setTimeout(resolve, ms));}
const JITO_RPC_URL = "https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles";const {  getAddressLookupTableAccounts,  deserializeInstruction,} = require("./utils");
const fetch = require('node-fetch');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { error } = require("console");
const { TOKENS2, TOKENS3, RPCLER2, TOKENS1000, TOKENS4, TOKENS5 } = require("./constants");
const proxyUrl = 'http://livaproxy3447:HNB8562NDKJ@194.146.36.156:5017';
const proxyUrl2 = 'http://customer-test332-country-TR:saglam@world.saglamproxy.com:31212';
const agent2 = new HttpsProxyAgent(proxyUrl2);
const agent = new HttpsProxyAgent(proxyUrl);
const CONNECTION = new Connection("https://solana-api.instantnodes.io/token-HLsz1IISAtchQl5SDQlYDUip63Tc1W3w", "confirmed");
const endpoints = [
  'https://mainnet.block-engine.jito.wtf/api/v1/bundles',
  'https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/bundles',
  'https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/bundles',
  'https://ny.mainnet.block-engine.jito.wtf/api/v1/bundles',
  'https://tokyo.mainnet.block-engine.jito.wtf/api/v1/bundles',
]

function createVersionedTransaction(
  instructions,
  payer,
  addressLookupTableAccounts,
  recentBlockhash,
  computeUnits,
  priorityFee,
) {
  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: computeUnits,
  });
  const priorityFeeIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: priorityFee.microLamports,
  });
  const tipAccountPubkey = new PublicKey("96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5");
  
       const tipInstruction = SystemProgram.transfer({
         fromPubkey: keypair.publicKey,
         toPubkey: tipAccountPubkey,
         lamports: 100,
       });

  const finalInstructions = [computeBudgetIx, priorityFeeIx, ...instructions, tipInstruction];

  const messageV0 = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: recentBlockhash,
    instructions: finalInstructions,
  }).compileToV0Message(addressLookupTableAccounts);

  return new VersionedTransaction(messageV0);
}

async function simulateTransaction(CONNECTION, instructions,  payer,  addressLookupTableAccounts,) 
{  
  const latestBlockhash = await CONNECTION.getLatestBlockhash("finalized");  
  const messageV0 = new TransactionMessage({    payerKey: payer,    recentBlockhash: latestBlockhash.blockhash,    instructions: instructions.filter(Boolean),   }).compileToV0Message(addressLookupTableAccounts);  
  const transaction = new VersionedTransaction(messageV0);  
  const simulation = await CONNECTION.simulateTransaction(transaction, { "sigVerify": false,"replaceRecentBlockhash": true,  });  
  const unitsConsumed = simulation.value.unitsConsumed || 0;  
  //const computeUnits = Math.ceil(unitsConsumed * 1.2);  return computeUnits;
  
  if(simulation.value.error!=null){
    throw(error);
  }
  else{
    const computeUnits = Math.ceil(unitsConsumed * 1.2);  return computeUnits;
  }
 
  }  
 

  async function createJitoBundle(transaction) {
      const bundle = bs58.default.encode(transaction.serialize());
      return bundle;
  }
 
    async function sendJitoBundle(bundle) {
        try {
          let jitto = Math.floor(Math.random() * 5);
          const response = await fetch(endpoints[jitto], { method: 'POST',headers: {'Content-Type': 'application/json',}, 
            body: JSON.stringify({jsonrpc: '2.0', id: 1, method: 'sendBundle',params: [bundle],}),agent2});
          if (!response.ok) {throw new Error(`HTTP error! status: ${response.status}`);}
          const data = await response.json(); return data.result;} catch (error) {console.error("❌ Error sending bundle:", error.message);throw error; }}

async function checkBundleStatus(bundleId) {
            try {
              let jitto = Math.floor(Math.random() * 5);
                const response = await fetch(endpoints[jitto], {method: 'POST',headers: {'Content-Type': 'application/json',}, body: JSON.stringify({jsonrpc: '2.0',id: 1, method: 'getInflightBundleStatuses',params: [[bundleId]],}),agent: agent2,});
                if (response.status === 429) {console.warn('Too many requests, waiting for a while...'); await new Promise(resolve => setTimeout(resolve, 1000)); return checkBundleStatus(bundleId);}
                if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
                const json = await response.json();
                return {bundleId: json.result.value[0]["bundle_id"], status: json.result.value[0]["status"], landedSlot: json.result.value[0]["landed_slot"],};
            } catch (error) {console.error("❌ Error checking bundle status:", error.message);return null;}
          }

          async function getAveragePriorityFee() {
            const priorityFees = await CONNECTION.getRecentPrioritizationFees();
            if (priorityFees.length === 0) {
              return { microLamports: 5000, solAmount: 0.000005 }; // Default to 10000 micro-lamports if no data
            }
          
            const recentFees = priorityFees.slice(-150); // Get fees from last 150 slots
            const averageFee =
              recentFees.reduce((sum, fee) => sum + fee.prioritizationFee, 0) /
              recentFees.length;
            const microLamports = 5000;
            const solAmount = 0.000005;
            return { microLamports, solAmount };
          }
async function doWork() {
  let rastgele = Math.floor(Math.random() * 11);
  let CONNECTION = new Connection("https://solana-api.instantnodes.io/token-HLsz1IISAtchQl5SDQlYDUip63Tc1W3w", "confirmed");
  let rastgele2 = Math.floor(Math.random() * 1000);
  let fiyat = 0.1*LAMPORTS_PER_SOL;
  const inQuote = await (await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${TOKENS1000[rastgele2]}&amount=${fiyat}&onlyDirectRoutes={true}&slippageBps=0`, { agent })).json();
  const outQuote = await (await fetch(`https://quote-api.jup.ag/v6/quote?inputMint=${TOKENS1000[rastgele2]}&outputMint=So11111111111111111111111111111111111111112&amount=${inQuote["outAmount"]}&onlyDirectRoutes={true}&slippageBps=0`, { agent })).json();

  

  if (outQuote["outAmount"] > (fiyat+15000)) {    
    console.log(`${fiyat}->${inQuote["outAmount"]}->${outQuote["outAmount"]}---------------->`, outQuote["outAmount"]-fiyat);
    Promise.all([await fetch("https://quote-api.jup.ag/v6/swap-instructions", { method: "POST", headers: { "Content-Type": "application/json", },        
      body: JSON.stringify({ quoteResponse: inQuote, userPublicKey: keypair.publicKey.toBase58(), wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 52_000,  }), agent: agent }),
      await fetch("https://quote-api.jup.ag/v6/swap-instructions", { method: "POST", headers: {"Content-Type": "application/json",},        
        body: JSON.stringify({quoteResponse: outQuote, userPublicKey: keypair.publicKey.toBase58(), wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: 52_000 }), agent : agent }),]).then(async ([inQuote, outQuote]) => {      
          Promise.all([inQuote.json(), outQuote.json()]).then( 
            async ([inQuote, outQuote]) => {          
              const addressLookupTableAccounts = []; 
              addressLookupTableAccounts.push(...(await getAddressLookupTableAccounts( inQuote.addressLookupTableAddresses )),...(await getAddressLookupTableAccounts( outQuote.addressLookupTableAddresses)));
              
              instructions = [ ...inQuote.setupInstructions.map(deserializeInstruction), deserializeInstruction(inQuote.swapInstruction), deserializeInstruction(outQuote.swapInstruction),  deserializeInstruction(outQuote.cleanupInstruction)];          
               
              const computeUnits = await simulateTransaction(CONNECTION,instructions,keypair.publicKey,addressLookupTableAccounts,5);     

      try {            
        const latestBlockhash = await CONNECTION.getLatestBlockhash("finalized");
        const priorityFee = await getAveragePriorityFee();
        const transaction = createVersionedTransaction(
          instructions,
          keypair.publicKey,
          addressLookupTableAccounts,
          latestBlockhash.blockhash,
          computeUnits,
          priorityFee,
        );    
      transaction.sign([keypair]);                

      const jitoBundle = await createJitoBundle(transaction);
      const bundleId = await sendJitoBundle(jitoBundle);
      let bundleStatus = null;
      bundleStatus = await checkBundleStatus(bundleId);
      console.log("bundle: ", bundleStatus);
      if (!bundleStatus || bundleStatus.status !== "Landed") {
        throw new Error("Soory");
      }

      console.log("========== SWAP DONE! ==========\n");
      
    } catch (error) {
      console.error("Error sending transaction:", error.message);
    }
    });});}  
  }
 
async function main() {
            while (true) {
              const requests = [];
              for (let i = 0; i < 100; i++) { 
                requests.push(doWork());
              }
          
              await Promise.all(requests);
          
              await new Promise(resolve => setTimeout(resolve, 10));
            }
          }
 
main();
  

